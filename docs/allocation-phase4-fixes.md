# Phase 4 修正指示書（CODEX 向け）

Phase 4 レビューで検出した 3 件の設計逸脱を修正する。
対象ファイル: `src/utils/optimizer.ts`

## 修正1: near 制約を再評価し例外を記録する（中）

### 問題
`buildRelocationCandidate` が `isHardRoomEligible` のみで near ルールを一切評価せず、`exceptions: []` を固定でセットしている。その結果、玉突きで Y を別教室に動かすと、partner と分離しても `term_split` が記録されず、`preferredRoomType` 違反も検出されない（サイレント near 違反）。

### 該当箇所
`src/utils/optimizer.ts` `buildRelocationCandidate` (おおよそ L669-686)

### 修正方針
`isNearCandidate` を呼び出して例外配列を取得し、以下のポリシーで処理する:

```typescript
const buildRelocationCandidate = (
    room: Classroom,
    subject: Subject,
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    ruleMap: Map<string, AllocationRule>,
    equipmentSettings?: EquipmentSettings,
    allowedExceptions?: Array<'term_split' | 'room_type_relaxed'>  // 現在の配当が持つ例外の許容集合
): Candidate | null => {
    if (!isHardRoomEligible(room, subject, equipmentSettings)) return null;

    // near 再評価：両方 relax=true で例外候補を取り出す
    const exceptions = isNearCandidate(room, subject, subjects, allocations, {
        relaxTermConsistency: true,
        relaxRoomType: true
    });
    if (!exceptions) return null;

    // 例外レベル非悪化チェック（設計 §3 条件2）
    // allowedExceptions = 現在の allocation が持つ exceptions 配列
    // 新しい exceptions はその部分集合でなければならない
    const allowed = new Set(allowedExceptions || []);
    if (!exceptions.every(ex => allowed.has(ex))) return null;

    return {
        room,
        exceptions,
        prefScores: getPrefScores(room, subject, subjects, allocations, classrooms, ruleMap, equipmentSettings),
        surplusCapacity: room.capacity - subject.requiredCapacity
    };
};
```

### 呼び出し側の修正
`getRelocationCandidates` / `attemptRelocationPlacement` の blocker 移動時に、**その blocker の現 allocation が持つ exceptions** を `allowedExceptions` として渡す:

```typescript
// 玉突き対象 blocker の現 exceptions を取得
const currentExceptions = blocker.allocation.exceptions || [];

const relocationChoices = getRelocationCandidates(
    blocker.blockerSubject,
    subjects,
    classrooms,
    workingState.allocations,
    ruleMap,
    equipmentSettings,
    excludeRooms,
    currentExceptions  // ← 追加
).slice(0, 5);
```

未配当 X を新規配置する場合（root）は `allowedExceptions = []`（例外なしのみ許容）。

### addAllocationToState にも exceptions を反映
現状 `allocation = { subjectId, classroomId }` だけを push しているが、候補が持つ `exceptions` を `allocation.exceptions` に転記する:

```typescript
const addAllocationToState = (
    state: RelocationSearchState,
    subject: Subject,
    roomId: string,
    exceptions?: Array<'term_split' | 'room_type_relaxed'>
) => {
    const allocation: Allocation = {
        subjectId: subject.id,
        classroomId: roomId,
        exceptions: exceptions && exceptions.length > 0 ? [...exceptions] : undefined
    };
    state.allocations.push(allocation);
    markAllocation(subject, allocation, state.occupied);
};
```

そして `attemptRelocationPlacement` の blockers=0 分岐と blocker 移動後配置で `candidate.exceptions` を渡す。

## 修正2: isLocked を尊重する（小）

### 問題
`getBlockersForRoom` / `removeAllocationFromState` が `allocation.isLocked` をチェックしていない。手動ロック配当が自動で動かされる余地がある（現状 UI 未露出だが将来リスク）。

### 該当箇所
`src/utils/optimizer.ts` `getBlockersForRoom` (L702-716)

### 修正方針
blocker 抽出時に `isLocked=true` を除外:

