# 教室配当 Phase 3 実装設計書

Phase 2 で「なぜこう配当されたか／なぜ配当できなかったか」が UI 上で見えるようになった。
Phase 3 のゴールは、**配当結果に対する人為的な介入と検証を支援すること**。

## 0. スコープ

範囲に含める:
- 例外配当の事前確認モーダル（自動配当前にユーザが例外候補をレビュー・承認/却下）
- 既存の例外配当の後追い解消（再スキャンで例外解消を試みる機能）
- 手動配当の制約違反検出と可視化（手動ドラッグで不適合教室に入れた場合のバッジ）

範囲に含めない（Phase 4 以降）:
- 玉突き再配当（swap-1 / swap-2） → Phase 4
- 処理順の困難度計算 → Phase 5
- 承認済み例外の永続化 → Phase 6

## 1. 例外配当の事前確認モーダル

### 1-1. 目的

現状、`term_consistency.enabled=true`（緩和許可）の場合、候補0件時に自動的に例外配当が成立する。ユーザは配当後にしかそれを見ることができない。

Phase 3 では「**例外配当を実行する前に確認する**」モードを追加し、ユーザが個別に承認/却下できるようにする。

### 1-2. UI トリガ

`AllocationRuleSettings.tsx` の配当基本設定に新しいトグルを追加:

```
[☑] 例外配当を実行前に確認する
```

既定は OFF（Phase 2 と同じ挙動）。

### 1-3. フロー

1. ユーザが「教室自動配当」を押す
2. optimizer を通常モードで走らせるが、**例外候補を採用せず、`pendingExceptions` リストに積む**
3. すべての科目を処理し終えたら、`pendingExceptions` があればモーダル表示
4. モーダルでユーザが各例外を承認/却下
5. 承認分は確定配当、却下分は未配当に送る

### 1-4. optimizer の拡張

現状の `runAutoAllocation` にオプション引数を追加:

```typescript
export interface AllocationRunOptions {
    equipmentSettings?: EquipmentSettings;
    dryRunExceptions?: boolean; // true: 例外候補を採用せず pendingExceptions に積む
}

export interface PendingException {
    subject: Subject;
    classroomId: string;
    exceptions: Array<'term_split' | 'room_type_relaxed'>;
    alternativeUnassignedReason: UnassignedReason; // 却下時の理由
}

export interface OptimizerResult {
    allocations: Allocation[];
    unassigned: UnassignedInfo[];
    pendingExceptions?: PendingException[]; // 新規
}
```

optimizer の内部ロジック変更:

```typescript
if (!chosen) {
    failed = true;
    break;
}

// 新規: dryRun モードで例外を積み上げ
if (runOptions.dryRunExceptions && chosen.exceptions.length > 0) {
    pendingExceptions.push({
        subject,
        classroomId: chosen.room.id,
        exceptions: chosen.exceptions,
        alternativeUnassignedReason: chosen.exceptions.includes('term_split')
            ? 'U3_term_split_blocked' : 'U2_room_type_blocked'
    });
    // 配当は確定せず、占有も入れない → 次の科目へ
    remaining -= 1;
    continue;
}
```

注意: dryRun モードでは**例外配当は占有に入れない**ため、後続科目が例外配当分の教室枠を使える。これが設計判断のポイント。ユーザが却下すれば枠は空いたままなので、前倒しの利点がある。逆に承認した場合、後続科目は該当教室を「空きとみなして」配当しているため、重複の再検証が必要になる。

**対策**: dryRun モード運用では、承認後に確定配当を再実行する 2-pass 方式にする。
- Pass 1: dryRun で例外候補を列挙（正常配当＋例外候補のリストを作成）
- Pass 2: 承認された例外のみ配当、却下分は未配当、正常配当はそのまま反映

### 1-5. 確認モーダル UI

新規ファイル `src/components/ExceptionReviewModal.tsx`:

```
[例外配当の確認]
━━━━━━━━━━━━━━━━━━━━━━━
以下の科目は例外を伴って配当されます。各項目を承認／却下してください。

① [授業名] 教員・学期・曜日・講時
   配当先: [教室名]
   例外: タイプ不一致配当 (preferredRoomType=ゼミ / 教室=一般)
   [承認] [却下 → 未配当]

② ...
━━━━━━━━━━━━━━━━━━━━━━━
[すべて承認] [すべて却下] [確定] [キャンセル]
```

- 各行に2つのボタン（承認/却下）、チェックボックスで一括選択も可
- 「すべて承認」「すべて却下」の一括操作ボタン
- 「キャンセル」で配当自体を取り消し（optimizer の結果を破棄）

### 1-6. 承認/却下の反映

- 承認: `allocations` に追加（`exceptions` 付き）、`occupied` を更新
- 却下: `unassigned` に追加、理由は `alternativeUnassignedReason`

## 2. 既存例外配当の後追い解消

### 2-1. 目的

配当後に運用状況が変わって教室の空きができたとき、すでに例外配当されている授業の例外を解消できないか試す機能。

### 2-2. UI

