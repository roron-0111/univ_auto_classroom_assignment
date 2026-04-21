# Phase 6 設計: 承認済み例外の永続化

## 1. 目的と現状の課題

### 現状
Phase 3 で `ExceptionReviewModal` による例外承認／却下フローを導入し、承認された例外は `Allocation.exceptions: Array<'term_split' | 'room_type_relaxed'>` として保存される。
ただし「ユーザがその例外配当を承認した」という事実は永続化されておらず、以下の問題がある。

1. 同一科目・同一教室で再度 auto-allocation を実行すると、既に承認済みの例外でも再度 `ExceptionReviewModal` に出てくる（再確認ループ）。
2. 承認判断は人の意思決定を伴うため、履歴として残るべき情報（業務用途では「誰が／いつ」を含めたいが本Phaseでは範囲外）。
3. `resolveExceptions` が承認済みか未承認かを区別できないため、ユーザが承認した例外配当まで解消対象として動かしてしまう可能性がある。

### ゴール
- 承認された例外配当を `Allocation` 単位で永続化
- 次回 auto-allocation で、同一の例外（同一科目・同一教室・同一例外種別）は `dryRunExceptions` の再確認フローから自動的に除外
- `resolveExceptions`（例外再スキャン）では**承認済み例外をスキップ**
- cloud 同期対象に含める
- 既存データ（`exceptionApproved` を持たない Allocation）との後方互換を保つ

## 2. データモデル変更

### 2-1. `Allocation` への追加

```ts
export interface Allocation {
    subjectId: string;
    classroomId: string;
    isLocked?: boolean;
    exceptions?: Array<'term_split' | 'room_type_relaxed'>;
    exceptionApproved?: boolean; // ★ NEW
}
```

**意味論**:
- `exceptionApproved === true` 且つ `exceptions.length > 0`: ユーザが例外配当を明示承認済み
- `exceptionApproved === undefined/false` 且つ `exceptions.length > 0`: 未承認、または Phase 6 以前のレガシー配当
- `exceptions` が空／undefined のとき `exceptionApproved` は意味を持たない（保持しても害はないが保存時は落とす）

**後方互換**:
- 既存 snapshot に `exceptionApproved` が無くても読み込める（optional）
- **暗黙承認**: Phase 6 以前の保存データは「ユーザが何らかの判断を経て保存したはず」と解釈し、**ロード時に `exceptions.length > 0` && `exceptionApproved === undefined` のものは承認済みとして扱う**方針を推奨（再確認ループを避ける）。
  - 代替案: undefined を未承認とみなし、初回 auto-allocation で再確認フローが走る。手間だが明示性は高い。
  - **本Phaseでは前者を採用**（理由: 業務上の破壊的変更を避ける / 既に使われていた例外を全て再承認させるのは運用上許容されない）。

### 2-2. `CloudData` への影響

`CloudData.allocations: Allocation[]` は型共有されているため、`exceptionApproved` は自動的に cloud 同期の往復に乗る。**追加実装不要**。
ただし既存 cloud データの後方互換は 2-1 の暗黙承認ルールに従う。

## 3. 配当ロジックへの反映

### 3-1. `runAutoAllocation`（再配当時の扱い）

#### 現状
`preservedAllocations = allocations.filter(a => !targetSubjects.some(s => s.id === a.subjectId))` で、対象科目の既存配当はクリアされてから再配当される。再配当時に新規に発生した例外が `dryRunExceptions` の対象となり再確認される。

#### 変更
`runOptions` に**承認履歴**を受け渡す仕組みを追加:

```ts
export interface AllocationRunOptions {
    // ...既存...
    approvedExceptions?: Set<string>; // ★ NEW
}
```

キー形式: `${subjectId}__${classroomId}__${exceptionsSorted.join('|')}`
（例: `s001__r023__room_type_relaxed` / `s001__r023__room_type_relaxed|term_split`）

`pendingExceptions` を生成する箇所（L541-548）で、承認履歴に合致するものは pending に積まない:

```ts
if (runOptions.dryRunExceptions && chosen.exceptions.length > 0) {
    const key = buildApprovalKey(subject.id, chosen.room.id, chosen.exceptions);
    if (!runOptions.approvedExceptions?.has(key)) {
        pendingExceptions.push({ ... });
    }
    // 既に承認済みの場合は自動承認扱いで pending に積まない
}
```

さらに、採択された allocation 自体にも承認状態を刻印するため、`Allocation` 生成部（L530-534）を更新:

```ts
const allocation: Allocation = {
    subjectId: subject.id,
    classroomId: chosen.room.id,
    exceptions: chosen.exceptions.length > 0 ? [...chosen.exceptions] : undefined,
    exceptionApproved:
        chosen.exceptions.length > 0 && runOptions.approvedExceptions?.has(buildApprovalKey(...))
            ? true
            : undefined
};
```

