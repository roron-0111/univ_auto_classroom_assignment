# 教室配当 Phase 1 実装設計書

`docs/allocation-spec.md`（CODEX案）の 3層＋辞書式比較方式を現コードに実装するための設計書。
Phase 1 の範囲は以下の通り。

- ルール構造の刷新（`AllocationRule` 全面改定）
- optimizer の書き換え（加点合計 → フィルタ＋辞書式比較）
- 配当ルール設定画面の UI 刷新
- 保存データのマイグレーション（破壊的変更の吸収）

Phase 2 以降（未配当理由の構造化表示 UI、第2段階例外配当、玉突き再調整、処理順の困難度計算）は本書末尾で方針のみ言及し、実装は別Phase。

---

## 1. 用語と基本設計

### 1-1. ルール層

| 層 | 識別子 | 役割 | UI |
|----|--------|------|-----|
| 絶対必須 | `hard` | 違反候補を即時除外（フィルタ） | 読取専用リスト |
| 準必須 | `near` | 原則除外、`relaxable=true` の場合のみ候補0件時に緩和 | 緩和許可トグル |
| 希望条件 | `pref` | 候補比較に使う。加点合計ではなく辞書式順位比較 | 順位変更（↑↓）＋有効化チェック |

### 1-2. 重要な設計決定

- **希望条件は加点合計をやめる**。優先順位どおりに比較するため、「建物希望×3 > 同一教員連続×1」のような数値逆転を原理的に起こさない。
- **`weight` / `severity` / `orderBonuses` は全廃**。代わりに `tier` と `order`（pref層内の順位）を持つ。
- `equipment` 内部の `importance`（1〜5）と `strictLevel5` は保持（pref内の充足率計算に使うパラメータ）。
- `enabled` の意味は層ごとに変わる:
    - `hard`: 常に `true` 固定
    - `near`: 「候補0件時の例外緩和を許可するか」
    - `pref`: 「辞書式比較の対象とするか」（false なら比較ステップを飛ばす）

---

## 2. 型定義 (`src/types.ts`)

### 2-1. 新規・変更する型

```typescript
export type RuleTier = 'hard' | 'near' | 'pref';

export interface AllocationRule {
    id: string;
    name: string;
    description: string;
    tier: RuleTier;
    enabled: boolean;   // near: 緩和許可 / pref: 比較対象
    order: number;      // pref層内の順位 (1=最上位)。hard/near は 0 固定
    params?: Record<string, any>;
}

// 旧: severity, weight は削除
// 旧: DEFAULT_ORDER_BONUSES, AllocationSettings.orderBonuses は削除

export type UnassignedReason =
    | 'U1_no_hard_candidate'   // hard を満たす教室が存在しない
    | 'U2_room_type_blocked'   // 教室タイプ不一致、緩和不許可
    | 'U3_term_split_blocked'  // 春秋同一崩せず
    | 'U4_room_count_short'    // 必要教室数を満たせない
    | 'U5_swap_failed';        // 玉突きでも成立せず (Phase 4)

export interface UnassignedInfo {
    subject: Subject;
    reason: UnassignedReason;
    detail?: string; // 例: "必須機材 BD/PJ が揃う教室なし"
}

export interface Allocation {
    subjectId: string;
    classroomId: string;
    isLocked?: boolean;
    exceptions?: Array<'room_type_relaxed' | 'term_split'>; // 例外配当の記録
}

export interface OptimizerResult {
    allocations: Allocation[];
    unassigned: UnassignedInfo[]; // 旧: unassignedSubjects (Subject[])
}

export interface AllocationSettings {
    rules: AllocationRule[];
    equipmentSettings?: {
        items: { [key: string]: { enabled: boolean; importance: number } };
        strictLevel5?: boolean;
    };
    // orderBonuses は削除
}
```

### 2-2. `DEFAULT_ALLOCATION_RULES`（新構成）

