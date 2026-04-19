import type { Classroom, Subject, Allocation, AllocationRule, OptimizerResult } from '../types';
import { getTermsToMark, getComplementaryTerm } from '../types';

// 重み値は AllocationRule.weight を直接使用

export const runAutoAllocation = (
    subjects: Subject[],
    classrooms: Classroom[],
    currentAllocations: Allocation[] = [],
    rules: AllocationRule[] = [],
    orderBonuses: number[] = [1.2, 1.1, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
    equipmentSettings?: {
        items: { [key: string]: { enabled: boolean; importance: number } };
        strictLevel5: boolean;
    }
): OptimizerResult => {

    // ルールのMapを作成してアクセスしやすくする
    const ruleMap = new Map(rules.map(r => [r.id, r]));
    const isEnabled = (id: string) => ruleMap.get(id)?.enabled ?? false;

    // 順序ボーナスの取得（カスタム値を使用）
    const getOrderBonus = (order: number): number => {
        return orderBonuses[order - 1] ?? 1.0;
    };

    // 最終スコアを計算（基本重み × 順序ボーナス）
    const getScore = (id: string): number => {
        const rule = ruleMap.get(id);
        if (!rule) return 10;
        return Math.round(rule.weight * getOrderBonus(rule.order));
    };

    const occupied = new Set<string>(); // "term-day-period-classroomId"
    const newAllocations: Allocation[] = [...currentAllocations];

    // 既存割り当てで埋まっている箇所を記録
    currentAllocations.forEach(alloc => {
        const subj = subjects.find(s => s.id === alloc.subjectId);
        if (subj) {
            // 連続講時も考慮して埋める
            const start = subj.period;
            const end = subj.endPeriod || subj.period;
            const termsToMark = getTermsToMark(subj.term);
            for (let p = start; p <= end; p++) {
                termsToMark.forEach(t => occupied.add(`${t}-${subj.day}-${p}-${alloc.classroomId}`));
            }
        }
    });

    // 優先度順にソート (科目自体の優先度のみ。同列は元の順序=CSV取込順を維持)
    const sortedSubjects = [...subjects].sort((a, b) => {
        return (b.priority || 1) - (a.priority || 1);
    });

    const unassigned: Subject[] = [];

    for (const subject of sortedSubjects) {
        const roomCount = subject.requiredRoomCount || 1;

        for (let i = 0; i < roomCount; i++) {
            const currentAllocCount = newAllocations.filter(a => a.subjectId === subject.id).length;
            if (currentAllocCount >= roomCount) break;

            let bestClassroom: Classroom | null = null;
            let bestScore = -1;

            for (const room of classrooms) {
                // 教室が配当対象外に設定されている場合はスキップ
                if (room.isExcluded) continue;

                // --- Hard Constraints (無視できない制約) ---

                // 1. 同一科目が同一教室に重なるのを防止
                if (newAllocations.some(a => a.subjectId === subject.id && a.classroomId === room.id)) continue;

                // 2. 時間帯の競合チェック
                let conflict = false;
                const start = subject.period;
                const end = subject.endPeriod || subject.period;
                for (let p = start; p <= end; p++) {
                    if (occupied.has(`${subject.term}-${subject.day}-${p}-${room.id}`)) {
                        conflict = true;
                        break;
                    }
                }
                if (conflict) continue;

                // 3. 基本的な収容人数
                if (room.capacity < subject.requiredCapacity) continue;

                // 4. 必須機材（mandatoryEquipment）の hard constraint
                if (subject.mandatoryEquipment && subject.mandatoryEquipment.length > 0) {
                    const missingMandatory = subject.mandatoryEquipment.some(req => {
                        if (req === '可動') return !room.isMovable;
                        if (req === 'PJ(横)' || req === 'PJ(中)') {
                            return !room.equipment.some(eq => eq === 'PJ(横)' || eq === 'PJ(中)');
                        }
                        return !room.equipment.some(eq => eq === req || eq.includes(req) || req.includes(eq));
                    });
                    if (missingMandatory) continue;
                }

                // 5. 機材要件 (Strict Level 5)
                if (isEnabled('equipment') && equipmentSettings?.strictLevel5) {
                    const requiredItems = subject.requiredEquipment || [];
                    const allRequired = new Set(requiredItems);
                    if (subject.requiresProjector) allRequired.add('PJ');
                    if (subject.requiresMovable) allRequired.add('可動');

                    let veto = false;
                    for (const req of Array.from(allRequired)) {
                        let settingsKey = req;
                        if (req.includes('PJ')) settingsKey = 'PJ';

                        const setting = equipmentSettings.items[settingsKey];
                        if (setting && setting.enabled && setting.importance === 5) {
                            // 重要度5に設定されている機材がない場合は不適合
                            let hasEquip = false;
                            if (req === '可動') {
                                hasEquip = room.isMovable;
                            } else {
                                hasEquip = room.equipment.some(eq =>
                                    eq === req || eq.includes(req) || req.includes(eq) ||
                                    (req === 'PJ(横)' && eq === 'PJ(中)') || (req === 'PJ(中)' && eq === 'PJ(横)')
                                );
                            }
                            if (!hasEquip) {
                                veto = true;
                                break;
                            }
                        }
                    }
                    if (veto) continue;
                }

                // --- Scored Rules (Soft Constraints) ---
                let score = 0;

                // 機材要件スコアリング
                if (isEnabled('equipment')) {
                    const baseWeight = getScore('equipment');
                    const requiredItems = subject.requiredEquipment || [];

                    const allRequired = new Set(requiredItems);
                    if (subject.requiresProjector) allRequired.add('PJ');
                    if (subject.requiresMovable) allRequired.add('可動');

                    if (allRequired.size > 0) {
                        let totalRequiredWeight = 0;
                        let satisfiedWeight = 0;

                        for (const req of Array.from(allRequired)) {
                            // 設定キーのマッチング
                            let settingsKey = req;
                            if (req.includes('PJ')) settingsKey = 'PJ';

                            // 無効化チェック
                            const setting = equipmentSettings?.items?.[settingsKey];
                            if (setting && !setting.enabled) {
                                continue;
                            }

                            // 内部倍率 (固定)
                            const internalMultiplier = ['可動', 'BD', 'PJ(中)', 'PJ(横)', 'PJ'].includes(settingsKey) ? 2.0 : 1.0;
                            const importance = setting?.importance ?? 3;
                            const weightedImportance = importance * internalMultiplier;

                            totalRequiredWeight += weightedImportance;

                            // 可動の場合は room.isMovable もチェック
                            let hasEquip = false;
                            if (req === '可動') {
                                hasEquip = room.isMovable;
                            } else {
                                hasEquip = room.equipment.some(eq =>
                                    eq === req || eq.includes(req) || req.includes(eq) ||
                                    (req === 'PJ(横)' && eq === 'PJ(中)') || (req === 'PJ(中)' && eq === 'PJ(横)')
                                );
                            }

                            if (hasEquip) {
                                satisfiedWeight += weightedImportance;
                            }
                        }

                        if (totalRequiredWeight > 0) {
                            // 達成率 (0.0〜1.0) に基づいてスコアを算出
                            const matchingRatio = satisfiedWeight / totalRequiredWeight;
                            score += Math.round(baseWeight * matchingRatio);
                        }
                    }
                }

                // 教室タイプマッチング
                if (isEnabled('room_type') && subject.preferredRoomType === room.type) {
                    score += getScore('room_type');
                }

                // 希望建物優先
                if (isEnabled('building_preference') && subject.buildingPreference && room.building === subject.buildingPreference) {
                    score += getScore('building_preference');
                }

                // 同一教員連続授業 (同じ建物・同じ教室)
                if (isEnabled('teacher_continuity')) {
                    const weight = getScore('teacher_continuity');
                    // 直前の講時で同じ先生がどこにいるか探す（連続講時の endPeriod も考慮）
                    const prevSubj = subjects.find(s =>
                        s.teacher === subject.teacher &&
                        s.day === subject.day &&
                        (s.endPeriod || s.period) === subject.period - 1 &&
                        s.term === subject.term
                    );
                    if (prevSubj) {
                        const prevAlloc = newAllocations.find(a => a.subjectId === prevSubj.id);
                        if (prevAlloc) {
                            if (prevAlloc.classroomId === room.id) {
                                score += weight; // 同じ教室なら満点
                            } else {
                                const prevRoom = classrooms.find(r => r.id === prevAlloc.classroomId);
                                if (prevRoom && prevRoom.building === room.building) {
                                    score += weight / 2; // 同じ建物なら半分
                                }
                            }
                        }
                    }
                }

                // 適切な教室サイズ (130-330%)
                if (isEnabled('capacity_fit')) {
                    const weight = getScore('capacity_fit');
                    const params = (ruleMap.get('capacity_fit')?.params as any) || { minRatio: 1.3, maxRatio: 3.3 };
                    const ratio = room.capacity / subject.requiredCapacity;
                    if (ratio >= params.minRatio && ratio <= params.maxRatio) {
                        score += weight;
                    } else if (ratio >= 1.0 && ratio < params.minRatio) {
                        score += weight / 2; // 近いサイズなら少し加点
                    }
                }

                // 連続講時同室（全連続講時対応）
                if (isEnabled('period_continuity')) {
                    const weight = getScore('period_continuity');
                    // 直前の講時の同じ教員の授業を探す
                    const prevSubj = subjects.find(s =>
                        s.teacher === subject.teacher &&
                        s.day === subject.day &&
                        (s.endPeriod || s.period) === subject.period - 1 &&
                        s.term === subject.term
                    );
                    if (prevSubj) {
                        const prevAlloc = newAllocations.find(a => a.subjectId === prevSubj.id);
                        if (prevAlloc && prevAlloc.classroomId === room.id) {
                            score += weight;
                        }
                    }
                    // 直後の講時の同じ教員の授業も探す
                    const nextSubj = subjects.find(s =>
                        s.teacher === subject.teacher &&
                        s.day === subject.day &&
                        s.period === (subject.endPeriod || subject.period) + 1 &&
                        s.term === subject.term
                    );
                    if (nextSubj) {
                        const nextAlloc = newAllocations.find(a => a.subjectId === nextSubj.id);
                        if (nextAlloc && nextAlloc.classroomId === room.id) {
                            score += weight;
                        }
                    }
                }

                // 春秋同一配当
                if (isEnabled('term_consistency')) {
                    const weight = getScore('term_consistency');
                    const termOpposites: Partial<Record<string, string>> = {
                        spring: 'autumn', autumn: 'spring',
                        spring_first: 'autumn_first', autumn_first: 'spring_first',
                        spring_second: 'autumn_second', autumn_second: 'spring_second',
                    };
                    const oppositeTerm = termOpposites[subject.term] ?? null;
                    if (oppositeTerm) {
                        const partner = subjects.find(s =>
                            s.teacher === subject.teacher &&
                            s.day === subject.day &&
                            s.period === subject.period &&
                            s.term === oppositeTerm
                        );
                        if (partner) {
                            const partnerAlloc = newAllocations.find(a => a.subjectId === partner.id);
                            if (partnerAlloc && partnerAlloc.classroomId === room.id) {
                                score += weight;
                            }
                        }
                    }
                }

                // 過年度教室優先
                if (isEnabled('previous_room') && subject.previousRooms && subject.previousRooms.length > 0) {
                    const weight = getScore('previous_room');
                    if (subject.previousRooms.includes(room.name)) {
                        score += weight;
                    }
                }

                // 前半・後半スタッキングボーナス（term_consistency が有効な場合のみ）
                // 春学期前半と後半（または秋）は時間的に重ならないため同室配当を優先
                if (isEnabled('term_consistency')) {
                    const complementary = getComplementaryTerm(subject.term);
                    if (complementary) {
                        const hasComplement = newAllocations.some(a => {
                            const s = subjects.find(sub => sub.id === a.subjectId);
                            if (!s || s.term !== complementary || s.day !== subject.day || a.classroomId !== room.id) return false;
                            const sStart = s.period;
                            const sEnd = s.endPeriod || s.period;
                            const tStart = subject.period;
                            const tEnd = subject.endPeriod || subject.period;
                            return sStart <= tEnd && tStart <= sEnd; // 期間が重なる（講時帯が同じ）
                        });
                        if (hasComplement) score += 60; // 同室スタック強ボーナス
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestClassroom = room;
                } else if (score === bestScore && bestClassroom) {
                    // スコアが同じなら、より「無駄の少ない（定員が近い）」方を選ぶ
                    if (room.capacity < bestClassroom.capacity) {
                        bestClassroom = room;
                    }
                }
            }

            if (bestClassroom) {
                newAllocations.push({
                    subjectId: subject.id,
                    classroomId: bestClassroom.id
                });
                const start = subject.period;
                const end = subject.endPeriod || subject.period;
                const termsToMarkNew = getTermsToMark(subject.term);
                for (let p = start; p <= end; p++) {
                    termsToMarkNew.forEach(t => occupied.add(`${t}-${subject.day}-${p}-${bestClassroom!.id}`));
                }
            } else {
                if (!unassigned.some(s => s.id === subject.id)) {
                    unassigned.push(subject);
                }
            }
        }
    }

    return {
        allocations: newAllocations,
        unassignedSubjects: unassigned
    };
};
