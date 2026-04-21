# 教室配当 Phase 5 実装設計書

Phase 4 で未配当救済の玉突きまで揃った。Phase 5 のゴールは **配当順の改善**。

## 0. スコープ

範囲に含める:
- 各科目の「配当困難度（difficulty）」を事前算出
- `runAutoAllocation` の処理順ソートキー刷新
- 「前回未配当」の連鎖回数カウンタ（session-local）
- 困難度内訳の可視化（デバッグ用サイドパネル）

範囲に含めない:
- `difficulty` を UI で編集可能にする（読み取り専用）
- 永続化された `lastUnassignedStreak`（Phase 6 に送る）

## 1. 動機

現状の処理順は `(priority DESC, index ASC)`。
困難な科目（候補が少ない・必須機材が多い）が priority=1 の一般科目に埋もれて、
あとから処理された結果、先に priority=1 の科目に広い room を取られて未配当に落ちる問題がある。

Phase 5 では **priority を最優先としつつ、その下で困難な科目を先に処理する**。

## 2. difficulty の算出

### 2-1. 構成要素

| 要素 | 算出 | 重み |
|------|------|------|
| `strictCandidateCount` | hard のみ満たす教室数（近似値）| ×1（少ないほど困難） |
| `mandatoryEquipmentCount` | `mandatoryEquipment` の数 | ×3 |
| `requiredEquipmentWeight` | `requiredEquipment` の importance 合計 | ×0.5 |
| `rareRoomTypeFlag` | pc / seminar なら 1 | ×5 |
| `capacityPressure` | requiredCapacity / 中央値（0〜2） | ×2 |
| `continuityFlag` | endPeriod > period なら 1 | ×3 |
| `termPairFlag` | 春秋ペアあり | ×2 |
| `multiRoomFlag` | requiredRoomCount > 1 | ×4 |
| `lastUnassignedStreak` | 前回未配当で積み上がった連続回数 | ×2 |

### 2-2. 算出関数

`src/utils/difficulty.ts` 新規作成:

```typescript
export interface DifficultyBreakdown {
    strictCandidateCount: number;
    mandatoryEquipmentCount: number;
    requiredEquipmentWeight: number;
    rareRoomTypeFlag: boolean;
    capacityPressure: number;
    continuityFlag: boolean;
    termPairFlag: boolean;
    multiRoomFlag: boolean;
    lastUnassignedStreak: number;
    score: number;
}

export const computeDifficulty = (
    subject: Subject,
    subjects: Subject[],
    classrooms: Classroom[],
    rules: AllocationRule[],
    equipmentSettings: EquipmentSettings | undefined,
    streakMap: Map<string, number>
): DifficultyBreakdown => {
    // 1. strictCandidateCount: hard だけで候補数
    const strictCandidates = classrooms.filter(room =>
        !room.isExcluded &&
        room.capacity >= subject.requiredCapacity &&
        (subject.mandatoryEquipment || []).every(req => matchesEquipment(room, req))
    );
    const strictCandidateCount = strictCandidates.length;

    // 2. 中央値を使って capacity pressure を算出
    const sortedCapacity = [...classrooms].map(r => r.capacity).sort((a, b) => a - b);
    const median = sortedCapacity[Math.floor(sortedCapacity.length / 2)] || 1;
    const capacityPressure = Math.min(2, subject.requiredCapacity / median);

    // 3. 必須機材の importance 合計
    const requiredEquipmentWeight = (subject.requiredEquipment || []).reduce((sum, req) => {
        const imp = getRequirementImportance(req, equipmentSettings);
        return sum + imp;
    }, 0);

    // 4. 希少教室タイプ
    const rareRoomTypeFlag = subject.preferredRoomType === 'pc' || subject.preferredRoomType === 'seminar';

    // 5. 連続講時／春秋ペア／複数室
    const continuityFlag = (subject.endPeriod || subject.period) > subject.period;
    const termPairFlag = !!findTermPartner(subject, subjects);
    const multiRoomFlag = (subject.requiredRoomCount || 1) > 1;

    // 6. 前回未配当連続回数
    const lastUnassignedStreak = streakMap.get(subject.id) || 0;

    // 7. スコア合成（高いほど困難）
    const score =
        (classrooms.length - strictCandidateCount) * 1 +
        (subject.mandatoryEquipment?.length || 0) * 3 +
        requiredEquipmentWeight * 0.5 +
        (rareRoomTypeFlag ? 5 : 0) +
        capacityPressure * 2 +
        (continuityFlag ? 3 : 0) +
        (termPairFlag ? 2 : 0) +
        (multiRoomFlag ? 4 : 0) +
        lastUnassignedStreak * 2;

    return {
        strictCandidateCount,
        mandatoryEquipmentCount: subject.mandatoryEquipment?.length || 0,
        requiredEquipmentWeight,
        rareRoomTypeFlag,
        capacityPressure,
        continuityFlag,
        termPairFlag,
        multiRoomFlag,
        lastUnassignedStreak,
        score
    };
};
```

