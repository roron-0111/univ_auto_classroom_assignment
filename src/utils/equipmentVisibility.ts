import { EQUIPMENT_LIST, normalizeEquipmentName } from '../types';

const HIDDEN_EQUIPMENT = new Set(['モニター', 'カーテン', 'TV']);

export const SUBJECT_EQUIPMENT_CHOICES = EQUIPMENT_LIST.filter(eq => !HIDDEN_EQUIPMENT.has(eq));

export const isHiddenEquipment = (name: string) => HIDDEN_EQUIPMENT.has(normalizeEquipmentName(name));

export const sanitizeSubjectEquipmentList = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items
    .filter((item): item is string => typeof item === 'string')
    .map(normalizeEquipmentName)
    .filter(item => !isHiddenEquipment(item))
    .filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      return true;
    });
};

export const filterVisibleRoomEquipment = (items: string[] = []) =>
  items
    .map(normalizeEquipmentName)
    .filter(item => !isHiddenEquipment(item));
