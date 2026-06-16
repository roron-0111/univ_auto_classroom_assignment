import type {
    Allocation,
    AllocationRule,
    AllocationRunOptions,
    Classroom,
    OptimizerResult,
    RelocationResult,
    RelocationMove,
    RelocationPlacement,
    PendingException,
    Subject,
    UnassignedInfo,
    UnassignedReason
} from '../types';
import { getTermsToMark, matchesEquipmentRequirement, normalizeRequiredEquipmentName } from '../types';
import { computeDifficulty } from './difficulty';
import { buildApprovalKey } from './approvalKey';
import { loadStreakMap } from './unassignedStreak';
import { findTermPartner, subjectsShareTeacherIdentity } from './termPair';

type EquipmentSettings = {
    items: { [key: string]: { enabled: boolean; importance: number } };
    strictLevel5: boolean;
};

type Candidate = {
    room: Classroom;
    exceptions: Array<'term_split' | 'room_type_relaxed'>;
    prefScores: number[];
    surplusCapacity: number;
};

type HardEligibilityOptions = {
    ignoreRoomType?: boolean;
};

const cloneAllocation = (allocation: Allocation): Allocation => ({
    ...allocation,
    exceptions: allocation.exceptions ? [...allocation.exceptions] : undefined
});

const getRuleMap = (rules: AllocationRule[]) => new Map(rules.map(rule => [rule.id, rule]));

const getPrefRules = (ruleMap: Map<string, AllocationRule>) =>
    [...ruleMap.values()]
        .filter(rule => rule.tier === 'pref' && rule.enabled)
        .sort((a, b) => a.order - b.order);

const getRelevantEquipmentSetting = (req: string, equipmentSettings?: EquipmentSettings) => {
    if (!equipmentSettings) return [];
    if (req === 'PJ' || req.startsWith('PJ')) {
        return ['PJ(中)', 'PJ(横)']
            .map(key => ({ key, setting: equipmentSettings.items?.[key] }))
            .filter(item => item.setting);
    }
    return [{ key: req, setting: equipmentSettings.items?.[req] }].filter(item => item.setting);
};

const getRequirementImportance = (req: string, equipmentSettings?: EquipmentSettings) => {
    const entries = getRelevantEquipmentSetting(req, equipmentSettings);
    if (entries.length === 0) return 3;
    const enabledEntries = entries.filter(entry => entry.setting.enabled);
    const source = enabledEntries.length > 0 ? enabledEntries : entries;
    return Math.max(...source.map(entry => entry.setting.importance));
};

const getRoomOccupiedKeys = (subject: Subject, classroomId: string) => {
    const keys: string[] = [];
    const start = subject.period;
    const end = subject.endPeriod || subject.period;
    const termsToMark = getTermsToMark(subject.term);
    for (let p = start; p <= end; p++) {
        termsToMark.forEach(term => keys.push(`${term}-${subject.day}-${p}-${classroomId}`));
    }
    return keys;
};

const markAllocation = (subject: Subject, allocation: Allocation, occupied: Set<string>) => {
    getRoomOccupiedKeys(subject, allocation.classroomId).forEach(key => occupied.add(key));
};

const unmarkAllocation = (subject: Subject, allocation: Allocation, occupied: Set<string>) => {
    getRoomOccupiedKeys(subject, allocation.classroomId).forEach(key => occupied.delete(key));
};

const getAdjacentSameTeacherSubject = (subject: Subject, subjects: Subject[], direction: 'prev' | 'next') => {
    if (direction === 'prev') {
        return subjects.find(s =>
            subjectsShareTeacherIdentity(s, subject) &&
            s.day === subject.day &&
            s.term === subject.term &&
            (s.endPeriod || s.period) === subject.period - 1
        ) || null;
    }

    return subjects.find(s =>
        subjectsShareTeacherIdentity(s, subject) &&
        s.day === subject.day &&
        s.term === subject.term &&
        s.period === (subject.endPeriod || subject.period) + 1
    ) || null;
};

const getAllocatedRoom = (subjectId: string, allocations: Allocation[]) => {
    const allocation = allocations.find(a => a.subjectId === subjectId);
    return allocation?.classroomId || null;
};

const getRoomById = (roomId: string, classrooms: Classroom[]) =>
    classrooms.find(room => room.id === roomId) || null;

