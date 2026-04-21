import type { Classroom, Subject } from '../types';

export interface Violation {
    type: 'error' | 'warning';
    message: string;
}

export const checkConstraints = (subject: Subject, room: Classroom): Violation[] => {
    const violations: Violation[] = [];

    if (room.capacity < subject.requiredCapacity) {
        violations.push({
            type: 'error',
            message: '定員不足'
        });
    }

    const hasAnyProjector = room.equipment.some(eq => eq.includes('PJ'));
    if (subject.requiresProjector && !hasAnyProjector) {
        violations.push({
            type: 'error',
            message: 'PJ不足'
        });
    }

    if (subject.requiresMovable && !room.isMovable) {
        violations.push({
            type: 'error',
            message: '可動不可'
        });
    }

    if (subject.mandatoryEquipment && subject.mandatoryEquipment.length > 0) {
        const missingMandatory = subject.mandatoryEquipment.filter(req => {
            if (req === '可動') return !room.isMovable;
            if (req === 'PJ(大)' || req === 'PJ(中)') {
                return !room.equipment.some(eq => eq === 'PJ(大)' || eq === 'PJ(中)');
            }
            return !room.equipment.some(eq => eq === req || eq.includes(req) || req.includes(eq));
        });

        if (missingMandatory.length > 0) {
            violations.push({
                type: 'error',
                message: '必須機材不足'
            });
        }
    }

    if (subject.requiredEquipment && subject.requiredEquipment.length > 0) {
        const missingDesired = subject.requiredEquipment.filter(req => {
            if (req === '可動') return !room.isMovable;
            if (req === 'PJ(大)' || req === 'PJ(中)') {
                return !room.equipment.some(eq => eq === 'PJ(大)' || eq === 'PJ(中)');
            }
            return !room.equipment.some(eq => eq === req || eq.includes(req) || req.includes(eq));
        });

        if (missingDesired.length > 0) {
            violations.push({
                type: 'warning',
                message: '希望機材不足'
            });
        }
    }

    if (subject.preferredRoomType && subject.preferredRoomType !== room.type) {
        violations.push({
            type: 'warning',
            message: '教室タイプ不一致'
        });
    }

    if (subject.buildingPreference && subject.buildingPreference !== room.building) {
        violations.push({
            type: 'warning',
            message: '建物希望不一致'
        });
    }

    return violations;
};
