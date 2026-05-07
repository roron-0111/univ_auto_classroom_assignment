import { EQUIPMENT_LIST, normalizeEquipmentName } from '../types';

const HIDDEN_EQUIPMENT = new Set(['モニター', 'カーテン', 'TV']);

export const SUBJECT_EQUIPMENT_CHOICES = EQUIPMENT_LIST.filter(eq => !HIDDEN_EQUIPMENT.has(eq));

export const isHiddenEquipment = (name: string) => HIDDEN_EQUIPMENT.has(normalizeEquipmentName(name));

export const sortEquipmentByCanonicalOrder = (items: string[] = []) => {
  const normalized = items
    .map(normalizeEquipmentName)
    .filter(item => item && !isHiddenEquipment(item));

  const seen = new Set<string>();
  const ordered: string[] = [];

  EQUIPMENT_LIST.forEach(eq => {
    if (normalized.includes(eq) && !seen.has(eq)) {
      ordered.push(eq);
      seen.add(eq);
    }
  });

  normalized.forEach(eq => {
    if (!seen.has(eq)) {
      ordered.push(eq);
      seen.add(eq);
    }
  });

  return ordered;
};

export const sanitizeSubjectEquipmentList = (items: unknown): string[] => {
  if (!Array.isArray(items)) return [];
  return sortEquipmentByCanonicalOrder(items.filter((item): item is string => typeof item === 'string'));
};

export const filterVisibleRoomEquipment = (items: string[] = []) =>
  sortEquipmentByCanonicalOrder(items);