const getRequiredItems = (subject: Subject) => {
    const requiredItems = new Set(
        [
            ...(subject.requiredEquipment || []),
            ...(subject.requiresProjector ? ['PJ'] : []),
            ...(subject.requiresMovable ? ['可動'] : [])
        ].map(normalizeRequiredEquipmentName)
    );
    return [...requiredItems];
};

const getMandatoryItems = (subject: Subject) => subject.mandatoryEquipment || [];

const passesStaticHardRules = (
    room: Classroom,
    subject: Subject,
    equipmentSettings?: EquipmentSettings,
    options: HardEligibilityOptions = {}
) => {
    if (room.isExcluded) return false;
    if (room.capacity < subject.requiredCapacity) return false;
    if (getMandatoryItems(subject).some(req => !matchesEquipmentRequirement(room, req))) return false;

    if (!options.ignoreRoomType && subject.preferredRoomType && subject.preferredRoomType !== room.type) return false;

    if (equipmentSettings?.strictLevel5) {
        for (const req of getRequiredItems(subject)) {
            const entries = getRelevantEquipmentSetting(req, equipmentSettings);
            const hasLevel5 = entries.some(entry => entry.setting.enabled && entry.setting.importance === 5);
            if (!hasLevel5) continue;
            if (!matchesEquipmentRequirement(room, req)) return false;
        }
    }

    return true;
};

const isHardCandidate = (
    room: Classroom,
    subject: Subject,
    occupied: Set<string>,
    newAllocations: Allocation[],
    equipmentSettings?: EquipmentSettings,
    options: HardEligibilityOptions = {}
) => {
    if (newAllocations.some(a => a.subjectId === subject.id && a.classroomId === room.id)) return false;

    const roomKeys = getRoomOccupiedKeys(subject, room.id);
    if (roomKeys.some(key => occupied.has(key))) return false;

    return passesStaticHardRules(room, subject, equipmentSettings, options);
};

const scoreTeacherContinuity = (room: Classroom, subject: Subject, subjects: Subject[], allocations: Allocation[], classrooms: Classroom[]) => {
    const prevSubj = getAdjacentSameTeacherSubject(subject, subjects, 'prev');
    const nextSubj = getAdjacentSameTeacherSubject(subject, subjects, 'next');

    const prevRoomId = prevSubj ? getAllocatedRoom(prevSubj.id, allocations) : null;
    const nextRoomId = nextSubj ? getAllocatedRoom(nextSubj.id, allocations) : null;

    if (prevRoomId === room.id || nextRoomId === room.id) return 1;

    const prevRoom = prevRoomId ? getRoomById(prevRoomId, classrooms) : null;
    const nextRoom = nextRoomId ? getRoomById(nextRoomId, classrooms) : null;
    const prevSameBuilding = prevRoom ? prevRoom.building === room.building : false;
    const nextSameBuilding = nextRoom ? nextRoom.building === room.building : false;

    if (prevSameBuilding || nextSameBuilding) return 0.5;
    return 0;
};

const scoreTermConsistency = (
    room: Classroom,
    subject: Subject,
    subjects: Subject[],
    allocations: Allocation[]
) => {
    if (subject.term === 'full_year') return 0;

    const partner = findTermPartner(subject, subjects);
    if (!partner) return 0;

    const partnerRoomId = getAllocatedRoom(partner.id, allocations);
    if (!partnerRoomId) return 0.5;
    return partnerRoomId === room.id ? 1 : 0;
};

const scoreEquipment = (room: Classroom, subject: Subject, equipmentSettings?: EquipmentSettings) => {
    const requiredItems = getRequiredItems(subject);
    if (requiredItems.length === 0) return 0;

    let totalRequiredWeight = 0;
    let satisfiedWeight = 0;

    for (const req of requiredItems) {
        const entries = getRelevantEquipmentSetting(req, equipmentSettings);
        if (entries.length > 0 && entries.every(entry => !entry.setting.enabled)) continue;

        const internalMultiplier = ['可動', 'BD', 'PJ(中)', 'PJ(横)', 'PJ'].includes(req) ? 2 : 1;
        const importance = getRequirementImportance(req, equipmentSettings);
        const weightedImportance = importance * internalMultiplier;
        totalRequiredWeight += weightedImportance;

        if (matchesEquipmentRequirement(room, req)) {
            satisfiedWeight += weightedImportance;
        }
    }

    if (totalRequiredWeight === 0) return 0;
    return satisfiedWeight / totalRequiredWeight;
};

