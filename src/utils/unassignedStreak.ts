import type { Subject, UnassignedInfo } from '../types';

const STREAK_KEY = 'subjectRoom_unassignedStreak';

const hasSessionStorage = () => typeof sessionStorage !== 'undefined';

export const loadStreakMap = (): Map<string, number> => {
  try {
    if (!hasSessionStorage()) return new Map();
    const raw = sessionStorage.getItem(STREAK_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as Record<string, number>;
    return new Map(Object.entries(parsed).map(([key, value]) => [key, Number(value) || 0]));
  } catch {
    return new Map();
  }
};

export const saveStreakMap = (map: Map<string, number>) => {
  if (!hasSessionStorage()) return;
  const obj: Record<string, number> = {};
  map.forEach((value, key) => {
    obj[key] = value;
  });
  sessionStorage.setItem(STREAK_KEY, JSON.stringify(obj));
};

export const clearStreakMap = () => {
  if (!hasSessionStorage()) return;
  sessionStorage.removeItem(STREAK_KEY);
};

export const pruneStreakMap = (subjects: Subject[]) => {
  const map = loadStreakMap();
  const subjectIds = new Set(subjects.map(subject => subject.id));
  let changed = false;

  for (const key of map.keys()) {
    if (!subjectIds.has(key)) {
      map.delete(key);
      changed = true;
    }
  }

  if (changed) saveStreakMap(map);
  return map;
};

export const updateStreakAfterAllocation = (
  allAttempted: Subject[],
  unassigned: UnassignedInfo[]
): Map<string, number> => {
  const map = loadStreakMap();
  const unassignedIds = new Set(unassigned.map(item => item.subject.id));

  for (const subject of allAttempted) {
    if (unassignedIds.has(subject.id)) {
      map.set(subject.id, (map.get(subject.id) || 0) + 1);
    } else {
      map.delete(subject.id);
    }
  }

  saveStreakMap(map);
  return map;
};
