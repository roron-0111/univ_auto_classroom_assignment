export interface CloudProject {
    id: string; // プロジェクトID（ユーザー指定）
    passcode: string; // パスコード
    createdAt: number;
    lastUpdated: number;
}

export interface CloudData {
    subjects: any[];
    classrooms: any[];
    allocations: any[];
    settings: any; // allocationSettings
    equipmentSettings: any;
    orderBonuses: any[];
}