### 2-3. ソートキー

`runAutoAllocation` の `sortedSubjects` 生成を次のように変更:

```typescript
const streakMap = getLastUnassignedStreakMap(); // session-local から取得

const sortedSubjects = [...subjects].map((subject, index) => ({
    subject,
    index,
    difficulty: computeDifficulty(subject, subjects, classrooms, rules, equipmentSettings, streakMap)
})).sort((a, b) => {
    // 1. priority DESC
    const priorityDiff = (b.subject.priority || 1) - (a.subject.priority || 1);
    if (priorityDiff !== 0) return priorityDiff;

    // 2. difficulty DESC（困難な方を先に）
    const diffDiff = b.difficulty.score - a.difficulty.score;
    if (diffDiff !== 0) return diffDiff;

    // 3. streak DESC（前回未配当連続が多いほど先）
    const streakDiff = b.difficulty.lastUnassignedStreak - a.difficulty.lastUnassignedStreak;
    if (streakDiff !== 0) return streakDiff;

    // 4. index ASC（インポート順）
    return a.index - b.index;
});
```

### 2-4. difficulty の計算タイミング

- 全科目分を **配当実行時に一度だけ**計算（O(N × R)）
- React で useMemo にはしない（配当実行時のみ必要なため）

## 3. lastUnassignedStreak

### 3-1. 概念

配当を実行するたびに:
- 成功（配当された）→ `streak = 0`
- 未配当（救えなかった）→ `streak += 1`

次回配当時のソートで困難度に加味される。これにより、**たまたま未配当になり続ける科目が徐々に優先される**ようになる。

### 3-2. Session-local 永続化

`src/utils/unassignedStreak.ts` 新規:

```typescript
const STREAK_KEY = 'subjectRoom_unassignedStreak';

export const loadStreakMap = (): Map<string, number> => {
    try {
        const raw = sessionStorage.getItem(STREAK_KEY);
        if (!raw) return new Map();
        return new Map(Object.entries(JSON.parse(raw)));
    } catch {
        return new Map();
    }
};

export const saveStreakMap = (map: Map<string, number>) => {
    const obj: Record<string, number> = {};
    map.forEach((v, k) => { obj[k] = v; });
    sessionStorage.setItem(STREAK_KEY, JSON.stringify(obj));
};

export const updateStreakAfterAllocation = (
    allAttempted: Subject[],
    unassigned: UnassignedInfo[]
): Map<string, number> => {
    const map = loadStreakMap();
    const unassignedIds = new Set(unassigned.map(u => u.subject.id));
    for (const subject of allAttempted) {
        if (unassignedIds.has(subject.id)) {
            map.set(subject.id, (map.get(subject.id) || 0) + 1);
        } else {
            map.delete(subject.id);
        }
    }
    saveStreakMap(map);
    return map;
};
```

### 3-3. クラウド同期しない

- sessionStorage（タブ単位・ブラウザ再起動でリセット）
- 理由: 配当結果は既に cloud 同期される。連続未配当カウンタは実行の副次情報でしかないため、ユーザ間で共有する意味が薄い
- Phase 6 で cloud 永続化を検討

### 3-4. リセット機能

- 設定モーダルに「未配当連続カウントをリセット」ボタン
- テストや運用切替のタイミングで手動リセットできる
- 自動リセット: 科目マスタが変更された時（削除された科目のエントリは自動で消える）

## 4. 困難度の可視化

### 4-1. デバッグパネル（optional）

配当実行時にサマリモーダルに折りたたみセクション「困難度トップ10」を表示:

```
[困難度の高い科目 (top 10)]
━━━━━━━━━━━━━━━━━━━━━━━
1. XX演習I (score: 32.5) — 候補室 3 / 必須PC / 連続講時
2. YY実験 (score: 28.0) — 必須機材多数 / 複数室
...
━━━━━━━━━━━━━━━━━━━━━━━
```

