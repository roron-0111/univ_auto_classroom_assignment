# 教室配当 Phase 4 実装設計書

Phase 1〜3 で「3段階ルール・未配当理由・例外承認・例外解消・手動違反検出」まで揃った。
Phase 4 のゴールは **未配当科目を救済するための局所玉突き再調整（swap）**。

## 0. スコープ

範囲に含める:
- swap-1（深さ1の玉突き）: 未配当 X を入れるため、既存配当 Y を別の教室 R' に動かす
- swap-2（深さ2の玉突き・固定）: Y をどこにも動かせないとき、Y を動かすために Z をさらに動かす
- 入替成立条件・コスト関数（hard 維持、例外レベル非悪化）
- 「再調整」ボタン＋結果表示

範囲に含めない:
- 深さ3以上の探索（計算量上限 & UX 上の逆可読性のため）
- 完全な mixed-integer programming 最適化
- 並列 swap（同時に複数未配当を救済）

## 1. 動機と現状

### 1-1. Phase 3 までの未配当

未配当理由 U1〜U5 のうち、**U4_room_count_short / U1_no_hard_candidate の一部は玉突きで救えることがある**。
（例: 未配当 X が室Aだけに入るが、今は科目 Y が室Aを占有。Y を室Bに移せば X が入る）

現状の optimizer は priority 降順＋元順で greedy に確定しており、後続科目の救済のために前確定を覆さない。
Phase 4 はこの局所逆戻しを入れる。

### 1-2. 設計方針

- **追加関数で独立実装**: `runAutoAllocation` には手を入れず、事後処理 `relocateForUnassigned(...)` を追加
- **明示的ユーザ起動**: 自動では呼ばず、ボタンで起動（Phase 3 の `resolveExceptions` と同じ UX）
- **hard/near を壊さない**: 厳密候補のみ採用、例外レベルは現状以下に留める
- **決定論**: 同じ入力から常に同じ結果。seed なし。

## 2. 探索アルゴリズム

### 2-1. swap-1

```
入力: unassignedSubjects, allocations, subjects, classrooms, rules
出力: patch = { moves: [(subjectId, fromRoom, toRoom) ...], placed: [(subjectId, roomId)] }

for each X in unassignedSubjects (U4, U1 の一部を優先):
    hardRooms_X = X を入れられる教室一覧（hard のみ）
    for each R in hardRooms_X:
        blockers_R = R が X の時間帯に使われている配当
        for each Y in blockers_R:
            altRooms_Y = Y を移動できる教室（R 以外、hard + Y の現 near を維持）
            for each R' in altRooms_Y:
                if cost(move(Y, R→R') + place(X, R)) < 0:
                    apply patch and break
```

### 2-2. swap-2

swap-1 で `altRooms_Y` が空の場合に限り深さ 2 を試す:

```
for each Y in blockers_R:
    for each R' in 候補教室:  // 例外を許容しない厳密候補
        blockers_R'_byY = R' が Y の時間帯に使われている配当
        for each Z in blockers_R'_byY:
            altRooms_Z = Z を移動できる教室（R および R' 以外）
            for each R'' in altRooms_Z:
                if cost(move(Z, R'→R'') + move(Y, R→R') + place(X, R)) < 0:
                    apply patch and break
```

### 2-3. 探索打ち切り

- `MAX_CHAIN_DEPTH = 2`（定数）
- 各 X について、最初の「受理できる連鎖」を即採用（局所貪欲）
- 1 回の再調整実行で救済できるのは `N` 件（既定 = 無制限だが 5 分タイムアウト）

## 3. 受理条件（cost 関数）

入替は以下を**すべて満たす**ときのみ採用:

1. **hard 非違反**: 移動先 R'/R'' は hard を満たす
2. **例外レベル非悪化**:
   - Y が例外なしだった → R' も例外なし
   - Y が例外 1 つ → R' の例外は同種か例外なし（増やさない）
3. **未配当数の非増加**: 最終状態で未配当数が減る OR 不変（高優先度を優先した場合のみ不変可）
4. **pref スコア非大幅悪化**:
   - 連鎖対象科目の pref 辞書式スコアの合計が 「未許容閾値」以上に落ちない
   - 閾値: 最上位 pref (teacher_continuity) が `1→0` になる移動は拒否。それ以外の下降は許容。
   - これは「連続授業を分離してまで X を救う」のを防ぐための安全弁。