const scoreCapacityFit = (room: Classroom, subject: Subject, ruleMap: Map<string, AllocationRule>) => {
    const rule = ruleMap.get('capacity_fit');
    const params = (rule?.params as { minRatio?: number; maxRatio?: number } | undefined) || {};
    const minRatio = params.minRatio ?? 1.3;
    const maxRatio = params.maxRatio ?? 3.3;
    const ratio = room.capacity / subject.requiredCapacity;

    if (ratio >= minRatio && ratio <= maxRatio) return 1;
    if (ratio >= 1.0 && ratio < minRatio) return 0.5;
    return 0.2;
};

const scoreBuildingPreference = (room: Classroom, subject: Subject) =>
    subject.buildingPreference && room.building === subject.buildingPreference ? 1 : 0;

const scorePreviousRoom = (room: Classroom, subject: Subject) =>
    subject.previousRooms?.includes(room.name) ? 1 : 0;

const getPrefScores = (
    room: Classroom,
    subject: Subject,
    subjects: Subject[],
    allocations: Allocation[],
    classrooms: Classroom[],
    ruleMap: Map<string, AllocationRule>,
    equipmentSettings?: EquipmentSettings
) => {
    const prefRules = getPrefRules(ruleMap);
    return prefRules.map(rule => {
        switch (rule.id) {
            case 'teacher_continuity':
                return scoreTeacherContinuity(room, subject, subjects, allocations, classrooms);
            case 'term_consistency':
                return scoreTermConsistency(room, subject, subjects, allocations);
            case 'equipment':
                return scoreEquipment(room, subject, equipmentSettings);
            case 'capacity_fit':
                return scoreCapacityFit(room, subject, ruleMap);
            case 'building_preference':
                return scoreBuildingPreference(room, subject);
            case 'previous_room':
                return scorePreviousRoom(room, subject);
            default:
                return 0;
        }
    });
};

const compareCandidates = (a: Candidate, b: Candidate) => {
    const length = Math.max(a.prefScores.length, b.prefScores.length);
    for (let i = 0; i < length; i++) {
        const aScore = a.prefScores[i] ?? 0;
        const bScore = b.prefScores[i] ?? 0;
        if (aScore !== bScore) return bScore - aScore;
    }

    if (a.surplusCapacity !== b.surplusCapacity) {
        return a.surplusCapacity - b.surplusCapacity;
    }

    if (a.room.capacity !== b.room.capacity) {
        return a.room.capacity - b.room.capacity;
    }

    return a.room.name.localeCompare(b.room.name, 'ja');
};

const buildCandidate = (
    room: Classroom,
    subject: Subject,
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    ruleMap: Map<string, AllocationRule>,
    occupied: Set<string>,
    equipmentSettings?: EquipmentSettings
): Candidate | null => {
    if (!isHardCandidate(room, subject, occupied, allocations, equipmentSettings)) return null;

    const prefScores = getPrefScores(room, subject, subjects, allocations, classrooms, ruleMap, equipmentSettings);
    return {
        room,
        exceptions: [],
        prefScores,
        surplusCapacity: room.capacity - subject.requiredCapacity
    };
};

const pickBestCandidate = (
    subject: Subject,
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    occupied: Set<string>,
    ruleMap: Map<string, AllocationRule>,
    equipmentSettings?: EquipmentSettings
) => {
    const candidates = classrooms
        .map(room => buildCandidate(room, subject, subjects, classrooms, allocations, ruleMap, occupied, equipmentSettings))
        .filter((candidate): candidate is Candidate => candidate !== null);

    if (candidates.length === 0) return null;
    candidates.sort(compareCandidates);
    return candidates[0];
};

const hasCandidateIfRoomTypeIgnored = (
    subject: Subject,
    classrooms: Classroom[],
    allocations: Allocation[],
    occupied: Set<string>,
    equipmentSettings?: EquipmentSettings
) => {
    if (!subject.preferredRoomType) return false;
    return classrooms.some(room =>
        room.type !== subject.preferredRoomType &&
        isHardCandidate(room, subject, occupied, allocations, equipmentSettings, { ignoreRoomType: true })
    );
};