### 4-2. ツールチップ

未配当カードの hover で difficulty breakdown を表示（既存の reason tooltip と併設）。

## 5. 修正対象ファイル

| ファイル | 修正内容 | 破壊度 |
|----------|----------|--------|
| `src/utils/difficulty.ts` | 新規: computeDifficulty / breakdown 型 | 新規 |
| `src/utils/unassignedStreak.ts` | 新規: sessionStorage ヘルパ | 新規 |
| `src/utils/optimizer.ts` | `runAutoAllocation` のソートキー変更、streak 更新呼び出し | 小 |
| `src/App.tsx` | 配当後に `updateStreakAfterAllocation` 呼び出し、リセット UI | 小 |
| `src/components/AllocationResultModal.tsx` | 困難度トップ10セクション | 小 |
| `src/components/AllocationRuleSettings.tsx` | 「streak リセット」ボタン | 小 |

## 6. 確認観点

### 6-1. 型・ビルド
- `tsc --noEmit` エラーなし
- `vite build` 警告のみ

### 6-2. ソート
- priority=3（高）の科目が difficulty=0 でも、priority=1 の difficulty=100 より先に処理される
- priority 同値内で difficulty 降順になっている
- streak=5 の科目が streak=0 の科目より先に処理される（他条件同値時）

### 6-3. difficulty 算出
- 必須PJ＋必須可動のゼミ室指定科目が、機材なし一般科目より高スコア
- `strictCandidateCount=0` の科目はスコア上限（全教室数）を得る
- 春秋ペア / 連続講時 / 複数室のフラグが正しく加算される

### 6-4. streak
- 1回目未配当 → streak=1 として保存
- 2回目配当成功 → streak=0 にリセット
- 科目削除時、streak エントリも消える
- sessionStorage のため、新タブでは 0 スタート
- リセットボタンで即座に全エントリクリア

### 6-5. 回帰
- Phase 4 の `relocateForUnassigned` が Phase 5 のソート変更の影響を受けない（unassigned のリストは既存のまま処理）
- streak が積み上がっても、配当そのものの決定性は保たれる（同一 streakMap なら同一結果）

## 7. 懸念点

1. **strictCandidateCount が O(N × R)**
   300 科目 × 200 教室 = 60,000 回。実用範囲。ただし機材マッチングを含むと重い。
   対策: 科目別キャッシュ、または分類インデックス（教室 → 対応機材フラグ）の事前構築。

2. **difficulty スコアの重み調整**
   上記の重みは初版推定値。ユーザ環境で結果が偏る可能性。
   対策: `difficulty.ts` 内に `WEIGHTS` 定数として定義し、将来調整可能に。

3. **streak の意図せぬ暴走**
   配当設定を試行錯誤中に streak が積み上がり続ける。
   対策: 「設定変更後の初回配当」は streak を無視するトグル（`ignoreStreakOnce`）。

4. **既存 snapshot の回帰**
   priority=1 で全て同じ difficulty に近い環境では、元順（index）が支配的になる。
   → 実質的に Phase 4 前と同じ挙動になるが、これは「困難要素がない環境では元順を維持する」という望ましい性質。

5. **困難度可視化の hover 負荷**
   未配当カードの hover で全 breakdown を計算するのは重い。
   対策: 計算結果を配当実行時にまとめて `lastUnassigned` に埋め込む（UnassignedInfo に `difficulty?: number` を追加）。

## 8. Phase 6 以降のロードマップ

Phase 5 完了後の次ステップ:

### Phase 6: 承認済み例外の永続化

- `Allocation.exceptionApproved?: boolean` を追加
- Phase 3 の `ExceptionReviewModal` で承認した例外を記録
- 次回配当時は承認済みをスキップして再確認しない
- ユーザ明示リセットで再確認モードに戻す
- cloud 同期対象に含める

### Phase 7（将来）: 複数シナリオ比較

- 同じ設定で複数回実行し、差異を並べて比較
- 「設定 A vs 設定 B」を横並び

### Phase 8（将来）: 配当履歴ログ

- 配当実行のたびに結果スナップショットを保存
- 過去の配当との差分比較（どの科目がどこへ移ったか）

---

以上。Phase 5 着手時はこの設計書を実装者に渡してください。