未承認のものは `exceptionApproved: undefined` で返り、`handleConfirmExceptionReview` 側で承認フローを通したものが最終的に `true` へ昇格する（3-3 参照）。

### 3-2. `resolveExceptions`（例外解消スキャン）

#### 現状
`exceptions.length > 0` の全 allocation を対象に再スキャン。

#### 変更
承認済みはスキップ:

```ts
const exceptionalAllocations = result.filter(a =>
    a.exceptions && a.exceptions.length > 0 && !a.exceptionApproved
);
```

解消が成功したとき、allocation から `exceptions` と `exceptionApproved` の**両方を消す**（L627 付近）。

### 3-3. `handleConfirmExceptionReview`（App.tsx）

承認された pending exception に対応する allocation の `exceptionApproved` を `true` にする:

```ts
const handleConfirmExceptionReview = (approvedKeys: string[]) => {
    if (!pendingAllocationBatch) return;
    const approvedSet = new Set(approvedKeys);
    const rejectedPending = pendingAllocationBatch.pendingExceptions
        .filter(item => !approvedSet.has(pendingExceptionKey(item)));

    // ★ NEW: 承認された allocation に exceptionApproved を立てる
    const approvedAllocationsResult: OptimizerResult = {
        ...pendingAllocationBatch.result,
        allocations: pendingAllocationBatch.result.allocations.map(alloc => {
            if (!alloc.exceptions || alloc.exceptions.length === 0) return alloc;
            const key = `${alloc.subjectId}__${alloc.classroomId}`;
            const isApproved = approvedSet.has(key);
            return { ...alloc, exceptionApproved: isApproved ? true : undefined };
        })
    };

    finalizeAutoAllocation(
        approvedAllocationsResult,
        pendingAllocationBatch.targetCount,
        pendingAllocationBatch.preservedCount,
        rejectedPending,
        pendingAllocationBatch.attemptedSubjects,
        pendingAllocationBatch.difficultyTop10
    );
};
```

**注意**: `pendingExceptionKey` の生成規則を揃える必要あり。現状 `${subjectId}__${classroomId}` で生成しているなら、`exceptions` の並びまで含めるように統一する（複数例外が同時に発生する可能性があるため）。

### 3-4. `handleAutoAllocate` / `handleAutoAllocatePhase3`（承認履歴のロード）

再配当前に既存 allocation から承認履歴を抽出して runOptions に渡す:

```ts
const approvedExceptions = new Set(
    allocations
        .filter(a => a.exceptionApproved && a.exceptions && a.exceptions.length > 0)
        .map(a => buildApprovalKey(a.subjectId, a.classroomId, a.exceptions!))
);

const result = runAutoAllocation(
    targetSubjects, classrooms, preservedAllocations, rulesToUse, equipmentToUse,
    { streakMap, ignoreStreakOnce: options.ignoreStreakOnce, approvedExceptions }
);
```

**スコープ**: `preservedAllocations` に含まれる（= 再配当対象外の）allocation の承認は自動的に維持される。再配当対象の科目が再度同じ教室・同じ例外で配当された場合、承認済みとみなして再確認をスキップする。

## 4. UI への反映

### 4-1. `ExceptionReviewModal`

- 初期状態「承認」一律から、**事前に承認履歴にあるものは「承認済み（編集不可）」として表示**にする設計も検討可能だが、Phase 6 では自動スキップするため、そもそもモーダルに出てこない。
- 結果として**承認履歴に合致するものはモーダル自体が出ない**（pendingExceptions が空なら現在の実装でもモーダルは開かれない）。

### 4-2. 例外一覧の可視化（任意機能）

承認履歴の管理画面が欲しい場合は、`TimeTableGrid` のセルにバッジ（例: ⚠承認済み）を表示するか、`AllocationRuleSettings` に「承認済み例外一覧」のセクションを置く。
**本Phaseのコア要件ではないため範囲外とする**。実装最小差分優先。

### 4-3. 承認リセット

以下2箇所を用意する:

1. **個別リセット**: タイムテーブル上で allocation を右クリック／詳細モーダルに「承認を取り消す」ボタン。次回配当時に再確認対象になる。
2. **一括リセット**: `AllocationRuleSettings` に「承認済み例外をすべて再確認対象に戻す」ボタン（streak リセットの隣）。

**本Phaseでは一括リセットのみを実装**（個別リセットは UX 要検討でスコープ外とする）。

## 5. `pendingExceptionKey` の統一

現状の `pendingExceptionKey`（App.tsx 内ユーティリティ）は `${subjectId}__${classroomId}` と想定される。Phase 6 では同一科目・同一教室で複数例外パターンが起こり得るため、キーを以下で統一する:

