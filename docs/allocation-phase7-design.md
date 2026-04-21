# Phase 7 設計: 配当ルール再編 + 教員コード新設

## 0. 目的

1. ルール階層を「準必須」廃止により単純化する。
   - 教室タイプマッチングを **必須**(`hard`) に昇格
   - 春秋同一教室を **希望**(`pref`) に降格、`建物希望` の前に配置
   - UI 文言を「絶対必須」→「必須」に統一
2. 春秋同一教室の判定基盤を **教員コード** に置き換える（教員名比較を廃止）。
3. 授業管理 / 編集モーダル / CSV インポート・エクスポートに **教員コード** 列を追加（後方互換維持）。

## 1. 前提・スコープ

### 適用方針（要件レビュー反映済み）

- **春秋同一教室の対象は `spring ↔ autumn` のみ**。
  - `spring_first ↔ spring_second`、`autumn_first ↔ autumn_second` は「セットで同一教室に入れる」ことを業務前提として既に運用しているため、本機能の自動判定対象から外す。
  - `spring_first ↔ autumn_first`、`spring_second ↔ autumn_second` も対象外（要件文「前半・後半は除く」）。
  - 通年(`full_year`)は対象外。
- **教員コードは原則必ず入力される前提**。空欄時のフォールバック（教員名比較）は持たない。
- **教室タイプ必須化に伴う未配当の増加は許容**。むしろ「配当できないもののあぶり出し」が目的。
- **「例外配当」(`room_type_relaxed`) は不要**。教室タイプ不一致は無条件で未配当行きに変える。

### 非スコープ

- 教員マスタ管理（重複検出、名寄せ等）は本フェーズでは扱わない。
- `term_consistency` を pref 化したことで `U3_term_split_blocked` が新規発生しなくなるが、過去データの表示ラベルは残置する（後述 §6）。

## 2. データモデル変更

### 2-1. `Subject` への教員コード追加（`src/types.ts`）

```ts
export interface Subject {
    id: string;
    code: string;
    name: string;
    teacherCode?: string; // ★ NEW 教員コード（春秋同一判定の主キー）
    teacher: string;      // 代表教員名（表示用に維持）
    // ... 以下既存
}
```

**後方互換**:

- optional のため、過去 snapshot / cloud データに `teacherCode` が無くても読み込める。
- マイグレーションは不要。`teacherCode` 未入力の科目は春秋同一の優先スコアが自動的にニュートラルになる（§4-2）。

### 2-2. `RuleTier` の整理

- 型定義 `RuleTier = 'hard' | 'near' | 'pref'` の `'near'` は **当面残置**（既存保存設定の読み込み互換のため）。
- ただし `DEFAULT_ALLOCATION_RULES` から `tier: 'near'` のエントリは消える。
- `migrateAllocationRules` で旧 `near` 保存値を自動的に新しい `def.tier`（`hard` または `pref`）へ吸収する。

### 2-3. `Allocation.exceptions` の取扱い

- 型は `Array<'term_split' | 'room_type_relaxed'>` のまま据え置き（既存データ互換）。
- 新規生成では **どちらの値も入らなくなる**。読み込みは無視（§6 表示のみ残置）。

## 3. 既定ルール (`DEFAULT_ALLOCATION_RULES`) の更新

### 3-1. 必須(`hard`)へ追加: `room_type`

```ts
{
    id: 'room_type',
    name: '教室タイプマッチング',
    description: '希望教室タイプと一致する教室にのみ配当する',
    tier: 'hard',
    enabled: true,
    order: 0
    // params.relaxable は削除
}
```

### 3-2. `term_consistency` を希望(`pref`)へ降格

```ts
{
    id: 'term_consistency',
    name: '春秋同一教室',
    description: '春学期と秋学期で同じ曜日・講時・教員コードの科目を、可能な限り同じ教室に配当する。前半・後半および通年は対象外',
    tier: 'pref',
    enabled: true,
    order: 4
    // params.relaxable は削除
}
```

