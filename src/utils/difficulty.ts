import type { AllocationRule, Classroom, Subject } from '../types';
import { matchesEquipmentRequirement, normalizeRequiredEquipmentName } from '../types';
import { findTermPartner } from './termPair';

type EquipmentSettings = {
  items: { [key: string]: { enabled: boolean; importance: number } };
  strictLevel5: boolean;
};

export interface DifficultyBreakdown {
  strictCandidateCount: number;
  mandatoryEquipmentCount: number;
  requiredEquipmentWeight: number;
  rareRoomTypeFlag: boolean;
  capacityPressure: number;
  continuityFlag: boolean;
  termPairFlag: boolean;
  multiRoomFlag: boolean;
  lastUnassignedStreak: number;
  score: number;
}

export interface DifficultyEntry {
  subject: Subject;
  breakdown: DifficultyBreakdown;
}

const WEIGHTS = {
  strictCandidateCount: 1,
  mandatoryEquipmentCount: 3,
  requiredEquipmentWeight: 0.5,
  rareRoomTypeFlag: 5,
  capacityPressure: 2,
  continuityFlag: 3,
  termPairFlag: 2,
  multiRoomFlag: 4,
  lastUnassignedStreak: 2
} as const;

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

const getRequiredItems = (subject: Subject) =>
  [...new Set(
    [
      ...(subject.requiredEquipment || []),
      ...(subject.requiresProjector ? ['PJ'] : []),
      ...(subject.requiresMovable ? ['可動'] : [])
    ].map(normalizeRequiredEquipmentName)
  )];

const getStrictCandidateCount = (subject: Subject, classrooms: Classroom[], equipmentSettings?: EquipmentSettings) =>
  classrooms.filter(room =>
    !room.isExcluded &&
    room.capacity >= subject.requiredCapacity &&
    (!subject.preferredRoomType || subject.preferredRoomType === room.type) &&
    (subject.mandatoryEquipment || []).every(req => matchesEquipmentRequirement(room, req)) &&
    (!equipmentSettings?.strictLevel5 || getRequiredItems(subject).every(req => {
      const entries = getRelevantEquipmentSetting(req, equipmentSettings);
      const hasLevel5 = entries.some(entry => entry.setting.enabled && entry.setting.importance === 5);
      return !hasLevel5 || matchesEquipmentRequirement(room, req);
    }))
  ).length;

export const computeDifficulty = (
  subject: Subject,
  subjects: Subject[],
  classrooms: Classroom[],
  _rules: AllocationRule[],
  equipmentSettings: EquipmentSettings | undefined,
  streakMap: Map<string, number>
): DifficultyBreakdown => {
  void _rules;

  const strictCandidateCount = getStrictCandidateCount(subject, classrooms, equipmentSettings);
  const capacities = classrooms.map(room => room.capacity).sort((a, b) => a - b);
  const median = capacities.length > 0 ? capacities[Math.floor(capacities.length / 2)] : 1;
  const capacityPressure = Math.min(2, subject.requiredCapacity / Math.max(1, median));
  const requiredEquipmentWeight = getRequiredItems(subject).reduce((sum, req) => sum + getRequirementImportance(req, equipmentSettings), 0);
  const rareRoomTypeFlag = subject.preferredRoomType === 'pc' || subject.preferredRoomType === 'seminar';
  const continuityFlag = (subject.endPeriod || subject.period) > subject.period;
  const termPairFlag = !!findTermPartner(subject, subjects);
  const multiRoomFlag = (subject.requiredRoomCount || 1) > 1;
  const lastUnassignedStreak = streakMap.get(subject.id) || 0;

  const score =
    (classrooms.length - strictCandidateCount) * WEIGHTS.strictCandidateCount +
    (subject.mandatoryEquipment?.length || 0) * WEIGHTS.mandatoryEquipmentCount +
    requiredEquipmentWeight * WEIGHTS.requiredEquipmentWeight +
    (rareRoomTypeFlag ? WEIGHTS.rareRoomTypeFlag : 0) +
    capacityPressure * WEIGHTS.capacityPressure +
    (continuityFlag ? WEIGHTS.continuityFlag : 0) +
    (termPairFlag ? WEIGHTS.termPairFlag : 0) +
    (multiRoomFlag ? WEIGHTS.multiRoomFlag : 0) +
    lastUnassignedStreak * WEIGHTS.lastUnassignedStreak;

  return {
    strictCandidateCount,
    mandatoryEquipmentCount: subject.mandatoryEquipment?.length || 0,
    requiredEquipmentWeight,
    rareRoomTypeFlag,
    capacityPressure,
    continuityFlag,
    termPairFlag,
    multiRoomFlag,
    lastUnassignedStreak,
    score
  };
};

export const buildDifficultyRanking = (
  subjects: Subject[],
  classrooms: Classroom[],
  rules: AllocationRule[],
  equipmentSettings: EquipmentSettings | undefined,
  streakMap: Map<string, number>,
  limit = 10
): DifficultyEntry[] =>
  [...subjects]
    .map(subject => ({
      subject,
      breakdown: computeDifficulty(subject, subjects, classrooms, rules, equipmentSettings, streakMap)
    }))
    .sort((a, b) => {
      const scoreDiff = b.breakdown.score - a.breakdown.score;
      if (scoreDiff !== 0) return scoreDiff;
      const priorityDiff = (b.subject.priority || 1) - (a.subject.priority || 1);
      if (priorityDiff !== 0) return priorityDiff;
      return a.subject.id.localeCompare(b.subject.id);
    })
    .slice(0, limit);

export const formatDifficultySummary = (breakdown: DifficultyBreakdown) => {
  const parts = [
    `候補室 ${breakdown.strictCandidateCount}`,
    breakdown.mandatoryEquipmentCount > 0 ? `必須機材 ${breakdown.mandatoryEquipmentCount}` : null,
    breakdown.requiredEquipmentWeight > 0 ? `要件重み ${breakdown.requiredEquipmentWeight.toFixed(1)}` : null,
    breakdown.rareRoomTypeFlag ? '希少タイプ' : null,
    breakdown.continuityFlag ? '連続講時' : null,
    breakdown.termPairFlag ? '春秋ペア' : null,
    breakdown.multiRoomFlag ? '複数室' : null,
    breakdown.lastUnassignedStreak > 0 ? `未配当連鎖 ${breakdown.lastUnassignedStreak}` : null
  ].filter(Boolean);
  return parts.join(' / ');
};