```typescript
export const DEFAULT_ALLOCATION_RULES: AllocationRule[] = [
    // === hard (絶対必須) ===
    { id: 'no_overlap',          name: '時間重複なし',    description: '同一時限・同一教室の重複配当をしない', tier: 'hard', enabled: true, order: 0 },
    { id: 'period_continuity',   name: '連続講時同室',    description: '連続する講時は同じ教室に配当（単位扱い）', tier: 'hard', enabled: true, order: 0 },
    { id: 'capacity_min',        name: '定員不足なし',    description: '受講想定人数未満の教室には配当しない',   tier: 'hard', enabled: true, order: 0 },
    { id: 'mandatory_equipment', name: '必須機材一致',    description: '必須指定機材が欠ける教室には配当しない', tier: 'hard', enabled: true, order: 0 },
    { id: 'excluded_room',       name: '配当対象外除外',  description: '教室管理で対象外設定された教室は除外',   tier: 'hard', enabled: true, order: 0 },

    // === near (準必須) === enabled は「緩和許可」を意味
    { id: 'term_consistency',    name: '春秋同一教室',    description: '春秋ペア科目は同じ教室を使用', tier: 'near', enabled: true,  order: 0 },
    { id: 'room_type',           name: '教室タイプ一致',  description: '講義→一般、ゼミ→ゼミ室、PC→PC室', tier: 'near', enabled: false, order: 0 },

    // === pref (希望条件) === order = 辞書式比較の順位（1 が最上位）
    { id: 'teacher_continuity',  name: '同一教員連続授業', description: '連続講時の同一教員は同じ教室',           tier: 'pref', enabled: true, order: 1 },
    { id: 'equipment',           name: '希望機材充足',     description: '希望機材の充足率（重要度重み付き）',     tier: 'pref', enabled: true, order: 2 },
    { id: 'capacity_fit',        name: '適切な教室サイズ', description: '定員/人数比が適正範囲（既定1.3〜3.3倍）', tier: 'pref', enabled: true, order: 3 },
    { id: 'building_preference', name: '建物希望',         description: '指定された建物内の教室を優先',           tier: 'pref', enabled: true, order: 4 },
    { id: 'previous_room',       name: '過年度教室優先',   description: '過年度に使用した教室を優先',             tier: 'pref', enabled: true, order: 5 },
];
```

### 2-3. マイグレーション

旧スキーマ（`severity`, `weight`, `orderBonuses` を持つデータ）をロード時に新構造へ変換する。

```typescript
export function migrateAllocationRules(oldRules: any[] | undefined): AllocationRule[] {
    if (!oldRules || oldRules.length === 0) return DEFAULT_ALLOCATION_RULES;

    const defaultById = new Map(DEFAULT_ALLOCATION_RULES.map(r => [r.id, r]));

    // id ベースで既定値にマージ。tier/order/name/description は新仕様で上書き。
    // enabled のみ旧値を引継ぐ（hard は強制true、nearは旧enabledを「緩和許可」として解釈）。
    return DEFAULT_ALLOCATION_RULES.map(def => {
        const old = oldRules.find((r: any) => r.id === def.id);
        if (!old) return def;

        if (def.tier === 'hard') return { ...def, enabled: true };
        if (def.tier === 'near') {
            // 旧データには「緩和許可」概念がなく enabled=true は既定ON。
            // term_consistency は旧 severity=low かつ enabled=true が標準 → 新 enabled=true (緩和許可) で継承。
            // room_type は旧 severity=high かつ enabled=true が標準だが、新仕様は「緩和不許可(false)」を既定にしたい。
            //   → 旧 enabled をそのまま引継ぐと room_type=true になるため、ここは既定値 (false) を優先する選択肢もある。
            //   → 本設計では「旧 enabled をそのまま引継ぐ」が意味を変え過ぎるため、near は既定値固定でマイグレートする。
            return { ...def };
        }
        // pref: enabled と params のみ引継ぐ
        return { ...def, enabled: old.enabled ?? def.enabled, params: old.params ?? def.params };
    });
}
```

**旧保存データの order 情報は破棄**。ユーザが pref の順位をカスタムしていた場合も既定に戻る。移行時の UX 劣化を防ぐため、ロード直後にアラート表示 or マイグレーションログを出すか、初回ロード時に「旧設定は新仕様に移行しました」とトーストを出す設計を推奨。

### 2-4. ロード経路

- `src/App.tsx` の localStorage / useCloudSync 読込箇所で `migrateAllocationRules` を適用。
- 読込後の保存時には常に新形式で書き出す（フィールド `severity`, `weight`, `orderBonuses` は出力しない）。
- `orderBonuses` も削除するため、`AllocationSettings` の保存スキーマから除外。旧キーが残っていても無視する。

---

## 3. Optimizer 設計 (`src/utils/optimizer.ts`)

### 3-1. 新シグネチャ

```typescript
export const runAutoAllocation = (
    subjects: Subject[],
    classrooms: Classroom[],
    currentAllocations: Allocation[],
    rules: AllocationRule[],
    equipmentSettings: { items: ...; strictLevel5: boolean }
): OptimizerResult
```