### 3-3. 希望条件の `order` 再採番

| id | 旧 order | 新 order |
|---|---|---|
| teacher_continuity | 1 | 1 |
| equipment | 2 | 2 |
| capacity_fit | 3 | 3 |
| **term_consistency** | (near) | **4** |
| building_preference | 4 | 5 |
| previous_room | 5 | 6 |

> `term_consistency` は **`building_preference` の前** に固定で配置。

### 3-4. `migrateAllocationRules` の修正

- `def.tier === 'near'` 分岐を削除。
- `def.tier === 'hard'`: 強制 `enabled: true`（保存値無視）。`room_type` も hard 化により常に有効。
- `def.tier === 'pref'`: 既存通り保存値で上書き、`order` は `def.order` を尊重。
- 旧保存に存在した `room_type` の `enabled: false` は **無視**して `true` 化（要件: 「教室タイプを必須とする」）。

## 4. オプティマイザ変更（`src/utils/optimizer.ts`）

### 4-1. 必須化に伴う簡素化

- `RelaxFlags` 型と `relaxTermConsistency` / `relaxRoomType` を **完全削除**。
- `isNearCandidate` 関数を **削除**。
- `isHardCandidate` に教室タイプ判定を追加:

```ts
const isHardCandidate = (
    room, subject, occupied, newAllocations, equipmentSettings
) => {
    if (room.isExcluded) return false;
    if (newAllocations.some(a => a.subjectId === subject.id && a.classroomId === room.id)) return false;
    const roomKeys = getRoomOccupiedKeys(subject, room.id);
    if (roomKeys.some(key => occupied.has(key))) return false;
    if (room.capacity < subject.requiredCapacity) return false;
    if (getMandatoryItems(subject).some(req => !matchesEquipment(room, req))) return false;
    // ★ 追加
    if (subject.preferredRoomType && subject.preferredRoomType !== room.type) return false;
    // strictLevel5 既存ロジック...
    return true;
};
```

- `buildCandidate` から `isNearCandidate` 呼び出しを削除し、`exceptions: []` 固定で Candidate を構築。
- `runAutoAllocation` の探索3段（strict → termRelax → roomRelax）を **strict のみの1段** に簡素化。
  - `termRelaxCandidatesCount`、`roomRelaxCandidatesCount` 関連の集計ロジック削除。
  - `pendingExceptions` の生成は残すが、新規には `chosen.exceptions.length === 0` のため積まれなくなる（コードは互換のため残置可）。
- `relocateForUnassigned` 系の `buildRelocationCandidate` も同様に exceptions を扱わない方向で簡素化。`allowedExceptions` 引数は不要（呼び出し側からも除去）。

### 4-2. 春秋同一教室 = pref スコア化

新スコア関数を追加し `getPrefScores` の `switch` に組み込む:

```ts
const scoreTermConsistency = (
    room: Classroom,
    subject: Subject,
    subjects: Subject[],
    allocations: Allocation[]
): number => {
    const partner = findTermPartner(subject, subjects);
    if (!partner) return 0; // 対象外（中立）
    const partnerRoomId = getAllocatedRoom(partner.id, allocations);
    if (!partnerRoomId) return 0.5; // ペア未配当 → ニュートラル
    return partnerRoomId === room.id ? 1 : 0;
};
```

```ts
case 'term_consistency':
    return scoreTermConsistency(room, subject, subjects, allocations);
```

> 比較は `compareCandidates` の辞書順なので、`order: 4` の枠（`teacher_continuity` / `equipment` / `capacity_fit` の次）で判定される。

### 4-3. `findTermPartner` のロジック改訂

`optimizer.ts` の `findTermPartner` を以下に置き換え、**`difficulty.ts` 側からも同関数を import** して重複実装を排する。

