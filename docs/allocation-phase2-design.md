# 教室配当 Phase 2 実装設計書

Phase 1 で配当エンジンを 3層＋辞書式比較に刷新し、`UnassignedInfo` と `Allocation.exceptions` に配当診断情報を持つようになった。
しかし現状の UI はこれを活用していないため、**「なぜそう配当されたか／なぜ配当できなかったか」がユーザに伝わらない**。

Phase 2 のゴールは配当結果の**診断性の向上**である。配当エンジンのロジックは変更せず、UI と状態管理のみを対象とする。

## 0. スコープ

範囲に含める:
- 未配当情報の state 保存と UI 反映
- 未配当カードに U1〜U5 バッジと理由ツールチップ
- 配当カードに例外バッジ（`term_split` / `room_type_relaxed`）
- 配当実行結果のサマリモーダル

範囲に含めない（Phase 3 以降）:
- 例外配当の事前確認モーダル → Phase 3
- 例外解消のための再配当 → Phase 3
- 玉突き再配当 → Phase 4
- 処理順の困難度計算 → Phase 5

## 1. 状態管理の追加

### 1-1. `lastUnassigned` state の追加

現状 `App.tsx` では `unassignedSubjectsAll` を `subjects` と `allocations` の差分から派生計算している。この派生では未配当「理由」を知り得ないため、optimizer 実行結果の `UnassignedInfo[]` を別途 state で保持する。

```typescript
const [lastUnassigned, setLastUnassigned] = useState<UnassignedInfo[]>([]);
```

- `runAutoAllocation` 実行直後に `setLastUnassigned(result.unassigned)` を呼ぶ
- 手動ドラッグで科目が配当された場合はその科目の `UnassignedInfo` を除去
- 科目を手動で外した場合、`lastUnassigned` には反映しない（理由が分からないため）
- localStorage / クラウド同期には**保存しない**（session-local）

### 1-2. `unassignedSubjectsAll` と `lastUnassigned` のマージ

表示時は `unassignedSubjectsAll`（実際に未配当になっている科目）と `lastUnassigned`（最後の自動配当結果）を突き合わせて表示する。

```typescript
const unassignedWithReason = useMemo(() => {
    const reasonMap = new Map(lastUnassigned.map(u => [u.subject.id, u]));
    return unassignedSubjectsAll.map(s => {
        const realId = s._realId || s.id;
        const info = reasonMap.get(realId) || reasonMap.get(s.id);
        return { subject: s, reason: info?.reason, detail: info?.detail };
    });
}, [unassignedSubjectsAll, lastUnassigned]);
```

理由がない（= 自動配当を走らせていない、または手動で外した科目）場合は `reason: undefined` のまま。表示時は「原因不明」扱い。

## 2. UnassignedList への理由バッジ

### 2-1. Props 追加

`UnassignedList` の props に `reasonByRealId?: Map<string, { reason: UnassignedReason; detail?: string }>` を追加、または上記の `unassignedWithReason` 構造を直接受け取る形に変更。

### 2-2. バッジ UI

各未配当カードの右上に小さなバッジを表示:

| reason | ラベル | 色 | 意味 |
|--------|--------|-----|------|
| `U1_no_hard_candidate` | U1 | #d32f2f (赤) | 絶対必須を満たす教室がない |
| `U2_room_type_blocked` | U2 | #f57c00 (橙) | 教室タイプ不一致 |
| `U3_term_split_blocked` | U3 | #fbc02d (黄) | 春秋同一の維持不可 |
| `U4_room_count_short` | U4 | #1976d2 (青) | 必要教室数不足 |
| `U5_swap_failed` | U5 | #7b1fa2 (紫) | 玉突きでも成立せず（Phase 4 用） |

- バッジは hover / click で `detail` をポップオーバー表示
- `reason` がない場合はバッジを出さない

### 2-3. 理由別フィルタ