const classifyUnassigned = (
    subject: Subject,
    strictCandidatesCount: number,
    requiredRoomCountShort: boolean,
    roomTypeBlocked: boolean
): { reason: UnassignedReason; detail?: string } => {
    if (requiredRoomCountShort) {
        return {
            reason: 'U4_room_count_short',
            detail: `必要教室数 ${subject.requiredRoomCount || 1} 室を満たせなかった`
        };
    }

    if (roomTypeBlocked) {
        return {
            reason: 'U2_room_type_blocked',
            detail: '教室タイプを満たす候補教室がない'
        };
    }

    if (strictCandidatesCount === 0) {
        return {
            reason: 'U1_no_hard_candidate',
            detail: '必須条件を満たす候補教室がない'
        };
    }

    return {
        reason: 'U1_no_hard_candidate',
        detail: '候補教室が見つからない'
    };
};

const getAlternativeUnassignedReason = (exceptions: Array<'term_split' | 'room_type_relaxed'>): UnassignedReason =>
    exceptions.includes('term_split') ? 'U3_term_split_blocked' : 'U2_room_type_blocked';

export const runAutoAllocation = (
    subjects: Subject[],
    classrooms: Classroom[],
    currentAllocations: Allocation[] = [],
    rules: AllocationRule[] = [],
    equipmentSettings?: EquipmentSettings,
    runOptions: AllocationRunOptions = {}
): OptimizerResult => {
    const ruleMap = getRuleMap(rules);
    const contextSubjects = runOptions.contextSubjects || subjects;

    const occupied = new Set<string>();
    const newAllocations: Allocation[] = currentAllocations.map(cloneAllocation);
    const pendingExceptions: PendingException[] = [];
    const streakMap = runOptions.ignoreStreakOnce ? new Map<string, number>() : (runOptions.streakMap || loadStreakMap());

    currentAllocations.forEach(alloc => {
        const subj = contextSubjects.find(s => s.id === alloc.subjectId);
        if (!subj) return;
        markAllocation(subj, alloc, occupied);
    });

    const sortedSubjects = [...subjects].map((subject, index) => ({
        subject,
        index,
        difficulty: computeDifficulty(subject, contextSubjects, classrooms, rules, equipmentSettings, streakMap)
    })).sort((a, b) => {
        const priorityDiff = (b.subject.priority || 1) - (a.subject.priority || 1);
        if (priorityDiff !== 0) return priorityDiff;
        const diffDiff = b.difficulty.score - a.difficulty.score;
        if (diffDiff !== 0) return diffDiff;
        const streakDiff = b.difficulty.lastUnassignedStreak - a.difficulty.lastUnassignedStreak;
        if (streakDiff !== 0) return streakDiff;
        return a.index - b.index;
    });

    const unassigned: UnassignedInfo[] = [];

    for (const { subject } of sortedSubjects) {
        const requiredRoomCount = subject.requiredRoomCount || 1;
        const existingCount = newAllocations.filter(a => a.subjectId === subject.id).length;
        if (existingCount >= requiredRoomCount) continue;

        const addedThisRound: Allocation[] = [];
        const addedOccupied: Array<{ allocation: Allocation; subject: Subject }> = [];
        let remaining = requiredRoomCount - existingCount;

        let strictCandidatesCount = 0;
        let failed = false;

        while (remaining > 0) {
            const strictCandidate = pickBestCandidate(
                subject,
                contextSubjects,
                classrooms,
                newAllocations,
                occupied,
                ruleMap,
                equipmentSettings
            );

            const chosen = strictCandidate;
            if (strictCandidate) {
                strictCandidatesCount++;
            }

            if (!chosen) {
                failed = true;
                break;
            }

            const approvalKey = chosen.exceptions.length > 0
                ? buildApprovalKey(subject.id, chosen.room.id, chosen.exceptions)
                : null;
            const allocation: Allocation = {
                subjectId: subject.id,
                classroomId: chosen.room.id,
                exceptions: chosen.exceptions.length > 0 ? [...chosen.exceptions] : undefined,
                exceptionApproved: chosen.exceptions.length > 0
                    ? (!runOptions.dryRunExceptions || runOptions.approvedExceptions?.has(approvalKey!))
                        ? true
                        : undefined
                    : undefined
            };

            newAllocations.push(allocation);
            addedThisRound.push(allocation);
            addedOccupied.push({ allocation, subject });
            markAllocation(subject, allocation, occupied);

            if (runOptions.dryRunExceptions && chosen.exceptions.length > 0) {
                const key = buildApprovalKey(subject.id, chosen.room.id, chosen.exceptions);
                if (!runOptions.approvedExceptions?.has(key)) {
                    pendingExceptions.push({
                        subject,
                        classroomId: chosen.room.id,
                        exceptions: [...chosen.exceptions],
                        alternativeUnassignedReason: getAlternativeUnassignedReason(chosen.exceptions)
                    });
                }
            }

            remaining -= 1;
        }

        if (failed || remaining > 0) {
            while (addedOccupied.length > 0) {
                const item = addedOccupied.pop()!;
                unmarkAllocation(item.subject, item.allocation, occupied);
                const idx = newAllocations.lastIndexOf(item.allocation);
                if (idx >= 0) newAllocations.splice(idx, 1);
            }

            const reasonInfo = classifyUnassigned(
                subject,
                strictCandidatesCount,
                remaining > 0 && addedThisRound.length > 0,
                hasCandidateIfRoomTypeIgnored(subject, classrooms, newAllocations, occupied, equipmentSettings)
            );

            if (!unassigned.some(item => item.subject.id === subject.id)) {
                unassigned.push({
                    subject,
                    reason: reasonInfo.reason,
                    detail: reasonInfo.detail
                });
            }
        }
    }

    return {
        allocations: newAllocations,
        unassigned,
        pendingExceptions: pendingExceptions.length > 0 ? pendingExceptions : undefined
    };
};