```ts
// optimizer.ts から export
const TERM_PARTNERS: Partial<Record<Term, Term>> = {
    spring: 'autumn',
    autumn: 'spring'
    // spring_first/second, autumn_first/second, full_year は含めない
};

export const findTermPartner = (subject: Subject, subjects: Subject[]): Subject | null => {
    if (subject.linkedSubjectId) {
        const linked = subjects.find(s => s.id === subject.linkedSubjectId);
        if (linked) return linked;
    }
    const oppositeTerm = TERM_PARTNERS[subject.term];
    if (!oppositeTerm) return null;
    if (!subject.teacherCode) return null; // ★ 教員コード必須
    return subjects.find(s =>
        s.term === oppositeTerm &&
        s.day === subject.day &&
        s.period === subject.period &&
        !!s.teacherCode &&
        s.teacherCode === subject.teacherCode  // ★ 教員名でなくコードで判定
    ) || null;
};
```

`difficulty.ts` の `findTermPartner` は削除し、`import { findTermPartner } from './optimizer';` で参照する。

### 4-4. `classifyUnassigned` の整理

- `U3_term_split_blocked` は **新規発生しない**（pref 化のため）。判定分岐を削除。
- `U2_room_type_blocked` の判定は `subject.preferredRoomType` が設定されていて `strictCandidatesCount === 0` のケースを優先返却。

```ts
if (strictCandidatesCount === 0) {
    if (subject.preferredRoomType) {
        return {
            reason: 'U2_room_type_blocked',
            detail: `希望教室タイプ(${subject.preferredRoomType})に一致する候補がない`
        };
    }
    return {
        reason: 'U1_no_hard_candidate',
        detail: '必須条件を満たす候補教室がない'
    };
}
```

- `UnassignedReason` 列挙体は型互換のため `U3_term_split_blocked` を残置（過去未配当の表示用）。

### 4-5. `resolveExceptions` の扱い

- `exceptions` を新規には積まなくなるため、本関数は **過去データ専用の互換処理** となる。
- 関数自体は残置可。呼び出しを停止するかは UX 検討事項（本フェーズでは挙動維持）。

## 5. UI 変更

### 5-1. `AllocationRuleSettings.tsx`

#### 文言統一

- 「絶対必須」→「**必須**」（セクション見出しおよび説明テキスト）。
- 「Phase1: 必須条件は固定、希望条件は上から順に比較します」のサブテキストもそのまま整合（変更不要）。

#### レイアウト

- 「準必須」セクション（`nearRules` を表示しているブロックおよび説明文）を **完全削除**。
- 「必須」と「希望条件」の 2 セクション構成に。
- 「必須」セクション一覧に `room_type`（教室タイプマッチング）が追加表示される（`hardRules` から自動）。
- 「希望条件」セクションに `term_consistency` が `building_preference` の前に並ぶ（`order` で自動）。

#### コード差分要点

```tsx
// 削除
const nearRules = rules.filter(r => r.tier === 'near');
// 削除: 「準必須」 <section> 全体

// gridTemplateColumns の repeat(auto-fit, minmax(300px, 1fr)) を 1fr に変更
// （必須セクション単独配置）
```

### 5-2. `SubjectManager.tsx`（授業管理）

#### 列定義

`SM_COL_DEFS` に `teacherCode` 列を `teacher` の **直前** に挿入:

```ts
const SM_COL_DEFS = [
    { key: 'code', label: 'コード', width: 70 },
    { key: 'name', label: '時間割名称', width: 208 },
    { key: 'teacherCode', label: '教員コード', width: 80 }, // ★ NEW
    { key: 'teacher', label: '教員', width: 104 },
    // ... 以下既存
];
```

#### フィルタ

- `filters` state に `teacherCode: ''` を追加。
- フィルタ行に `teacherCode` 用のテキスト入力（teacher と同形式）。
- 「フィルタすべて解除」ボタンの reset payload にも `teacherCode: ''` を追加。

#### 行表示