### 3-1. コスト計算

```
benefit = (救済できた未配当の priority 合計)
cost = 0
for each (Y, from, to) in chain:
    prefDelta = sum(prefScores(Y, to) - prefScores(Y, from))
    cost += prefDelta * penaltyWeight(Y)  // penaltyWeight = priority 重み

採用条件: benefit > cost AND 条件 1〜4 を満たす
```

## 4. 実装構造

### 4-1. 新規関数

`src/utils/optimizer.ts` に追加:

```typescript
export interface RelocationMove {
    subjectId: string;
    fromRoomId: string;
    toRoomId: string;
}

export interface RelocationPlacement {
    subjectId: string;
    roomId: string;
}

export interface RelocationResult {
    allocations: Allocation[];
    unassigned: UnassignedInfo[];
    moves: RelocationMove[];
    placed: RelocationPlacement[];
    unresolved: UnassignedInfo[]; // 救えなかった未配当
}

export const relocateForUnassigned = (
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    unassigned: UnassignedInfo[],
    rules: AllocationRule[],
    equipmentSettings?: EquipmentSettings,
    options?: { maxDepth?: 1 | 2; timeoutMs?: number }
): RelocationResult => { /* ... */ };
```

- `maxDepth` 既定 2、1 なら swap-1 のみ
- `timeoutMs` 既定 30000（30秒）
- tight loop は `performance.now()` で経過時間監視、超過で打ち切り

### 4-2. ヘルパー抽出

以下を private に切り出し（Phase 3 で書いた既存関数の再利用）:
- `isHardCandidate` → そのまま流用
- `isNearCandidate` → そのまま流用（relaxFlags を引数で制御）
- `getRoomOccupiedKeys` / `markAllocation` / `unmarkAllocation` → そのまま流用
- `pickBestCandidate` → 移動先選定に流用（relax=false で呼び出す）

新規追加:
- `findBlockers(room, subject, allocations, subjects)`: 指定教室・時間帯に重なる既存配当を返す
- `computePrefDelta(subject, fromRoom, toRoom, ...)`: 辞書式スコアの差分

### 4-3. App.tsx 統合

`AllocationResultModal` 下部に「未配当を再調整する」ボタンを追加:

```tsx
<button
  onClick={handleRelocate}
  disabled={relocating || summary.unassigned.length === 0}
>
  {relocating ? '再調整中...' : '未配当を再調整（玉突き）'}
</button>
```

ハンドラ:

```typescript
const handleRelocate = () => {
    const result = relocateForUnassigned(subjects, classrooms, allocations, lastUnassigned, allocationSettings, equipmentSettings);
    setAllocations(result.allocations);
    setLastUnassigned(result.unassigned);
    setAutoAllocationSummary({
        targetCount: result.placed.length + result.unresolved.length,
        preservedCount: allocations.length - result.moves.length,
        newlyAllocatedCount: result.placed.length,
        unassigned: result.unassigned
    });
    setRelocationReport({ moves: result.moves, placed: result.placed, unresolved: result.unresolved });
};
```

### 4-4. 結果表示モーダル（新規 or 既存モーダル拡張）

```
[玉突き再調整の結果]
━━━━━━━━━━━━━━━━━━━━━━━
救済: 3件
  ├ [授業A] 7号館501 に配当（Y1 を 7号館503 へ移動）
  ├ [授業B] 3号館102 に配当（Y2 を 3号館104 へ移動、Z1 を 3号館106 へ移動）
  └ [授業C] 7号館301 に配当

未救済: 2件
  ├ [授業D] (U1: 必須条件不足)
  └ [授業E] (U4: 教室数不足)

再配置された科目: 4件
  ├ Y1: 7号館501 → 7号館503
  └ ...
━━━━━━━━━━━━━━━━━━━━━━━
[取り消し] [確定]
```

重要: **確定前にプレビュー**できるようにする。
- `relocateForUnassigned` は patch を返すが commit はしない
- 「確定」押下で `setAllocations` 実行
- 「取り消し」で patch 破棄

## 5. U5 の正式利用

Phase 4 以降、`relocateForUnassigned` で救えなかった科目は **`U5_swap_failed`** に再分類:

```typescript
for (const u of unresolved) {
    if (u.reason === 'U1_no_hard_candidate' || u.reason === 'U4_room_count_short') {
        u.reason = 'U5_swap_failed';
        u.detail = '玉突き再調整でも配当できなかった';
    }
}
```