export const resolveExceptions = (
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    rules: AllocationRule[],
    equipmentSettings?: EquipmentSettings
): { allocations: Allocation[]; resolved: Array<{ subjectId: string; from: string; to: string }> } => {
    const ruleMap = getRuleMap(rules);
    const result = allocations.map(cloneAllocation);
    const resolved: Array<{ subjectId: string; from: string; to: string }> = [];
    const occupied = new Set<string>();

    result.forEach(alloc => {
        const subj = subjects.find(s => s.id === alloc.subjectId);
        if (!subj) return;
        markAllocation(subj, alloc, occupied);
    });

    const exceptionalAllocations = result.filter(a => a.exceptions && a.exceptions.length > 0 && !a.exceptionApproved);

    for (const alloc of exceptionalAllocations) {
        const subject = subjects.find(s => s.id === alloc.subjectId);
        if (!subject) continue;

        unmarkAllocation(subject, alloc, occupied);

        const candidate = pickBestCandidate(
            subject,
            subjects,
            classrooms,
            result,
            occupied,
            ruleMap,
            equipmentSettings
        );

        if (candidate && candidate.exceptions.length === 0) {
            resolved.push({ subjectId: subject.id, from: alloc.classroomId, to: candidate.room.id });
            alloc.classroomId = candidate.room.id;
            alloc.exceptions = undefined;
            alloc.exceptionApproved = undefined;
            markAllocation(subject, alloc, occupied);
        } else {
            markAllocation(subject, alloc, occupied);
        }
    }

    return { allocations: result, resolved };
};

type RelocationSearchState = {
    allocations: Allocation[];
    occupied: Set<string>;
    moves: RelocationMove[];
    placed: RelocationPlacement[];
    cost: number;
};

const cloneRelocationState = (state: RelocationSearchState): RelocationSearchState => ({
    allocations: state.allocations.map(cloneAllocation),
    occupied: new Set(state.occupied),
    moves: state.moves.map(move => ({ ...move })),
    placed: state.placed.map(item => ({ ...item })),
    cost: state.cost
});

const preferenceScore = (scores: number[]) =>
    scores.reduce((total, score, index) => total + score * Math.pow(0.5, index), 0);

const isHardRoomEligible = (
    room: Classroom,
    subject: Subject,
    equipmentSettings?: EquipmentSettings
) => {
    return passesStaticHardRules(room, subject, equipmentSettings);
};

const buildRelocationCandidate = (
    room: Classroom,
    subject: Subject,
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    ruleMap: Map<string, AllocationRule>,
    equipmentSettings?: EquipmentSettings,
    allowedExceptions: Array<'term_split' | 'room_type_relaxed'> = []
): Candidate | null => {
    void allowedExceptions;
    if (!isHardRoomEligible(room, subject, equipmentSettings)) return null;

    return {
        room,
        exceptions: [],
        prefScores: getPrefScores(room, subject, subjects, allocations, classrooms, ruleMap, equipmentSettings),
        surplusCapacity: room.capacity - subject.requiredCapacity
    };
};