`orderBonuses` 引数を削除。呼び出し側（`App.tsx` の onSave ハンドラなど）も合わせて修正。

### 3-2. 処理フロー

```
for each subject (priority順):
    for i in 0..requiredRoomCount-1:
        candidates = classrooms.filter(r => passHard(r, subject, ctx))
                               .filter(r => passNear(r, subject, ctx, relax=false))
        if candidates.empty:
            candidates = relaxNearStep1(subject, ctx)   // 春秋同一を緩和
            if candidates.empty:
                candidates = relaxNearStep2(subject, ctx) // タイプ一致を緩和 (room_type.enabled時のみ)
                if candidates.empty:
                    unassigned.push({ subject, reason: classifyReason(...) })
                    continue
        best = candidates.reduce((a, b) => lexCompare(a, b, subject, prefRules, ctx) <= 0 ? a : b)
        allocate(subject, best, exceptions)
```

### 3-3. hard チェック

```typescript
function passHard(room, subject, ctx): boolean {
    // excluded_room
    if (room.isExcluded) return false;
    // no_overlap (subject.period〜endPeriod 全講時で教室が空いているか)
    if (!allPeriodsFree(room, subject, ctx.occupied)) return false;
    // capacity_min
    if (room.capacity < subject.requiredCapacity) return false;
    // mandatory_equipment
    if (!satisfiesMandatory(room, subject.mandatoryEquipment)) return false;
    // strictLevel5 (equipment設定の重要度5強制は hard へ昇格)
    if (ctx.strictLevel5 && !satisfiesLevel5(room, subject, ctx.equipmentSettings)) return false;
    return true;
}
```

`period_continuity` は「候補の全講時空き」で自動的に担保。新たな判定は不要。

### 3-4. near チェック

```typescript
function passNear(room, subject, ctx, relaxFlags: { term_split?: boolean; room_type?: boolean }): { ok: boolean; exceptions: string[] } {
    const exceptions: string[] = [];

    // term_consistency: linkedSubjectId または 教員+曜日+講時 で判定した「春秋ペア」と同一教室か
    if (!relaxFlags.term_split) {
        if (hasTermPartnerAllocatedElsewhere(room, subject, ctx)) return { ok: false, exceptions };
    } else {
        if (hasTermPartnerAllocatedElsewhere(room, subject, ctx)) exceptions.push('term_split');
    }

    // room_type
    if (subject.preferredRoomType && subject.preferredRoomType !== room.type) {
        if (!relaxFlags.room_type) return { ok: false, exceptions };
        exceptions.push('room_type_relaxed');
    }
    return { ok: true, exceptions };
}
```

緩和順（CODEX 6-2 準拠）:
1. `term_consistency` 緩和（`rules.find('term_consistency').enabled=true` 前提）
2. `room_type` 緩和（`rules.find('room_type').enabled=true` 前提）

### 3-5. 辞書式比較

```typescript
function lexCompare(roomA, roomB, subject, prefRulesSorted, ctx): number {
    // prefRulesSorted は rules.filter(tier='pref' && enabled).sort(order asc)
    for (const rule of prefRulesSorted) {
        const a = evalPref(rule.id, roomA, subject, ctx);
        const b = evalPref(rule.id, roomB, subject, ctx);
        if (a !== b) return b - a; // 高い方を返す (A勝ち=負数)
    }
    // タイブレーク: 余剰定員が少ない方
    return (roomA.capacity - subject.requiredCapacity) - (roomB.capacity - subject.requiredCapacity);
}

function evalPref(ruleId, room, subject, ctx): number {
    switch (ruleId) {
        case 'teacher_continuity': {
            // 連続する前/後講時の同教員が同一教室 → 1.0、同建物 → 0.5、それ以外 → 0
            return scoreTeacherContinuity(room, subject, ctx);
        }
        case 'equipment': {
            // 希望機材充足率（重要度＋内部倍率による加重平均）を 0〜1 に正規化
            return scoreEquipmentRatio(room, subject, ctx.equipmentSettings);
        }
        case 'capacity_fit': {
            const ratio = room.capacity / subject.requiredCapacity;
            const { minRatio = 1.3, maxRatio = 3.3 } = rule.params ?? {};
            if (ratio >= minRatio && ratio <= maxRatio) return 1.0;
            if (ratio >= 1.0 && ratio < minRatio) return 0.5;
            return 0.2; // 入るがオーバーサイズ
        }
        case 'building_preference': {
            return subject.buildingPreference && room.building === subject.buildingPreference ? 1.0 : 0.0;
        }
        case 'previous_room': {
            return subject.previousRooms?.includes(room.name) ? 1.0 : 0.0;
        }
    }
    return 0;
}
```

