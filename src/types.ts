export type Term = 'spring' | 'autumn' | 'full_year';
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
}

export interface Allocation {
    subjectId: string;
    classroomId: string;
    // メタデータ（手動変更されたか等）
    isLocked?: boolean;
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

// 割り当て結果の全体像
export interface Schedule {
    allocations: Allocation[];
}

export interface DisplayConfig {
    showCapacity: boolean;
    showExamCapacity: boolean;
    showRoomType: boolean;
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
    '天井モニター': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    '白板': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' },
    '黒板': { bg: '#f5f5f5', text: '#616161', border: '#e0e0e0' }
};

export const getEquipmentStyle = (name: string) => {
    return IMPORTANT_EQUIPMENT_COLORS[name] || { bg: '#f5f5f5', text: '#666', border: '#ddd' };
};

export type RuleSeverity = 'mandatory' | 'high' | 'mid' | 'low' | 'lowest';

export interface AllocationRule {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    severity: RuleSeverity;
    order: number;
    weight: number; // 0-100 の重み値
    params?: Record<string, any>;
}

export interface AllocationSettings {
    rules: AllocationRule[];
    orderBonuses: number[]; // 順位ごとの倍率（例: [1.2, 1.1, 1.0]）
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

export const DEFAULT_ORDER_BONUSES = [2.0, 1.5, 1.3, 1.2, 1.1, 1.0, 1.0, 1.0]; // 急勾配：1位=必須、2-5位=できるだけ、6-8位=ベター

export const DEFAULT_ALLOCATION_RULES: AllocationRule[] = [
    {
        id: 'period_continuity',
        name: '連続講時同室',
        description: '連続する講時の授業を同じ教室に配当（必須）',
        enabled: true,
        severity: 'mandatory',
        order: 1,
        weight: 100
    },
    {
        id: 'room_type',
        name: '教室タイプマッチング',
        description: '講義→一般教室、ゼミ→ゼミ室、PC→PC教室',
        enabled: true,
        severity: 'high',
        order: 2,
        weight: 90
    },
    {
        id: 'equipment',
        name: '機材要件',
        description: '機材ごとの重要度設定を反映',
        enabled: true,
        severity: 'high',
        order: 3,
        weight: 85
    },
    {
        id: 'capacity_fit',
        name: '適切な教室サイズ',
        description: '教室定員÷受講者数=1.3〜3.3倍が理想',
        enabled: true,
        severity: 'mid',
        order: 4,
        weight: 70
    },
    {
        id: 'building_preference',
        name: '建物希望',
        description: '指定された建物内の教室を優先',
        enabled: true,
        severity: 'mid',
        order: 5,
        weight: 60
    },
    {
        id: 'teacher_continuity',
        name: '同一教員連続授業',
        description: '同じ教員の連続講時を同じ教室に',
        enabled: true,
        severity: 'mid',
        order: 6,
        weight: 40
    },
    {
        id: 'previous_room',
        name: '過年度教室優先',
        description: '過年度に使用した教室を優先',
        enabled: true,
        severity: 'low',
        order: 7,
        weight: 30
    },
    {
        id: 'term_consistency',
        name: '春秋同一配当',
        description: '春学期と秋学期で同じ教室を使用',
        enabled: true,
        severity: 'low',
        order: 8,
        weight: 25
    }
];

// 画像に基づく機材リスト
export const EQUIPMENT_LIST = [
    'BD', 'PC', 'PJ(中)', 'PJ(横)', 'TV', 'カーテン',
    'タッチディスプレイ', 'ブラインド', 'マイク', 'モニター',
    '可動', '固定', '天井モニター', '白板', '黒板'
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

export interface OptimizerResult {
    allocations: Allocation[];
    unassignedSubjects: Subject[];
}

export interface AllocationOptions {
    rules: AllocationRule[];
    orderBonuses: number[];
    priorities: number[];       // 選択された優先度
    includeAllocated: boolean;  // 配当済みを含む
    includeUnassigned: boolean; // 未配当を含む
    equipmentSettings: {
        items: { [key: string]: { enabled: boolean; importance: number } };
        strictLevel5: boolean;
    }; // 機材設定
}