```typescript
const getBlockersForRoom = (
    subject: Subject,
    room: Classroom,
    allocations: Allocation[],
    subjects: Subject[]
) => {
    const targetKeys = new Set(getRoomOccupiedKeys(subject, room.id));
    return allocations.filter(allocation => {
        if (allocation.subjectId === subject.id) return false;
        if (allocation.classroomId !== room.id) return false;
        if (allocation.isLocked) return false;  // ← 追加
        const blockerSubject = subjects.find(s => s.id === allocation.subjectId);
        if (!blockerSubject) return false;
        return getRoomOccupiedKeys(blockerSubject, allocation.classroomId).some(key => targetKeys.has(key));
    });
};
```

ロックされた blocker がある教室は、その X に対する候補から事実上除外される（blockers が非空のまま動かせないので `depthRemaining<=0` で打ち切られる）。

## 修正3: teacher_continuity 1→0 の硬拒否（小）

### 問題
設計書 §3.4「最上位 pref (`teacher_continuity`) が 1→0 になる移動は拒否する」がソフトコスト加算のみで実装されており、他の benefit が大きければ連続授業の分離で X を救ってしまう。

### 該当箇所
`src/utils/optimizer.ts` `moveCost` (L763-777) またはその呼び出し元 `attemptRelocationPlacement` の blocker 移動分岐。

### 修正方針
`moveCost` ではなく、blocker 候補をフィルタする段階で落とす方が明確。`buildRelocationCandidate` の直後、または `getRelocationCandidates` のフィルタで:

```typescript
// 候補に対し、元教室 fromRoom での teacher_continuity スコアが 1 で、
// 新教室 toRoom のスコアが 0 になるなら拒否
const fromScore = scoreTeacherContinuity(fromRoom, subject, subjects, allocations, classrooms);
const toScore = scoreTeacherContinuity(candidate.room, subject, subjects, allocations, classrooms);
if (fromScore >= 1 && toScore < 1) return null;  // または filter で除外
```

実装位置の候補:
- (a) `getRelocationCandidates` に `fromRoomId?: string` 引数を追加し、候補選別時にフィルタ
- (b) `attemptRelocationPlacement` の blocker 分岐で `relocationChoices` を計算した後にフィルタ

(b) の方が最小差分で済む:

```typescript
const fromRoom = getRoomById(blocker.allocation.classroomId, classrooms);
const filteredChoices = fromRoom
    ? relocationChoices.filter(candidate => {
        const fromScore = scoreTeacherContinuity(fromRoom, blocker.blockerSubject!, subjects, workingState.allocations, classrooms);
        const toScore = scoreTeacherContinuity(candidate.room, blocker.blockerSubject!, subjects, workingState.allocations, classrooms);
        return !(fromScore >= 1 && toScore < 1);
    })
    : relocationChoices;

for (const candidate of filteredChoices) {
    // ...
}
```

## 4. 確認観点

### 型・ビルド
- `tsc --noEmit` エラーなし
- `vite build` 警告のみ

### 機能回帰
- 既存のシンプルな swap-1 ケース（例外なし教室への移動）が引き続き成立する
- priority 高の未配当が救える入替パターンは従来通り採用される
- プレビュー → 確定 → キャンセルのフロー不変

### 新規検証
- **修正1**: Y を B に動かすと partner が A に残り term_consistency が壊れるケースで、新 allocation に `exceptions: ['term_split']` が付く、もしくは候補として採用されない（`term_consistency.enabled=true` で relax=false の環境）
- **修正1**: Y が `preferredRoomType='ゼミ'` で一般教室に動く候補は、`room_type.enabled=true` 環境で拒否される
- **修正2**: `isLocked=true` の配当は blocker として選ばれず、その教室に X は入らない
- **修正3**: Y の `scoreTeacherContinuity` が現教室で 1、移動先で 0 の候補は採用されない

## 5. 注意事項

- `isNearCandidate` は `relaxFlags` により例外を返すだけで、フィルタはしない。新しい `buildRelocationCandidate` 側で `allowedExceptions` による部分集合チェックを行う設計
- relocation 中に発生する exceptions は「承認済み例外の伝播」に相当するため、元 allocation の exceptions と同一または部分集合のみ許容する
- 未配当 X を新規配置する root 呼び出しでは `allowedExceptions = []` とし、Phase 3 の厳密候補のみ採用ポリシーを維持する

---

以上 3 件の修正で Phase 4 設計書との整合が取れる。
