export type Term = 'spring' | 'spring_first' | 'spring_second' | 'autumn' | 'autumn_first' | 'autumn_second' | 'full_year';

export const TERM_LABELS: Record<Term, string> = {
    spring: '春学期',
    spring_first: '春学期前半',
    spring_second: '春学期後半',
    autumn: '秋学期',
    autumn_first: '秋学期前半',
    autumn_second: '秋学期後半',
    full_year: '通年'
};

/** 配当時、このtermのスロットが占有されたとき、競合キーとしてマークするterm一覧 */
export const getTermsToMark = (term: Term): Term[] => {
    switch (term) {
        case 'spring':       return ['spring', 'spring_first', 'spring_second', 'full_year'];
        case 'spring_first': return ['spring_first', 'spring', 'full_year'];
        case 'spring_second': return ['spring_second', 'spring', 'full_year'];
        case 'autumn':       return ['autumn', 'autumn_first', 'autumn_second', 'full_year'];
        case 'autumn_first': return ['autumn_first', 'autumn', 'full_year'];
        case 'autumn_second': return ['autumn_second', 'autumn', 'full_year'];
        case 'full_year':    return ['full_year', 'spring', 'spring_first', 'spring_second', 'autumn', 'autumn_first', 'autumn_second'];
    }
};

/** 前半↔後半のペア（重ねて配当可能なterm） */
export const getComplementaryTerm = (term: Term): Term | null => {
    if (term === 'spring_first') return 'spring_second';
    if (term === 'spring_second') return 'spring_first';
    if (term === 'autumn_first') return 'autumn_second';
    if (term === 'autumn_second') return 'autumn_first';
    return null;
};

/** タイムテーブルグリッドでの表示行 ('spring' | 'autumn') */
export const getTermSeason = (term: Term): 'spring' | 'autumn' => {
    if (term === 'autumn' || term === 'autumn_first' || term === 'autumn_second') return 'autumn';
    return 'spring';
};
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
export type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Classroom {
    id: string;
    name: string;
    building: string; // 棟
    capacity: number; // 通常収容人数
    examCapacity?: number; // 試験時収容人数
    type: 'normal' | 'pc' | 'seminar' | 'other'; // 教室タイプ
    isMovable: boolean; // 可動式（机・椅子）
    equipment: string[]; // その他設備 (例: ["AppleTV", "マイク"])
    isExcluded?: boolean; // 自動配当の対象外とするか
}

export interface Subject {
    id: string; // ID (システム内部用)
    code: string; // 時間割コード
    name: string;
    teacher: string; // 代表教員
    faculty: string; // 開講学部
    department: string; // 管轄学科
    term: Term; // 配当期 (spring, autumn, full_year)
    day: DayOfWeek; // 曜日
    period: Period; // 講時（開始）
    endPeriod?: Period; // 講時（終了） ※連続講時の場合
    requiredCapacity: number; // 履修想定人数
    campus: string; // キャンパス

    // 過去情報・参考
    previousRooms?: string[]; // 教室 (過年度情報)

    // 制約・要望
    preferredRoomType?: 'normal' | 'pc' | 'seminar';
    requiresProjector?: boolean;
    requiresMovable?: boolean; // 可動式教室希望
    requiredEquipment?: string[]; // 希望設備（配当最適化時に考慮）
    mandatoryEquipment?: string[]; // 必須設備（配当時に必須）
    isContinuous?: boolean; // 連続講時か
    linkedSubjectId?: string; // 春秋セット科目のペアID
    priority: number; // 優先度

    // その他
    buildingPreference?: string; // 希望学舎
    requiredRoomCount: number; // 必要教室数

    // 内部用（複数室配当スロット展開時に元のIDを保持）
    _realId?: string;
}

export interface Allocation {
    subjectId: string;
    classroomId: string;
    // メタデータ（手動変更されたか等）
    isLocked?: boolean;
    exceptions?: Array<'term_split' | 'room_type_relaxed'>;
    exceptionApproved?: boolean;
}

export const DAY_LABELS: Record<DayOfWeek, string> = {
    mon: '月', tue: '火', wed: '水', thu: '木', fri: '金', sat: '土'
};

export const PERIOD_LABELS: Record<Period, string> = {
    1: '1-2',
    2: '3-4',
    3: '5-6',
    4: '7-8',
    5: '9-10',
    6: 'N1-N2',
    7: 'N3-N4'
};

export const ROOM_TYPE_LABELS: Record<Classroom['type'], string> = {
    normal: '一般',
    pc: 'PC室',
    seminar: 'ゼミ室',
    other: 'その他'
};

export const DEPARTMENTS = ['理', '経', '国', 'IR', '教', '他'] as const;
export type Department = typeof DEPARTMENTS[number];

export const BUILDINGS = ['フォーサイト', '3号館', '7号館', '8号館', 'SCC'] as const;
export type Building = typeof BUILDINGS[number];

export const CAMPUSES = [
    { id: 'hakkei', name: '八景' },
    { id: 'kannnai', name: '関内' },
    { id: 'muronoki', name: '室の木' }
] as const;