U2/U3 は例外配当の話なので U5 には変えない。

## 6. 修正対象ファイル

| ファイル | 修正内容 | 破壊度 |
|----------|----------|--------|
| `src/utils/optimizer.ts` | `relocateForUnassigned`、`findBlockers`、`computePrefDelta` 追加 | 中 |
| `src/App.tsx` | `handleRelocate` ハンドラ、プレビュー state、結果モーダル表示切替 | 中 |
| `src/components/AllocationResultModal.tsx` | 「玉突き再調整」ボタン追加、プレビューモード対応 | 小 |
| `src/components/RelocationPreviewModal.tsx` | 新規: 再調整結果プレビュー | 新規 |
| `src/types.ts` | `RelocationResult` 等のエクスポート | 小 |

## 7. 確認観点

### 7-1. 型・ビルド
- `tsc --noEmit` エラーなし
- `vite build` 警告のみ

### 7-2. 機能（swap-1）
- 未配当 1 件が既存 1 件を動かして救えるケースで成立
- 動かせる代替がないケースでは X は U5 のまま
- 動いた Y の pref スコアが多少落ちても、許容閾値内なら採用
- Y の pref が teacher_continuity=1→0 になる移動は拒否される

### 7-3. 機能（swap-2）
- swap-1 で解けないが swap-2 で解けるケースで成立
- Y→Z の連鎖中に hard 違反が起きる組み合わせは除外される
- `maxDepth=1` を指定すると swap-2 は試みない

### 7-4. 非破壊性
- 再調整をキャンセルすると元の状態に完全に戻る
- 既存の例外配当（Phase 3 で付いた `exceptions`）は維持される
- 教員ロック（`isLocked`）が付いた配当は移動対象外

### 7-5. パフォーマンス
- 未配当 50 件、教室 200 室規模で 30 秒以内に完了
- タイムアウト時は部分結果を返す（途中までの救済を確定できる）

## 8. 懸念点

1. **探索空間の爆発**
   swap-2 の組み合わせ数は O(N² × R²)。科目 300 × 教室 200 で約 3.6×10⁹。
   対策: hard フィルタで早期枝刈り、未配当の priority 降順で処理、最初のヒットで採用。

2. **連鎖の副作用**
   Y を動かすと Y 自身の春秋ペア（term_consistency）が壊れる可能性。
   対策: Y の現在の exceptions 配列をチェックし、`term_split` が新たに発生する移動は受理しない。

3. **教員ロック・手動配当の扱い**
   ユーザが手動配置した / `isLocked=true` の配当は自動で動かさない。
   対策: `blockers` 抽出時に `!alloc.isLocked` でフィルタ。

4. **プレビュー前の State 整合性**
   プレビュー中に他の操作（ドラッグ等）が入ると整合性が壊れる。
   対策: プレビュー表示中は配当編集を無効化（モーダル背景をブロック）。

5. **UX: 何が起きたか分かりにくい**
   「Y が別教室に移った」ことをユーザが把握しづらい。
   対策: 移動した科目カードに一時的に青枠 + 「←再調整で移動」バッジを 10 秒表示。

## 9. Phase 5 以降のロードマップ（概要）

Phase 4 完了後の次ステップ:

### Phase 5: 配当困難度による処理順ソート

- 各科目の `difficulty` を事前算出:
    - 厳密候補数（少ないほど困難）
    - 必須機材数
    - 希少タイプ（pc / seminar）
    - 必要定員比率
    - 連続講時 / 春秋ペア / 複数室フラグ
- ソートキーを `(priority, difficulty, lastUnassignedStreak, importOrder)` に変更
- `lastUnassignedStreak` は前回配当時に未配当だった回数（session-local、後に cloud 永続化）

### Phase 6: 承認済み例外の永続化

- Phase 3 で承認した例外を `Allocation.exceptionApproved?: boolean` として記録
- 次回配当時は承認済みを尊重して再確認しない
- ユーザが明示リセットで再確認モードに戻す

### Phase 7（将来）: 複数シナリオ比較

- 同じ設定で複数回実行し、結果の差異を並べて比較
- 「どの設定の組み合わせが最良か」を探る実験機能

---

以上。Phase 4 着手時はこの設計書を実装者に渡してください。
