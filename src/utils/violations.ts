import type { Classroom, Subject } from '../types';

export type ViolationType =
  | 'capacity_short'
  | 'mandatory_equipment_missing'
  | 'room_type_mismatch'
  | 'building_mismatch'
  | 'excluded_room';

export interface Violation {
  type: ViolationType;
  severity: 'error' | 'warning' | 'info';
  message: string;
}

const matchesEquipment = (room: Classroom, req: string) => {
  if (req === '可動') return room.isMovable;
  if (req === 'PJ') return room.equipment.some(eq => eq.includes('PJ'));
  if (req === 'PJ(中)' || req === 'PJ(大)') {
    return room.equipment.some(eq => eq === 'PJ(中)' || eq === 'PJ(大)' || eq.includes('PJ'));
  }
  return room.equipment.some(eq => eq === req || eq.includes(req) || req.includes(eq));
};

export const detectViolations = (subject: Subject, room: Classroom): Violation[] => {
  const violations: Violation[] = [];

  if (room.isExcluded) {
    violations.push({
      type: 'excluded_room',
      severity: 'error',
      message: '配当対象外教室です'
    });
  }

  if (room.capacity < subject.requiredCapacity) {
    violations.push({
      type: 'capacity_short',
      severity: 'error',
      message: `定員不足 (${room.capacity} < ${subject.requiredCapacity})`
    });
  }

  for (const req of subject.mandatoryEquipment || []) {
    if (!matchesEquipment(room, req)) {
      violations.push({
        type: 'mandatory_equipment_missing',
        severity: 'error',
        message: `必須機材不足: ${req}`
      });
    }
  }

  if (subject.preferredRoomType && subject.preferredRoomType !== room.type) {
    violations.push({
      type: 'room_type_mismatch',
      severity: 'info',
      message: `教室タイプ不一致 (${subject.preferredRoomType} -> ${room.type})`
    });
  }

  if (subject.buildingPreference && subject.buildingPreference !== room.building) {
    violations.push({
      type: 'building_mismatch',
      severity: 'info',
      message: `建物希望不一致 (${subject.buildingPreference} 以外)`
    });
  }

  return violations;
};