配当結果サマリモーダルまたは新規「例外配当の管理」タブに以下のボタン:

```
[例外配当を再スキャンして解消を試みる]
```

押下時:
1. 現在 `exceptions` が付いている配当を列挙
2. 各配当について「例外なし（hard + near strict）」で候補教室を再探索
3. 候補が見つかれば、該当配当の `classroomId` を置換し、`exceptions` を空に

### 2-3. 実装

新しい関数 `resolveExceptions` を `optimizer.ts` に追加:

```typescript
export const resolveExceptions = (
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    rules: AllocationRule[],
    equipmentSettings?: EquipmentSettings
): { allocations: Allocation[]; resolved: Array<{ subjectId: string; from: string; to: string }> } => {
    const result = [...allocations.map(cloneAllocation)];
    const resolved: Array<{ subjectId: string; from: string; to: string }> = [];

    // occupied を現状から再構築（対象外の配当はそのまま）
    const occupied = buildOccupiedSet(subjects, result);

    const exceptionalAllocations = result.filter(a => a.exceptions && a.exceptions.length > 0);

    for (const alloc of exceptionalAllocations) {
        const subject = subjects.find(s => s.id === alloc.subjectId);
        if (!subject) continue;

        // 元の教室の占有を一時的に外す
        unmarkAllocation(subject, alloc, occupied);

        // 厳密モードで再スキャン
        const candidate = pickBestCandidate(
            subject, subjects, classrooms, result, occupied, ruleMap,
            { relaxTermConsistency: false, relaxRoomType: false },
            equipmentSettings
        );

        if (candidate && candidate.exceptions.length === 0) {
            // 解消できた
            resolved.push({ subjectId: subject.id, from: alloc.classroomId, to: candidate.room.id });
            alloc.classroomId = candidate.room.id;
            alloc.exceptions = undefined;
            markAllocation(subject, alloc, occupied);
        } else {
            // 元に戻す
            markAllocation(subject, alloc, occupied);
        }
    }

    return { allocations: result, resolved };
};
```

### 2-4. 結果表示

解消成功/失敗の件数と対象科目をトーストまたはモーダルで表示:

```
例外配当の再スキャン結果
━━━━━━━━━━━━━━━━━━━━━
解消: 5件
  ├ [授業名1] 7号館B → 7号館A
  └ [授業名2] 3号館C → 3号館B
未解消: 2件
━━━━━━━━━━━━━━━━━━━━━
```

## 3. 手動配当の制約違反検出

### 3-1. 目的

自動配当は hard 制約を遵守するが、手動ドラッグでは違反配置が可能（現状の仕様）。現状は `TimeTableGrid` で視覚的な警告（赤枠等）が一部あるが、統一的な違反判定がない。

Phase 3 では**手動配当時点で制約違反を検出し、バッジとして表示する**。

### 3-2. 検出対象

| 制約 | 検出条件 | バッジ |
|------|----------|--------|
| 定員不足 | `room.capacity < subject.requiredCapacity` | ⚠ 定員不足 |
| 必須機材不足 | `subject.mandatoryEquipment` が `room.equipment` に無い | ⚠ 必須機材不足 |
| 教室タイプ不一致 | `subject.preferredRoomType !== room.type` | ℹ タイプ不一致 |
| 建物希望不一致 | `subject.buildingPreference !== room.building` | ℹ 建物希望不一致 |
| 配当対象外教室 | `room.isExcluded === true` | ⚠ 対象外教室 |

### 3-3. 実装

新しいユーティリティ `src/utils/violations.ts`:

```typescript
export type ViolationType =
    | 'capacity_short'
    | 'mandatory_equipment_missing'
    | 'room_type_mismatch'
    | 'building_mismatch'
    | 'excluded_room';

export interface Violation {
    type: ViolationType;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

export const detectViolations = (
    subject: Subject,
    room: Classroom,
    equipmentSettings?: EquipmentSettings
): Violation[] => { /* ... */ };
```

TimeTableGrid 内で授業カードをレンダリングする際に、`detectViolations(subject, room)` を呼び出してバッジとして表示。

### 3-4. UI

授業カード右上隅に小さな警告アイコン ⚠/ℹ を表示。hover / click で違反内容のツールチップ。

`DisplayConfig.showViolationAlerts` に連動（既存のフラグを流用）。

### 3-5. 既存の `exceptions` バッジとの関係

- **自動配当で発生した `exceptions`** → 「承認された例外」扱い（Phase 2 で実装済み）
- **手動配当で発生した制約違反** → `Violation` として動的に検出（Phase 3 で追加）

両者はカード内で別セクションとして表示:
- 自動例外: 🔀 春秋分離配当 / ⚠ タイプ不一致配当（現行バッジ）
- 手動違反: ⚠ 定員不足 / ⚠ 必須機材不足 / ℹ 建物希望不一致（新規）

## 4. 修正対象ファイル