const getRelocationCandidates = (
    subject: Subject,
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    ruleMap: Map<string, AllocationRule>,
    equipmentSettings?: EquipmentSettings,
    bannedRoomIds: Set<string> = new Set(),
    allowedExceptions: Array<'term_split' | 'room_type_relaxed'> = []
) =>
    classrooms
        .map(room => (bannedRoomIds.has(room.id) ? null : buildRelocationCandidate(room, subject, subjects, classrooms, allocations, ruleMap, equipmentSettings, allowedExceptions)))
        .filter((candidate): candidate is Candidate => candidate !== null)
        .sort(compareCandidates);

const getBlockersForRoom = (
    subject: Subject,
    room: Classroom,
    allocations: Allocation[],
    subjects: Subject[]
) => {
    const targetKeys = new Set(getRoomOccupiedKeys(subject, room.id));
    return allocations.filter(allocation => {
        if (allocation.subjectId === subject.id) return false;
        if (allocation.classroomId !== room.id) return false;
        const blockerSubject = subjects.find(s => s.id === allocation.subjectId);
        if (!blockerSubject) return false;
        return getRoomOccupiedKeys(blockerSubject, allocation.classroomId).some(key => targetKeys.has(key));
    });
};

const addAllocationToState = (
    state: RelocationSearchState,
    subject: Subject,
    roomId: string,
    exceptions?: Array<'term_split' | 'room_type_relaxed'>
) => {
    const allocation: Allocation = {
        subjectId: subject.id,
        classroomId: roomId,
        exceptions: exceptions && exceptions.length > 0 ? [...exceptions] : undefined
    };
    state.allocations.push(allocation);
    markAllocation(subject, allocation, state.occupied);
};

const removeAllocationFromState = (
    state: RelocationSearchState,
    subject: Subject,
    roomId: string
) => {
    const index = state.allocations.findIndex(a => a.subjectId === subject.id && a.classroomId === roomId);
    if (index < 0) return false;
    const allocation = state.allocations[index];
    if (allocation.isLocked) return false;
    unmarkAllocation(subject, allocation, state.occupied);
    state.allocations.splice(index, 1);
    return true;
};

const buildRelocationState = (subjects: Subject[], allocations: Allocation[]) => {
    const occupied = new Set<string>();
    allocations.forEach(alloc => {
        const subject = subjects.find(s => s.id === alloc.subjectId);
        if (!subject) return;
        markAllocation(subject, alloc, occupied);
    });

    const state: RelocationSearchState = {
        allocations: allocations.map(cloneAllocation),
        occupied,
        moves: [],
        placed: [],
        cost: 0
    };

    return state;
};

const moveCost = (
    subject: Subject,
    fromRoom: Classroom,
    toRoom: Classroom,
    subjects: Subject[],
    allocations: Allocation[],
    classrooms: Classroom[],
    ruleMap: Map<string, AllocationRule>,
    equipmentSettings?: EquipmentSettings
) => {
    const fromScore = preferenceScore(getPrefScores(fromRoom, subject, subjects, allocations, classrooms, ruleMap, equipmentSettings));
    const toScore = preferenceScore(getPrefScores(toRoom, subject, subjects, allocations, classrooms, ruleMap, equipmentSettings));
    const priorityWeight = Math.max(1, subject.priority || 1);
    return Math.max(0, fromScore - toScore) * priorityWeight;
};

const placementBenefit = (
    subject: Subject,
    room: Classroom,
    subjects: Subject[],
    allocations: Allocation[],
    classrooms: Classroom[],
    ruleMap: Map<string, AllocationRule>,
    equipmentSettings?: EquipmentSettings
) => {
    const score = preferenceScore(getPrefScores(room, subject, subjects, allocations, classrooms, ruleMap, equipmentSettings));
    return Math.max(1, subject.priority || 1) * 2 + score;
};