- `{smShow('teacherCode') && <td>{subject.teacherCode}</td>}` を `teacher` 列の前に追加。
- 新規追加行 (`isAdding`) にも `<input value={editForm.teacherCode}>` を追加。

#### CSV エクスポート

`baseRow` に `'教員コード'` を `'教員'` の前に挿入:

```ts
const baseRow: Record<string, any> = {
    '時間割コード': s.code,
    '時間割名称': s.name,
    '教員コード': s.teacherCode || '', // ★ NEW
    '教員': s.teacher,
    // ... 以下既存
};
```

#### CSV ヒント文

「任意」項目の先頭に `教員コード` を追加:

```
任意: 時間割名称, 教員コード, 教員, 管轄学科, ...
```

#### `localStorage smColConfig` の互換

`smColDefaults()` とのマージで新キーは既定値で補完される。既存ユーザーは新列が visible 状態で表示される（破壊なし）。

### 5-3. `SubjectEditModal.tsx`

「代表教員」入力の **左** に「教員コード」入力を追加:

```tsx
<div style={{ width: '100px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <label style={{ fontWeight: 'bold', color: '#555', fontSize: '0.8rem' }}>教員コード</label>
    <input value={form.teacherCode || ''} onChange={e => setForm({ ...form, teacherCode: e.target.value })}
        style={{ padding: '6px', border: '1px solid #ddd', borderRadius: '4px' }} />
</div>
```

レイアウトは flex の同じ行に並べる（教員/学部/管轄 の行を 4 カラムに拡張）。

## 6. CSV インポート / エクスポート（`csvParser.ts`）

### 6-1. インポート（`parseSubjectCSV`）

`rawSubjects.map` 内に追加:

```ts
teacherCode: row['教員コード'] || row.TeacherCode || '',
```

- 列が無い旧 CSV でも空文字フォールバックで読み込み可。
- グルーピングキー (`${s.code}-${s.term}-${s.day}-${s.period}`) は変更しない（教員コードはキーに含めない）。

### 6-2. エクスポート

§5-2 のエクスポート baseRow に組み込み済み。

### 6-3. CSV ヒント表示

`SubjectManager.tsx` の CSV ヒントポップアップで、任意項目に `教員コード` を追記。

## 7. 表示ラベル整合（既存データ表示）

| 箇所 | 対応 |
|---|---|
| `AllocationResultModal.tsx` の `U3_term_split_blocked` ラベル | 残置（旧データ表示用） |
| `UnassignedList.tsx` の `U3_term_split_blocked` ラベル | 残置 |
| `RelocationPreviewModal.tsx` の `U3_term_split_blocked` ラベル | 残置 |
| `TimeTableGrid.tsx` の「春秋分離配当」アイコン/警告 | 残置（旧 allocation の `exceptions` 持ち向け） |
| `difficulty.ts` の `termPairFlag` | ロジック共通化、表示はそのまま |

## 8. テスト観点（実装後の確認）

1. **必須化された教室タイプ**: `preferredRoomType: 'pc'` の科目に対し、PC 室が候補ゼロのときに **未配当(`U2_room_type_blocked`) で出てくる**こと。例外配当が発生しないこと。
2. **春秋同一の優先**: 同一 `teacherCode` を持つ春・秋ペア（同曜日・同講時）で、片方が配当済みの状態でもう片方を配当 → **同一教室が選ばれる**（他条件同等のとき）。
3. **春秋同一の中立**: `teacherCode` 未入力ペアでは `term_consistency` スコアが 0/中立、配当に副作用が出ないこと。
4. **前半・後半の対象外**: `spring_first` / `autumn_first` の組合せでは `findTermPartner` が `null` を返すこと。
5. **通年の対象外**: `full_year` で `findTermPartner` が `null`。
6. **CSV ラウンドトリップ**: エクスポート → インポートで `teacherCode` が保持されること。
7. **旧 CSV 互換**: 教員コード列の無い既存 CSV を読み込めること（`teacherCode === ''`）。
8. **ルール設定 UI**: 「準必須」セクションが消え、「必須」に `教室タイプマッチング` が追加表示。希望条件で `春秋同一教室` が `建物希望` の上に並ぶ。
9. **マイグレーション**: 旧 snapshot（`room_type` が `near, enabled: false`）を読み込んだとき、ロード後の rules で `room_type` が `hard, enabled: true` になる。
10. **ビルド**: `RelaxFlags` / `isNearCandidate` 削除に伴う型/呼び出し漏れがないこと。