### 3-6. 未配当理由の分類

```typescript
function classifyReason(subject, relaxTriedStep1, relaxTriedStep2): UnassignedReason {
    if (!relaxTriedStep1) return 'U1_no_hard_candidate'; // hard で全滅
    if (relaxTriedStep1 && !relaxTriedStep2) return 'U3_term_split_blocked';
    return 'U2_room_type_blocked';
    // U4 は requiredRoomCount ループ中の部分成立検知で付与
    // U5 は Phase 4 で使用
}
```

### 3-7. 処理順（Phase 1 は現状踏襲）

現 optimizer は `priority` 降順のみ。CODEX 4-1 の配当困難度スコアは Phase 5 に回し、Phase 1 では `priority` のみで処理。この判断は CODEX 仕様書 4-1 の「同じ優先度なら入りにくい科目を先に」を満たさないが、Phase 1 の破壊的変更を最小化するための妥協。

### 3-8. 既存挙動との差分

| 項目 | 旧 | 新 |
|------|-----|-----|
| 連続講時ボーナス +60 | 加点 | 削除（ hard で担保） |
| 春秋スタッキングボーナス +60 | 加点 | `term_consistency` (near + pref評価) に統合 |
| `weight` 基本値 | 0〜100 スライダ | 全廃 |
| `orderBonuses` | 順位倍率 | 全廃 |
| `capacity_fit` の 1.3〜3.3 倍 | params 経由 | 維持（pref params） |
| 同率タイブレーク（定員近い方） | 後勝ち | lexCompare のタイブレークで同挙動 |

---

## 4. UI 刷新 (`src/components/AllocationRuleSettings.tsx`)

### 4-1. レイアウト

```
[ヘッダ] 配当ルール設定 [教室自動配当] [キャンセル]

[配当基本設定] ← 既存流用 (配当期/曜日/講時/優先度/モード)

[絶対必須]      ← 新規セクション (読取専用)
  🔒 時間重複なし
  🔒 連続講時同室
  🔒 定員不足なし
  🔒 必須機材一致
  🔒 配当対象外除外

[準必須]        ← 新規セクション (緩和許可トグルのみ)
  春秋同一教室   [☑ 候補0件時のみ例外配当を許可]
  教室タイプ一致 [☐ 候補0件時のみ例外配当を許可]

[希望条件]      ← 既存セクションを簡素化
  1位 ▲▼ ☑ 同一教員連続授業
  2位 ▲▼ ☑ 希望機材充足  [詳細設定 ▼]
  3位 ▲▼ ☑ 適切な教室サイズ
  4位 ▲▼ ☑ 建物希望
  5位 ▲▼ ☑ 過年度教室優先
  ※ 上位から順に比較します (加点合計ではありません)

(機材詳細パネル・strictLevel5 トグルは既存流用)
```

### 4-2. 廃止する UI

- 「ベースの重み」スライダ（0〜100）
- 「×（順位別ボーナス）」乗算表示と最終スコア表示
- 「順位別倍率設定」パネル（`orderBonuses` 全廃に伴う）

### 4-3. 追加する UI

- `[絶対必須]` リスト（編集不可、鍵アイコン付き）
- `[準必須]` の緩和許可トグル（2件）
- `[希望条件]` の「上位から順に比較」説明テキスト
- 順位表示は pref 層内のみ (1〜5位)

### 4-4. props / onSave

`AllocationOptions` から `orderBonuses` を削除。`rules` 配列のみで完結する。
`onSave` 呼び出し側（`App.tsx`）も合わせて修正。

---

## 5. 影響範囲と修正対象ファイル

| ファイル | 修正内容 | 破壊度 |
|----------|----------|--------|
| `src/types.ts` | `AllocationRule` 刷新、`UnassignedInfo` / `UnassignedReason` 追加、`OptimizerResult` 型変更、`AllocationOptions` から `orderBonuses` 削除、`migrateAllocationRules` 追加 | 大 |
| `src/utils/optimizer.ts` | 全面書換 | 大 |
| `src/components/AllocationRuleSettings.tsx` | セクション再編、重み/倍率UI削除、hardリスト追加、near緩和トグル追加 | 大 |
| `src/App.tsx` | `runAutoAllocation` 呼び出しのシグネチャ変更、ロード時 `migrateAllocationRules` 適用、`AllocationOptions` から `orderBonuses` 除去 | 中 |
| `src/components/UnassignedList.tsx` | `unassignedSubjects: Subject[]` → `unassigned: UnassignedInfo[]` への型変更を受け取り（最低限は `.map(u => u.subject)` で後方互換でもOK）。理由表示は Phase 2 | 小 |
| `src/hooks/useCloudSync.ts` / `src/hooks/useLocalState.ts` 相当 | 保存/復元時に旧キー（`weight`, `severity`, `orderBonuses`）を破棄 or 無視 | 小 |

