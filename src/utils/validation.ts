import type { Classroom, Subject } from '../types';

export interface Violation {
    type: 'error' | 'warning';
    message: string;
}

export const checkConstraints = (subject: Subject, room: Classroom): Violation[] => {
    const violations: Violation[] = [];

    // --- Hard Constraints (Errors) ---

    // 1. Capacity
    if (room.capacity < subject.requiredCapacity) {
        violations.push({
            type: 'error',
            message: `定員不足 (必要: ${subject.requiredCapacity}, 教室: ${room.capacity})`
        });
    }

    // 2. Projector
    const hasAnyProjector = room.equipment.some(eq => eq.includes('PJ'));
    if (subject.requiresProjector && !hasAnyProjector) {
        violations.push({
            type: 'error',
            message: 'PJなし (必須)'
        });
    }

    // 3. Movable
    if (subject.requiresMovable && !room.isMovable) {
        violations.push({
            type: 'error',
            message: '可動式でない (必須)'
        });
    }

    // 4. Mandatory Equipment (Essential)
    if (subject.mandatoryEquipment && subject.mandatoryEquipment.length > 0) {
        const missingMandatory = subject.mandatoryEquipment.filter(req => {
            if (req === 'PJ(横)' || req === 'PJ(中)') {
                return !room.equipment.some(eq => eq === 'PJ(横)' || eq === 'PJ(中)');
            }
            return !room.equipment.some(eq => eq === req || eq.includes(req) || req.includes(eq));
        });

        if (missingMandatory.length > 0) {
            violations.push({
                type: 'error',
                message: `必須機材不足: ${missingMandatory.join(', ')}`
            });
        }
    }

    // --- Soft Constraints (Warnings) ---

    // 1. Desired Equipment (Score bonus)
    if (subject.requiredEquipment && subject.requiredEquipment.length > 0) {
        const missingDesired = subject.requiredEquipment.filter(req => {
            if (req === 'PJ(横)' || req === 'PJ(中)') {
                return !room.equipment.some(eq => eq === 'PJ(横)' || eq === 'PJ(中)');
            }
            return !room.equipment.some(eq => eq === req || eq.includes(req) || req.includes(eq));
        });

        if (missingDesired.length > 0) {
            violations.push({
                type: 'warning',
                message: `希望機材不足: ${missingDesired.join(', ')}`
            });
        }
    }

    // 2. Room Type
    if (subject.preferredRoomType && subject.preferredRoomType !== room.type) {
        const typeLabels: Record<string, string> = { normal: '一般', pc: 'PC', seminar: 'ゼミ' };
        violations.push({
            type: 'warning',
            message: `教室タイプ不一致 (希望: ${typeLabels[subject.preferredRoomType] || subject.preferredRoomType})`
        });
    }

    // 2. Building Preference
    if (subject.buildingPreference && subject.buildingPreference !== room.building) {
        violations.push({
            type: 'warning',
            message: `建物希望不一致 (希望: ${subject.buildingPreference}棟)`
        });
    }

    return violations;
};
