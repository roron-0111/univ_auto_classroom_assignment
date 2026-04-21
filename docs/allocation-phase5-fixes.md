# Phase 5 修正指示（CODEX 戻し）

Phase 5 実装は概ね通過しているが、設計書で明記していた2点が未反映。

---

## 修正1: `ignoreStreakOnce` を UI に接続する

### 背景
設計書 §7-3 で「設定変更後の初回配当は streak を無視するトグル」を挙げた。
型（`AllocationRunOptions.ignoreStreakOnce`）と optimizer 側（`runAutoAllocation` L432）は受け皿済みだが、UI からの流入経路がない。

### ファイルと手順

#### (a) `src/types.ts`
既存の `AllocationOptions` 宣言マージに3つ目の interface を追加（declaration merging）:

```ts
export interface AllocationOptions {
    ignoreStreakOnce?: boolean;
}
```

既存の2つの `AllocationOptions` 宣言（L366, L380）は触らない。

#### (b) `src/components/AllocationRuleSettings.tsx`

1. state を追加:
   ```ts
   const [ignoreStreakOnce, setIgnoreStreakOnce] = useState(false);
   ```

2. `save()` の `onSave(...)` に `ignoreStreakOnce` を含める。

3. リセットボタン（L271-288）の**直上**にチェックボックスを追加:
   ```tsx
   <label style={{ display: 'flex', gap: '8px', alignItems: 'center',
                   border: '1px solid #e5e7eb', borderRadius: '8px',
                   padding: '8px 12px', width: 'fit-content' }}>
     <input
       type="checkbox"
       checked={ignoreStreakOnce}
       onChange={e => setIgnoreStreakOnce(e.target.checked)}
     />
     <span style={{ fontSize: '0.85rem' }}>今回は未配当連続カウントを無視する</span>
   </label>
   ```

   既存「例外配当を実行前に確認する」チェックボックスと同じスタイルに揃えること。

#### (c) `src/App.tsx`

`handleAutoAllocate`（L505〜）および `handleAutoAllocatePhase3`（L565〜）で、
`runAutoAllocation(...)` に渡す options に `ignoreStreakOnce: options.ignoreStreakOnce` を追加:

```ts
// handleAutoAllocate L551
const result = runAutoAllocation(
  targetSubjects, classrooms, preservedAllocations, rulesToUse, equipmentToUse,
  { streakMap, ignoreStreakOnce: options.ignoreStreakOnce }
);

// handleAutoAllocatePhase3 L613-620
const result = runAutoAllocation(
  targetSubjects, classrooms, preservedAllocations, rulesToUse, equipmentToUse,
  { dryRunExceptions: confirmExceptions, streakMap, ignoreStreakOnce: options.ignoreStreakOnce }
);
```

### 確認観点
- チェックON + 配当実行 → 困難度トップ10 の streak 値が反映されていない（= 0扱い）
- チェックOFF（既定）→ 従来通り streak 加算が効く
- チェック状態は都度リセット（モーダルを開き直すと OFF）で OK

---

## 修正2: 再配置確定時に streak を更新する

### 背景
`handleConfirmRelocation`（App.tsx L732-747）は relocation 成功後に
`updateStreakAfterAllocation` を呼ばない。relocate だけで解消した科目の streak が
次回 auto-allocation まで残る（整合性欠如）。

### ファイルと手順

#### `src/App.tsx` `handleConfirmRelocation`

`setPendingRelocationBatch(null)` の**前**に以下を追加:

```ts
const attemptedSubjects = pendingRelocationBatch.sourceUnassigned.map(item => item.subject);
updateStreakAfterAllocation(attemptedSubjects, result.unassigned);
setStreakRevision(v => v + 1);
```

具体的には：

```ts
const handleConfirmRelocation = () => {
  if (!pendingRelocationBatch) return;

  const result = pendingRelocationBatch.result;
  setAllocations(result.allocations);
  setLastUnassigned(result.unassigned);
  setAutoAllocationSummary({
    targetCount: pendingRelocationBatch.sourceUnassigned.length,
    preservedCount: result.allocations.length - result.placed.length,
    newlyAllocatedCount: result.placed.length,
    unassigned: result.unassigned,
    difficultyTop10: []
  });

  // 追加: 再配置で解消した科目の streak をクリア
  const attemptedSubjects = pendingRelocationBatch.sourceUnassigned.map(item => item.subject);
  updateStreakAfterAllocation(attemptedSubjects, result.unassigned);
  setStreakRevision(v => v + 1);

  setPendingRelocationBatch(null);
  setShowRelocationPreviewModal(false);
};
```

### 確認観点
- 未配当2件のうち1件が relocation で解消された場合、解消した側の streak が消え、
  残った側の streak は据え置き（= 増えも減りもしない）
- relocation プレビューをキャンセル（`handleCancelRelocation`）した場合は streak を変更しない

---

## 留意

- 型やビルドが壊れていないことを `npx tsc --noEmit` と `npx vite build` で確認してほしい。
- 既存 UI 文言・操作感の変更は上記トグル追加以外はしない。
- 修正の粒度は最小差分で。機能追加や周辺リファクタはしない。