// 割り当て結果の全体像
export interface Schedule {
    allocations: Allocation[];
}

export interface DisplayConfig {
    showCapacity: boolean;
    showExamCapacity: boolean;
    showRoomType: boolean;
    // 授業カード表示
    subjectMainDisplay: 'name' | 'teacher' | 'department';
    showSubInfo: boolean;            // 教員(部局) などのサブ情報
    showPreviousRooms: boolean;      // 過年度教室
    showRequirementTags: boolean;    // 希望タイプ・機材タグ
    showAllocationProgress: boolean; // 1/2室 などの進捗
    // グリッド・全体表示
    showContinuityHighlight: boolean; // 連続講時の青枠
    showViolationAlerts: boolean;    // 制約違反アイコン
    highlightedEquipment: string[]; // ここに含まれるタグは優先的に表示
}

export const IMPORTANT_EQUIPMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'BD': { bg: '#e8eaf6', text: '#1a237e', border: '#c5cae9' }, // 紫系
    'PC': { bg: '#e3f2fd', text: '#0d47a1', border: '#bbdefb' }, // ビビッドな青
    'PJ(中)': { bg: '#e8f5e9', text: '#1b5e20', border: '#c8e6c9' }, // 緑
    'PJ(横)': { bg: '#f1f8e9', text: '#33691e', border: '#dcedc8' }, // 薄緑
    'TV': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' }, // グレー
    'カーテン': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    'タッチディスプレイ': { bg: '#fff3e0', text: '#e65100', border: '#ffe0b2' }, // オレンジ
    'ブラインド': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    'マイク': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    'モニター': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    '可動': { bg: '#f3e5f5', text: '#4a148c', border: '#e1bee7' }, // 紫
    '固定': { bg: '#e0f7fa', text: '#006064', border: '#b2ebf2' }, // ティール
    '白板': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    '黒板': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' }
};

export const getEquipmentStyle = (name: string) => {
    return IMPORTANT_EQUIPMENT_COLORS[name] || { bg: '#f5f5f5', text: '#666', border: '#ddd' };
};

const IMPORTANT_EQUIPMENT_ALIASES: Record<string, string> = {
    可動: '可動',
    移動: '可動',
    固定: '固定',
    movable: '可動',
    fixed: '固定',
    天井モニター: 'モニター'
};

export const normalizeEquipmentName = (name: string) => IMPORTANT_EQUIPMENT_ALIASES[name] || name;

export const getImportantEquipmentStyle = (name: string) => {
    const canonical = IMPORTANT_EQUIPMENT_ALIASES[name] || name;
    return IMPORTANT_EQUIPMENT_COLORS[canonical] || { bg: '#f5f5f5', text: '#666', border: '#ddd' };
};

export type RuleTier = 'hard' | 'near' | 'pref';

export interface AllocationRule {
    id: string;
    name: string;
    description: string;
    tier: RuleTier;
    enabled: boolean;
    order: number;
    params?: Record<string, any>;
}

export interface AllocationSettings {
    rules: AllocationRule[];
    equipmentSettings?: {
        items: {
            [key: string]: {
                enabled: boolean;
                importance: number;
            }
        };
        strictLevel5?: boolean; // 重要度5を必須条件とするフラグ
    };
}

export const DEFAULT_ALLOCATION_RULES: AllocationRule[] = [
    {
        id: 'no_overlap',
        name: '時間重複なし',
        description: '同一時限・同一教室の重複配当をしない',
        tier: 'hard',
        enabled: true,
        order: 0
    },
    {
        id: 'period_continuity',
        name: '連続講時同室',
        description: '連続する講時の授業を同じ教室に配当',
        tier: 'hard',
        enabled: true,
        order: 0
    },
    {
        id: 'capacity_min',
        name: '定員不足なし',
        description: '受講想定人数未満の教室には配当しない',
        tier: 'hard',
        enabled: true,
        order: 0
    },
    {
        id: 'mandatory_equipment',
        name: '必須機材一致',
        description: '必須指定機材が欠ける教室には配当しない',
        tier: 'hard',
        enabled: true,
        order: 0
    },
    {
        id: 'excluded_room',
        name: '配当対象外除外',
        description: '教室管理で対象外設定された教室は除外する',
        tier: 'hard',
        enabled: true,
        order: 0
    },
    {
        id: 'term_consistency',
        name: '春秋同一教室',
        description: '春秋ペア科目は同じ教室を使用',
        tier: 'near',
        enabled: true,
        order: 0,
        params: {
            relaxable: true
        }
    },
    {
        id: 'room_type',
        name: '教室タイプマッチング',
        description: '講義→一般教室、ゼミ→ゼミ室、PC→PC教室',
        tier: 'near',
        enabled: false,
        order: 0,
        params: {
            relaxable: true
        }
    },
    {
        id: 'teacher_continuity',
        name: '同一教員連続授業',
        description: '同じ教員の連続講時を同じ教室に',
        tier: 'pref',
        enabled: true,
        order: 1
    },
    {
        id: 'equipment',
        name: '希望機材充足',
        description: '機材ごとの重要度設定を反映',
        tier: 'pref',
        enabled: true,
        order: 2
    },
    {
        id: 'capacity_fit',
        name: '適切な教室サイズ',
        description: '教室定員÷受講者数が適正範囲に近いほど優先',
        tier: 'pref',
        enabled: true,
        order: 3,
        params: {
            minRatio: 1.3,
            maxRatio: 3.3
        }
    },
    {
        id: 'building_preference',
        name: '建物希望',
        description: '指定された建物内の教室を優先',
        tier: 'pref',
        enabled: true,
        order: 4
    },
    {
        id: 'previous_room',
        name: '過年度教室優先',
        description: '過年度に使用した教室を優先',
        tier: 'pref',
        enabled: true,
        order: 5
    }
];

