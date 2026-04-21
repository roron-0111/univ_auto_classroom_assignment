import type { Subject, Classroom, Allocation, AllocationRule, AllocationSettings } from './types';

export interface CloudProject {
    id: string; // プロジェクトID（ユーザー指定）
    passcode: string; // パスコード
    createdAt: number;
    lastUpdated: number;
}

export interface CloudData {
    subjects: Subject[];
    classrooms: Classroom[];
    allocations: Allocation[];
    settings: AllocationRule[];
    equipmentSettings: AllocationSettings['equipmentSettings'];
}