| ファイル | 修正内容 | 破壊度 |
|----------|----------|--------|
| `src/utils/optimizer.ts` | `AllocationRunOptions` / `PendingException` 追加、`dryRunExceptions` モード、`resolveExceptions` 関数追加 | 中 |
| `src/utils/violations.ts` | 新規作成（制約違反検出ユーティリティ） | 新規 |
| `src/components/ExceptionReviewModal.tsx` | 新規作成（例外承認モーダル） | 新規 |
| `src/components/AllocationRuleSettings.tsx` | 「例外配当を実行前に確認する」トグル追加 | 小 |
| `src/components/AllocationResultModal.tsx` | 「例外を再スキャン」ボタン追加 | 小 |
| `src/components/TimeTableGrid.tsx` | `detectViolations` を呼び出してバッジ表示 | 小 |
| `src/types.ts` | `AllocationOptions` に `confirmExceptions: boolean` 追加 | 小 |
| `src/App.tsx` | dryRun 2-pass フロー、承認後の確定配当、例外再スキャン経路 | 中 |

## 5. 確認観点

### 5-1. 型・ビルド

- `tsc --noEmit` でエラーなし
- `vite build` で警告のみ

### 5-2. 機能（事前確認モーダル）

- 「例外配当を実行前に確認する」OFF で Phase 2 と同一挙動
- ON で例外が発生した時のみモーダルが表示される
- 「すべて承認」で全件が配当される
- 「すべて却下」で全件が未配当リストに入り、U2/U3 バッジが付く
- 個別の承認/却下が期待どおり動作する
- 「キャンセル」で配当自体が取り消され、元の状態に戻る
- 例外が 0 件の自動配当実行ではモーダルが出ない（従来のサマリモーダルのみ）

### 5-3. 機能（例外再スキャン）

- 例外付き配当が 1 件もなければボタンが無効（または非表示）
- ボタン押下で例外解消を試み、成功数/失敗数が表示される
- 他の配当の占有を壊さない（重複配当が起きない）
- 解消成功した配当の `exceptions` フィールドが空になる

### 5-4. 機能（手動違反検出）

- 手動で定員不足の教室に入れると ⚠ 定員不足 バッジが付く
- 必須機材のない教室には ⚠ 必須機材不足 が付く
- タイプ不一致には ℹ タイプ不一致 が付く
- 自動配当で正常配置された授業には違反バッジが付かない（exceptions もない）
- `DisplayConfig.showViolationAlerts` で on/off が切り替わる

## 6. 懸念点

1. **dryRun 2-pass の一貫性**
   Pass 1 の結果と Pass 2 の結果が一致する保証が必要。Pass 1 で占有を入れないため後続科目の候補が広がるが、承認後の Pass 2 で再配当すると違う結果になりうる。
   対策: Pass 2 は「正常配当」だけを先に固定し、承認された例外を後から追加する方式にする。つまり Pass 1 の結果をそのまま使い、承認された例外のみ追記する。この方式なら Pass 2 は不要で、単に「承認リストに基づいて配当と未配当を分ける」だけになる。
   → 1-4 の設計を書き直す: dryRun モードでも**正常配当は確定する**（占有を入れる）、例外候補のみ保留にする。

2. **例外再スキャンの順序依存**
   例外A を解消しようとして占有を外した瞬間、別の例外B がその教室を使えるかもしれない。順序によって結果が変わるため、優先度順に処理する。

3. **手動違反検出のパフォーマンス**
   TimeTableGrid は多数の授業カードを描画する。violations 計算を都度実行すると重い可能性。useMemo でキャッシュするか、allocation 単位で事前計算する。

4. **UX の複雑化**
   Phase 3 で機能が増えるため、初心者ユーザには難しくなる。既定値は全て OFF にして、段階的に機能を見せる方針。

---

## 7. Phase 4 以降のロードマップ（概要）

Phase 3 完了後の次ステップ:

### Phase 4: 局所玉突き再調整（CODEX 6-3）

- 未配当科目 X に対し、教室 R を使っている科目 Y を R' に動かせば X が入るなら入替（swap-1）
- Y を動かすためにさらに Z を動かす（swap-2, 深さ 2 固定）
- 入替成立条件:
    - 未配当数が減る または 高優先度を救済できる
    - 例外レベルが悪化しない
    - hard / near を壊さない
- `U5_swap_failed` を正式利用開始

### Phase 5: 配当困難度による処理順ソート（CODEX 4-1）

- 各科目の `difficulty` を算出:
    - 厳密候補数（少ないほど困難）
    - 必須機材数
    - 希少タイプ（pc / seminar）
    - 必要定員
    - 連続講時 / 春秋ペア / 複数室
- ソートキーを `(priority, difficulty, lastUnassignedStreak, importOrder)` に変更
- `lastUnassignedStreak` は session-local（optional: cloud 永続化）

### Phase 6（将来）: 承認済み例外の永続化

- Phase 3 で承認した例外を Allocation 単位で記録（`Allocation.exceptionApproved?: boolean`）
- 次回の配当実行時は承認済み例外を尊重する（再度確認を求めない）
- ユーザが明示的にリセットした場合のみ再確認

---

以上。Phase 3 着手時はこの設計書を実装者に渡してください。