// 機材リスト（標準）
export const EQUIPMENT_LIST = [
    'PJ(中)', 'PJ(横)', 'タッチディスプレイ', 'BD', '黒板', '白板', 'マイク', 'ブラインド',
    'PC', '可動', '固定'
];

export const DEFAULT_EQUIPMENT_SETTINGS = {
    items: EQUIPMENT_LIST.reduce((acc, output) => {
        // デフォルトの重要度設定
        let importance = 3;
        if (['PC', 'PJ(中)', 'PJ(横)', '可動'].includes(output)) importance = 5;
        if (['BD', 'タッチディスプレイ'].includes(output)) importance = 4;

        acc[output] = { enabled: true, importance };
        return acc;
    }, {} as { [key: string]: { enabled: boolean; importance: number } }),
    strictLevel5: false
};

export type UnassignedReason =
    | 'U1_no_hard_candidate'
    | 'U2_room_type_blocked'
    | 'U3_term_split_blocked'
    | 'U4_room_count_short'
    | 'U5_swap_failed';

export interface UnassignedInfo {
    subject: Subject;
    reason: UnassignedReason;
    detail?: string;
}

export interface PendingException {
    subject: Subject;
    classroomId: string;
    exceptions: Array<'term_split' | 'room_type_relaxed'>;
    alternativeUnassignedReason: UnassignedReason;
}

export interface AllocationRunOptions {
    equipmentSettings?: {
        items: { [key: string]: { enabled: boolean; importance: number } };
        strictLevel5: boolean;
    };
    dryRunExceptions?: boolean;
    streakMap?: Map<string, number>;
    ignoreStreakOnce?: boolean;
    approvedExceptions?: Set<string>;
}

export interface OptimizerResult {
    allocations: Allocation[];
    unassigned: UnassignedInfo[];
}

export interface OptimizerResult {
    pendingExceptions?: PendingException[];
}

export interface AllocationOptions {
    rules: AllocationRule[];
    priorities: number[];           // 選択された優先度
    terms: Term[];                  // 配当期
    days: DayOfWeek[];              // 曜日
    periods: Period[];              // 講時
    includeAllocated: boolean;      // 配当済みを含む
    includeUnassigned: boolean;     // 未配当を含む
    equipmentSettings: {
        items: { [key: string]: { enabled: boolean; importance: number } };
        strictLevel5: boolean;
    }; // 機材設定
}

export interface AllocationOptions {
    confirmExceptions: boolean;
}

export interface AllocationOptions {
    ignoreStreakOnce?: boolean;
}

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
    unresolved: UnassignedInfo[];
}

const cloneParams = (params?: Record<string, any>) => {
    if (!params) return undefined;
    return { ...params };
};

const isLegacyRule = (rule: any): rule is Record<string, any> => {
    return rule && typeof rule === 'object' && typeof rule.id === 'string';
};

export const migrateAllocationRules = (oldRules: any[] | undefined): AllocationRule[] => {
    const savedRules = Array.isArray(oldRules) ? oldRules.filter(isLegacyRule) : [];
    const savedById = new Map(savedRules.map(rule => [rule.id, rule]));

    return DEFAULT_ALLOCATION_RULES.map(def => {
        const saved = savedById.get(def.id);
        if (!saved) {
            return {
                ...def,
                params: cloneParams(def.params)
            };
        }

        if (def.tier === 'hard') {
            return {
                ...def,
                enabled: true,
                params: cloneParams(def.params)
            };
        }

        if (def.tier === 'near') {
            const nextEnabled =
                def.id === 'term_consistency'
                    ? (typeof saved.enabled === 'boolean' ? saved.enabled : def.enabled)
                    : def.enabled;

            return {
                ...def,
                enabled: nextEnabled,
                params: cloneParams(def.params)
            };
        }

        const nextEnabled = typeof saved.enabled === 'boolean' ? saved.enabled : def.enabled;
        const nextParams = {
            ...cloneParams(def.params),
            ...cloneParams(saved.params)
        };

        return {
            ...def,
            enabled: nextEnabled,
            params: Object.keys(nextParams).length > 0 ? nextParams : undefined
        };
    });
};