UnassignedList ヘッダに「理由」プルダウンを追加:
- 全て (既定)
- U1 絶対必須違反のみ
- U2 教室タイプのみ
- U3 春秋同一のみ
- U4 必要教室数不足のみ
- 理由不明 (= 未実行 or 手動外し)

### 2-4. ソート

既存のソート（曜日・講時・優先度など）に加えて「理由の深刻度順」を追加。深刻度 U1 > U3 > U4 > U2 を既定とする（絶対必須違反が最も解消困難なため）。

## 3. TimeTableGrid の配当カードに例外バッジ

### 3-1. 目的

`Allocation.exceptions` に `term_split` / `room_type_relaxed` を持つ配当は、「通常どおりに配当できなかったが例外で入れた」状態。運用上は後で見直したいケースがあるため、視覚的に区別できるようにする。

### 3-2. バッジ仕様

授業カード（`TimeTableGrid` の `DraggableSubject` など）の角に小さなアイコンを表示:

| exception | アイコン | 色 | ツールチップ |
|-----------|----------|-----|-------------|
| `term_split` | 🔀 | #fbc02d | 春秋同一を崩して配当 |
| `room_type_relaxed` | ⚠ | #f57c00 | 教室タイプ不一致で配当 |

- 両方持つ配当は両方のアイコンを横並び
- カード左上または右上に 12〜14px 程度で表示
- `DisplayConfig.showViolationAlerts` がオフの場合は非表示（既存の制約違反アイコンと合わせる）

### 3-3. データの取り回し

`Allocation.exceptions` は Phase 1 で既に保存済み。TimeTableGrid が受け取る allocation から直接参照可能。新規プロパティ追加は不要。

ただし `Allocation` インスタンスを生成している手動ドラッグ経路（`handleDrop` 等）では `exceptions` が付かない。そこでは `exceptions: undefined` のままとする（＝手動配当はバッジなし）。これは意図的で、「手動配当は例外とみなさない」という割り切り。

## 4. 配当結果サマリモーダル

### 4-1. 現状

`App.tsx` の `handleAutoAllocate` 末尾で `alert(...)` でシンプルに件数のみ通知。情報量が少ない。

### 4-2. 置換後

モーダル `AllocationResultModal` を新規作成し、実行結果を構造化して表示する。

```
[配当実行結果]
━━━━━━━━━━━━━━━━━━━━━━━
対象科目: 120件
  配当成功: 105件
    うち例外配当: 8件
      ├ 春秋分離: 5件
      └ タイプ不一致: 3件
  未配当: 15件
    ├ U1 必須違反: 3件
    ├ U2 タイプ: 7件
    ├ U3 春秋: 2件
    └ U4 教室数不足: 3件
━━━━━━━━━━━━━━━━━━━━━━━
[例外配当の一覧を見る] [未配当の一覧を見る] [閉じる]
```

各ボタンは該当する科目にフォーカスするか、フィルタを適用した UnassignedList に遷移する。

### 4-3. モーダル実装

- 既存の `SubjectEditModal` 等と同様の fixed overlay 構造
- 閉じれば `null` に戻す
- `handleAutoAllocate` の末尾で `setAllocationResult(result)` → モーダル表示

### 4-4. アラート置換の段階

Phase 2 では alert → モーダルに置換するが、モーダル内容は上記の件数集計のみで十分。「一覧を見る」は UnassignedList のフィルタを自動適用するだけで、モーダル内に一覧を持たない（情報のスクロール深度を抑える）。

## 5. 修正対象ファイル

| ファイル | 修正内容 | 破壊度 |
|----------|----------|--------|
| `src/App.tsx` | `lastUnassigned` state 追加、自動配当後にセット、UnassignedList へ受け渡し、モーダル表示 | 中 |
| `src/components/UnassignedList.tsx` | 理由バッジ、フィルタ、ソートオプション追加 | 中 |
| `src/components/TimeTableGrid.tsx` | 授業カードに例外バッジ追加（`allocation.exceptions` 参照） | 小 |
| `src/components/AllocationResultModal.tsx` | 新規作成 | 新規 |
| `src/types.ts` | （変更不要）`UnassignedReason` / `UnassignedInfo` は Phase 1 で追加済み | なし |