## 9. 影響範囲まとめ

| ファイル | 変更種別 |
|---|---|
| `src/types.ts` | `Subject.teacherCode?` 追加、`DEFAULT_ALLOCATION_RULES` 改訂、`migrateAllocationRules` 修正 |
| `src/utils/optimizer.ts` | `RelaxFlags`/`isNearCandidate` 削除、`isHardCandidate` 拡張、`findTermPartner` 改訂・export、`getPrefScores` に `term_consistency` 追加、`classifyUnassigned` 整理 |
| `src/utils/difficulty.ts` | `findTermPartner` を optimizer から import |
| `src/utils/csvParser.ts` | `parseSubjectCSV` で `教員コード` 読み込み |
| `src/components/AllocationRuleSettings.tsx` | 「絶対必須」→「必須」、準必須セクション削除、レイアウト 1 カラム化 |
| `src/components/SubjectManager.tsx` | `teacherCode` 列追加（表示・フィルタ・新規追加・エクスポート・ヒント） |
| `src/components/SubjectEditModal.tsx` | 「教員コード」入力フィールド追加 |
| `src/data/mockData.ts` | （任意）サンプルに `teacherCode` を補充 |

## 10. 実装手順（推奨）

1. `types.ts` の `Subject.teacherCode?` 追加 → `DEFAULT_ALLOCATION_RULES` 更新 → `migrateAllocationRules` 修正。
2. `optimizer.ts` の `findTermPartner` を新仕様で書き換え export、`isHardCandidate` 拡張、`RelaxFlags`/`isNearCandidate` 削除、`getPrefScores` に `term_consistency` 追加、`classifyUnassigned` 整理。
3. `difficulty.ts` を optimizer の `findTermPartner` 利用に切り替え。
4. `csvParser.ts` で `教員コード` インポート対応。
5. `SubjectManager.tsx` の列定義・フィルタ・表示・エクスポート・ヒントを一括更新。
6. `SubjectEditModal.tsx` に「教員コード」入力を追加。
7. `AllocationRuleSettings.tsx` の文言統一・準必須セクション削除。
8. ビルド・型チェック → 上記テスト観点で動作確認。

## 11. 懸念点と判断

| 項目 | 判断 |
|---|---|
| 教室タイプ必須化による未配当増 | 許容（要件: 配当不能ケースのあぶり出しが目的） |
| `exceptions: 'room_type_relaxed' / 'term_split'` の旧データ | 表示のみ残置。再配当で自然消滅 |
| 教員コード未入力 | 原則発生しない前提。発生時は春秋同一スコアが中立 |
| 前半/後半ペア | 業務前提で「セットで同教室」のため自動判定対象外 |
| 「例外配当」の概念 | 削除方針。pending/承認フローは新規発火しない |
## 12. teacherCode の安全条件

- `teacherCode` は必須入力とする。
- `9` で始まる `teacherCode` は暫定コードとして扱い、確定コードとは同一視しない。
- 暫定コードは春秋同一教室の自動ペア判定から除外する。
- 自動ペアの候補が複数ある場合や、コードが曖昧な場合はペアにしない。
- 春秋同一教室の判定は、同じ教員コード・曜日・講時の春秋科目を対象にする（通年は一つの科目のため対象外、教員コードが9始まりの暫定コードも対象外）。