const attemptRelocationPlacement = (
    subject: Subject,
    room: Classroom,
    state: RelocationSearchState,
    subjects: Subject[],
    classrooms: Classroom[],
    ruleMap: Map<string, AllocationRule>,
    depthRemaining: number,
    context: { isRoot?: boolean; fromRoomId?: string; exceptions?: Array<'term_split' | 'room_type_relaxed'> },
    bannedRoomIds: Set<string>,
    visited: Set<string>,
    equipmentSettings?: EquipmentSettings
): RelocationSearchState | null => {
    if (!isHardRoomEligible(room, subject, equipmentSettings)) return null;
    if (state.allocations.some(allocation => allocation.subjectId === subject.id && allocation.classroomId === room.id)) return null;

    const visitKey = `${subject.id}__${room.id}`;
    const nextVisited = context.isRoot ? visited : new Set(visited);
    if (!context.isRoot) {
        if (visited.has(visitKey)) return null;
        nextVisited.add(visitKey);
    }

    const blockers = getBlockersForRoom(subject, room, state.allocations, subjects);
    if (blockers.length === 0) {
        const nextState = cloneRelocationState(state);
        addAllocationToState(nextState, subject, room.id, context.exceptions);
        if (context.fromRoomId) {
            const fromRoom = getRoomById(context.fromRoomId, classrooms);
            if (fromRoom) {
                nextState.moves.push({ subjectId: subject.id, fromRoomId: context.fromRoomId, toRoomId: room.id });
                nextState.cost += moveCost(subject, fromRoom, room, subjects, nextState.allocations, classrooms, ruleMap, equipmentSettings);
            }
        } else if (context.isRoot) {
            nextState.placed.push({ subjectId: subject.id, roomId: room.id });
        }
        return nextState;
    }

    if (depthRemaining <= 0) return null;

    const blockerCandidates = blockers
        .map(allocation => {
            const blockerSubject = subjects.find(s => s.id === allocation.subjectId);
            const currentExceptions = allocation.exceptions || [];
            const candidateCount = blockerSubject
                ? allocation.isLocked
                    ? 0
                    : getRelocationCandidates(
                    blockerSubject,
                    subjects,
                    classrooms,
                    state.allocations.filter(a => !(a.subjectId === allocation.subjectId && a.classroomId === allocation.classroomId)),
                    ruleMap,
                    equipmentSettings,
                    new Set([room.id, allocation.classroomId, ...bannedRoomIds]),
                    currentExceptions
                ).length
                : 0;
            return { allocation, blockerSubject, candidateCount, currentExceptions };
        })
        .sort((a, b) => {
            if (a.candidateCount !== b.candidateCount) return a.candidateCount - b.candidateCount;
            return (b.blockerSubject?.priority || 1) - (a.blockerSubject?.priority || 1);
        });

    let bestState: RelocationSearchState | null = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const blocker of blockerCandidates) {
        if (!blocker.blockerSubject) continue;

        const workingState = cloneRelocationState(state);
        const removed = removeAllocationFromState(workingState, blocker.blockerSubject, blocker.allocation.classroomId);
        if (!removed) continue;

        const excludeRooms = new Set([room.id, blocker.allocation.classroomId, ...bannedRoomIds]);
        const relocationChoices = getRelocationCandidates(
            blocker.blockerSubject,
            subjects,
            classrooms,
            workingState.allocations,
            ruleMap,
            equipmentSettings,
            excludeRooms,
            blocker.currentExceptions
        ).slice(0, 5);

        const fromRoom = getRoomById(blocker.allocation.classroomId, classrooms);
        const filteredChoices = fromRoom
            ? relocationChoices.filter(candidate => {
                const fromScore = scoreTeacherContinuity(fromRoom, blocker.blockerSubject!, subjects, workingState.allocations, classrooms);
                const toScore = scoreTeacherContinuity(candidate.room, blocker.blockerSubject!, subjects, workingState.allocations, classrooms);
                return !(fromScore >= 1 && toScore < 1);
            })
            : relocationChoices;

        for (const candidate of filteredChoices) {
            const branch = cloneRelocationState(workingState);
            const moved = attemptRelocationPlacement(
                blocker.blockerSubject,
                candidate.room,
                branch,
                subjects,
                classrooms,
                ruleMap,
                depthRemaining - 1,
                { fromRoomId: blocker.allocation.classroomId, exceptions: candidate.exceptions },
                new Set([...bannedRoomIds, room.id, blocker.allocation.classroomId]),
                nextVisited,
                equipmentSettings
            );

            if (!moved) continue;

            const cleared = attemptRelocationPlacement(
                subject,
                room,
                moved,
                subjects,
                classrooms,
                ruleMap,
                depthRemaining,
                context,
                bannedRoomIds,
                nextVisited,
                equipmentSettings
            );

            if (!cleared) continue;
            if (cleared.cost < bestCost) {
                bestState = cleared;
                bestCost = cleared.cost;
            }
        }
    }

    return bestState;
};