---

## 6. マイグレーション・同期の安全性

CLAUDE.md「保存データ互換性」「同期処理の安全性」の観点で：

- ロード: 旧構造 → 新構造は `migrateAllocationRules` で吸収。**旧データは破棄せず、変換結果を保存時に上書き**。
- 保存: 常に新スキーマで書き出す。旧キーは書き出さない。
- クラウド同期: `useCloudSync` でのマージ時、マイグレーション後の形で統一されるため競合しない。
- ロールバック手段: 万一新仕様に問題があった場合に備え、**Phase 1 実装ブランチは別ブランチで作業**し、旧実装は削除せずに retained する運用を推奨。

---

## 7. 動作確認観点

### 7-1. 型・ビルド

- `tsc --noEmit` でエラーなし
- `vite build` で警告のみ（旧 bundle size warning は想定内）

### 7-2. 配当結果

- 既定ルールで、典型的な授業データ（サンプル `mockData.ts` 基準）で配当成立率が旧実装と同等以上
- `mandatoryEquipment` を持つ科目が、必須機材のない教室に配当されない
- `strictLevel5: true` で重要度5機材のない教室が除外される
- `preferredRoomType` を持つ科目が、`room_type` 緩和OFF 時には一致教室のみに配当される
- `room_type` 緩和ON 時、候補0件のときのみ不一致教室が候補になり、`exceptions=['room_type_relaxed']` が付く
- `teacher_continuity` が pref 1位のため、他条件が同じなら常に同一教員連続が優先される
- 旧データロード時にマイグレーションが成功し、UI がクラッシュしない

### 7-3. UI

- 絶対必須セクションが読取専用になっている
- 準必須の緩和許可トグルが保存・復元される
- 希望条件の順位変更が反映される（pref 内のみ）
- 機材詳細設定は旧挙動を維持

---

## 8. Phase 2 以降（本書の対象外）

| Phase | 内容 | トリガ |
|-------|------|--------|
| 2 | 未配当理由の構造化表示（`UnassignedList` に U1〜U5 バッジ、フィルタ） | Phase 1 安定後 |
| 3 | 第2段階例外配当 UI（「例外配当中」のハイライト、手動承認モード） | 運用実績が溜まってから |
| 4 | 玉突き再調整（局所スワップ） | Phase 3 後、運用で必要と判断された場合 |
| 5 | 配当困難度による処理順ソート（4-1 完全実装） | 成立率が頭打ちになったら |

---

## 9. 懸念と決定保留事項

1. **近似同率扱いの `building_preference` vs `previous_room`**
   CODEX は「建物>過年度」の順だが、ユーザは「同程度」と発言。**既定は CODEX 準拠の 4位／5位**で実装し、UI の順位変更で同率化する運用を推奨。

2. **`term_consistency` が near かつ pref にない**
   CODEX 仕様では春秋同一は準必須のみ。pref には入らない。pref 評価から外すことで二重カウントを回避。ただし「春秋同一を満たす教室の中でさらに教員連続を優先」という挙動は第1段階で自動的に成立する（候補リストが春秋同一を満たすものに絞られた後、pref で比較される）ため問題なし。

3. **旧ユーザ設定の消失**
   `weight` と `order`（pref 層外のもの）は破棄される。既存ユーザに対しては初回ロード時に移行通知を出すのが望ましい（本書では実装方針のみ提示、詳細は実装時判断）。

4. **実装規模**
   Phase 1 は types / optimizer / UI の 3点同時刷新のため、変更行数はおそらく 1000 行超。レビュー効率のため、実装時は以下の 3 PR に分割することを推奨：
   - 1a: `types.ts` 刷新 + `migrateAllocationRules` + 呼び出し箇所の型修正のみ（挙動は保持）
   - 1b: `optimizer.ts` 新実装への差し替え
   - 1c: `AllocationRuleSettings.tsx` UI 刷新

---

以上。