## 6. 確認観点

### 6-1. 型・ビルド

- `tsc --noEmit` でエラーなし
- `vite build` で警告のみ

### 6-2. 機能

- 自動配当後、未配当カードに正しいバッジが出る
- バッジのツールチップに `detail` が出る
- 理由フィルタで絞り込める
- 例外配当された授業カードにアイコンが出る
- 手動ドラッグで配当された授業カードには例外アイコンが出ない
- サマリモーダルで件数が正しく出る
- 自動配当を再実行すると `lastUnassigned` が更新される
- 手動で科目を外した場合、その科目はバッジなしで表示される（理由不明）

### 6-3. 互換性

- `lastUnassigned` は session-local のため、リロード後はバッジが消える。これは想定動作として UI 上で注釈 or トースト「バッジは自動配当後のみ表示されます」で案内
- クラウド同期には影響なし（state を保存しないため）

## 7. 懸念点

1. **ID 突き合わせの複雑さ**
   `unassignedSubjectsAll` は `_realId` と `id__slot{i}` で展開されている。`UnassignedInfo.subject.id` は optimizer が受け取った時点の id（通常は `_realId` と一致）。突き合わせ時は `_realId` を優先して照合する。

2. **理由の陳腐化**
   自動配当後にユーザがデータ（教室や科目）を変更した場合、`lastUnassigned` の理由は古くなる。「バッジは最後の自動配当時点の情報」と UI で明示する。または state に `lastAllocatedAt: Date` を持ってバッジに「(〇分前時点)」を添えてもよい（Phase 2 のスコープには含めず、余力で）。

3. **手動配当と例外バッジ**
   手動ドラッグでタイプ不一致の教室に入れたケースでは `exceptions` は付かないため、バッジも出ない。これは「手動は自己責任」として許容。必要なら Phase 3 で「手動配当の違反検出」を別途追加する。

4. **バッジの視覚干渉**
   授業カードは既に情報量が多い（教員・過年度・機材タグ等）。例外バッジを足すと視認性が落ちる可能性。`DisplayConfig.showViolationAlerts` のトグルで on/off 可能にする。

---

## 8. Phase 3 以降のロードマップ（概要）

### Phase 3: 例外配当の事前確認・後追い解消

- 自動配当前に「例外配当を許可する前に確認する」ダイアログモードを追加
- 既に配当済みの例外配当を一覧表示し、「再スキャンして解消できないか試す」ボタン
- 手動配当の制約違反（タイプ不一致・定員不足等）の検出と可視化

### Phase 4: 局所玉突き再調整（CODEX 6-3）

- **swap-1**: 未配当科目 X に対し、教室 R を使っている Y を R' に動かせば X が入るなら入替
- **swap-2**: 2段玉突き（Y→R', Z→R''）。深さ 2 固定で探索爆発を抑止
- 入替成立条件:
    - 未配当数が減る or 高優先度を救済できる
    - 例外レベルが悪化しない
    - ハード条件を壊さない
- `UnassignedInfo.reason` に `U5_swap_failed` を正式利用開始

### Phase 5: 配当困難度による処理順ソート（CODEX 4-1）

- 各科目の `difficulty` を算出:
    - 厳密候補数（少ないほど困難）
    - 必須機材数
    - 希少タイプ（pc / seminar）
    - 必要定員
    - 連続講時 / 春秋ペア / 複数室
- ソートキーを `(priority, difficulty, lastUnassignedStreak, importOrder)` に変更
- `lastUnassignedStreak` は直近数回の未配当履歴（session-local or cloud）

### Phase 6（将来）: 手動例外承認フロー

- 自動配当で例外が発生する候補を提示し、ユーザが個別に承認/却下できるフロー
- 承認済み例外は次回以降も尊重する「固定例外」扱い

---

以上。Phase 2 着手時はこの設計書を実装者に渡してください。