const finalizeRelocationUnassigned = (
    subject: Subject,
    originalReason: UnassignedReason,
    remainingCount: number
): UnassignedInfo => {
    const convertedReason =
        originalReason === 'U1_no_hard_candidate' || originalReason === 'U4_room_count_short'
            ? 'U5_swap_failed'
            : originalReason;

    const detail = remainingCount > 0
        ? `交換配当ではあと ${remainingCount} 室不足です`
        : '交換配当でも解消できませんでした';

    return {
        subject,
        reason: convertedReason,
        detail
    };
};

export const relocateForUnassigned = (
    subjects: Subject[],
    classrooms: Classroom[],
    allocations: Allocation[],
    unassigned: UnassignedInfo[],
    rules: AllocationRule[],
    equipmentSettings?: EquipmentSettings,
    options?: { maxDepth?: 1 | 2; timeoutMs?: number }
): RelocationResult => {
    const ruleMap = getRuleMap(rules);
    const maxDepth = options?.maxDepth ?? 2;
    const timeoutMs = options?.timeoutMs ?? 30000;
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    let state = buildRelocationState(subjects, allocations);
    const moves: RelocationMove[] = [];
    const placed: RelocationPlacement[] = [];
    const unresolved: UnassignedInfo[] = [];

    const reasonOrder: UnassignedReason[] = [
        'U4_room_count_short',
        'U1_no_hard_candidate',
        'U3_term_split_blocked',
        'U2_room_type_blocked',
        'U5_swap_failed'
    ];

    const orderedUnassigned = [...unassigned].sort((a, b) => {
        const reasonDiff = reasonOrder.indexOf(a.reason) - reasonOrder.indexOf(b.reason);
        if (reasonDiff !== 0) return reasonDiff;
        const priorityDiff = (b.subject.priority || 1) - (a.subject.priority || 1);
        if (priorityDiff !== 0) return priorityDiff;
        return a.subject.id.localeCompare(b.subject.id);
    });

    for (const item of orderedUnassigned) {
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
        if (elapsed > timeoutMs) {
            unresolved.push(finalizeRelocationUnassigned(item.subject, item.reason, item.subject.requiredRoomCount || 1));
            continue;
        }

        const requiredRoomCount = item.subject.requiredRoomCount || 1;
        const currentCount = state.allocations.filter(allocation => allocation.subjectId === item.subject.id).length;
        let remainingCount = Math.max(0, requiredRoomCount - currentCount);

        if (remainingCount === 0) continue;

        while (remainingCount > 0) {
            const candidateRooms = getRelocationCandidates(
                item.subject,
                subjects,
                classrooms,
                state.allocations,
                ruleMap,
                equipmentSettings
            ).slice(0, 5);

            let bestBranch: RelocationSearchState | null = null;
            let bestNet = Number.NEGATIVE_INFINITY;

            for (const candidate of candidateRooms) {
                const branch = cloneRelocationState(state);
                const relocated = attemptRelocationPlacement(
                    item.subject,
                    candidate.room,
                    branch,
                    subjects,
                    classrooms,
                    ruleMap,
                    maxDepth,
                    { isRoot: true },
                    new Set(),
                    new Set(),
                    equipmentSettings
                );

                if (!relocated) continue;

                const benefit = placementBenefit(
                    item.subject,
                    candidate.room,
                    subjects,
                    relocated.allocations,
                    classrooms,
                    ruleMap,
                    equipmentSettings
                );
                const net = benefit - relocated.cost;
                if (net > bestNet) {
                    bestNet = net;
                    bestBranch = relocated;
                }
            }

            if (!bestBranch || bestNet <= 0) break;

            state = bestBranch;
            state.moves.forEach(move => {
                if (!moves.some(existing => existing.subjectId === move.subjectId && existing.fromRoomId === move.fromRoomId && existing.toRoomId === move.toRoomId)) {
                    moves.push(move);
                }
            });
            state.placed.forEach(item => {
                if (!placed.some(existing => existing.subjectId === item.subjectId && existing.roomId === item.roomId)) {
                    placed.push(item);
                }
            });

            const nextCount = state.allocations.filter(allocation => allocation.subjectId === item.subject.id).length;
            const nextRemaining = Math.max(0, requiredRoomCount - nextCount);
            if (nextRemaining === remainingCount) break;
            remainingCount = nextRemaining;
        }

        if (remainingCount > 0) {
            unresolved.push(finalizeRelocationUnassigned(item.subject, item.reason, remainingCount));
        }
    }

    return {
        allocations: state.allocations,
        unassigned: unresolved,
        moves,
        placed,
        unresolved
    };
};