```ts
const pendingExceptionKey = (item: { subject: { id: string }; classroomId: string; exceptions: string[] }) =>
    `${item.subject.id}__${item.classroomId}__${[...item.exceptions].sort().join('|')}`;
```

同じ関数を `buildApprovalKey(subjectId, classroomId, exceptions)` としてもエクスポート。`optimizer.ts` と `App.tsx` の両方で共有する（`src/utils/approvalKey.ts` 新設）。

## 6. 実装差分サマリ

| ファイル | 変更内容 | 差分規模 |
|---|---|---|
| `src/types.ts` | `Allocation.exceptionApproved?: boolean`, `AllocationRunOptions.approvedExceptions?: Set<string>` | 小 |
| `src/utils/approvalKey.ts` | 新規: `buildApprovalKey` ユーティリティ | 新規・小 |
| `src/utils/optimizer.ts` | `runAutoAllocation` で `approvedExceptions` を使い pending から除外・`exceptionApproved` を刻印。`resolveExceptions` で承認済みスキップ | 中 |
| `src/App.tsx` | `handleAutoAllocate` / `handleAutoAllocatePhase3` で承認履歴を抽出して渡す。`handleConfirmExceptionReview` で `exceptionApproved` を立てる。一括リセットハンドラ追加 | 中 |
| `src/components/AllocationRuleSettings.tsx` | 「承認済み例外をすべてリセット」ボタン追加 | 小 |
| `src/utils/useCloudSync.ts` | 変更なし（型共有で自動対応） | ― |

## 7. 確認観点

### 7-1. 型・ビルド
- `tsc --noEmit` エラーなし
- `vite build` 警告のみ

### 7-2. 機能
- 承認済み例外は再配当で再確認されない
- 承認を却下した例外は、次回も再確認対象として現れる
- `resolveExceptions` は承認済みの allocation を動かさない
- 一括リセット後、次回 auto-allocation で全例外が再確認対象になる

### 7-3. 後方互換
- Phase 6 以前の snapshot をロード → 既存の `exceptions` 付き allocation は**暗黙承認**扱い
- cloud 同期でロードした古いデータも同様に動く
- 一度 Phase 6 を経て保存した snapshot を、Phase 5 以前のコードでロードしてもクラッシュしない（`exceptionApproved` は未知の optional フィールドとして無視される）

### 7-4. 回帰
- Phase 5 の difficulty / streak 連動に影響しない
- Phase 4 の relocation は承認状態を保持したまま教室移動できる（`exceptionApproved` と新教室のペアは意味が変わるため、**relocation 後は `exceptionApproved` をクリアする**のが安全）
- Phase 3 の `dryRunExceptions=false` ルート（確認なし配当）は `approvedExceptions` を参照せず、全例外を無条件承認として保存する

## 8. 懸念点

### 8-1. relocation と承認の整合性
`relocateForUnassigned` で別教室へ移動した allocation の `exceptionApproved` をどう扱うか。
**方針**: 教室が変わったら承認の前提が崩れるので `exceptionApproved = undefined` にリセットし、次回再確認対象にする。
実装箇所: `optimizer.ts` の `addAllocationToState` または relocation 結果構築部で新 allocation を作る際に継承しない。

### 8-2. 暗黙承認の是非
「Phase 6 以前のデータは承認済みとみなす」は運用の現実解だが、ログ上「ユーザが承認したのかシステムが自動承認したのか」区別がつかない。
**対策（任意）**: ロード時に `exceptionApproved: true` ではなく `exceptionApproved: 'legacy'` のようなタグを入れる。ただし型が複雑化するため Phase 6 では採用しない。

### 8-3. `pendingExceptionKey` 変更の影響範囲
既存の `pendingExceptionKey` を参照している箇所があれば、全て新形式に揃える必要がある。
App.tsx の `handleConfirmExceptionReview` / `finalizeAutoAllocation` の呼び出し経路、`ExceptionReviewModal` の内部キー生成を確認・統一すること。

### 8-4. 例外の種類追加への備え
現状 `'term_split' | 'room_type_relaxed'` の 2 種類。将来追加時に `buildApprovalKey` のソート規則が安定していれば影響小。Set ベースにしているため拡張可能。

## 9. ロードマップ位置づけ

- Phase 6: 本設計書（承認済み例外の永続化）
- Phase 7: 複数シナリオ比較（必要性は Phase 6 完了後に再検討）
- ~~Phase 8: 配当履歴ログ~~ → 不要と判断、スコープから除外

Phase 6 完了をもって配当アルゴリズムの中核設計は一旦完結の見込み。

---

以上。実装者（CODEX）に渡すこと。
