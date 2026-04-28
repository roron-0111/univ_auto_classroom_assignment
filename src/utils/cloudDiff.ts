import type { CloudData } from '../types_cloud';

export type DiffCount = {
  added: number;
  removed: number;
  updated: number;
};

export type CloudDiffOperation = 'added' | 'removed' | 'updated';

export type CloudDiffEntry = {
  operation: CloudDiffOperation;
  label: string;
  localValue: string;
  cloudValue: string;
};

export type CloudWriteWarningSummary = {
  allocations: DiffCount;
  hasDiff: boolean;
};

const createDiffCount = (): DiffCount => ({
  added: 0,
  removed: 0,
  updated: 0
});

export const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, val]) => `${JSON.stringify(key)}:${stableSerialize(val)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
};

const compareAllocations = (localItems: CloudData['allocations'], cloudItems: CloudData['allocations']): DiffCount => {
  const localMap = new Map(localItems.map(item => [`${item.subjectId}__${item.classroomId}`, item] as const));
  const cloudMap = new Map(cloudItems.map(item => [`${item.subjectId}__${item.classroomId}`, item] as const));
  const diff = createDiffCount();

  cloudMap.forEach((cloudItem, key) => {
    if (!localMap.has(key)) {
      diff.added += 1;
      return;
    }
    const localItem = localMap.get(key);
    if (stableSerialize(localItem) !== stableSerialize(cloudItem)) {
      diff.updated += 1;
    }
  });

  localMap.forEach((_, key) => {
    if (!cloudMap.has(key)) {
      diff.removed += 1;
    }
  });

  return diff;
};

const hasAnyDiff = (summary: CloudWriteWarningSummary) =>
  summary.allocations.added > 0 ||
  summary.allocations.removed > 0 ||
  summary.allocations.updated > 0;

const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');

type SubjectLike = {
  id: string;
  code?: string;
  name?: string;
};

type ClassroomLike = {
  id: string;
  name?: string;
};

const getSubjectLabel = (item: SubjectLike) => {
  const code = getString(item.code);
  const name = getString(item.name);
  const id = getString(item.id);
  return [code, name].filter(Boolean).join('_') || id;
};

const getClassroomLabel = (item: ClassroomLike) => getString(item.name) || getString(item.id);

export const compareCloudSnapshots = (localData: CloudData, cloudData: CloudData): CloudWriteWarningSummary => {
  const summary: CloudWriteWarningSummary = {
    allocations: compareAllocations(localData.allocations, cloudData.allocations),
    hasDiff: false
  };
  summary.hasDiff = hasAnyDiff(summary);
  return summary;
};

export const buildCloudDiffEntries = (localData: CloudData, cloudData: CloudData): CloudDiffEntry[] => {
  const entries: CloudDiffEntry[] = [];
  const localSubjectMap = new Map(localData.subjects.map(item => [item.id, item as SubjectLike] as const));
  const cloudSubjectMap = new Map(cloudData.subjects.map(item => [item.id, item as SubjectLike] as const));
  const localClassroomMap = new Map(localData.classrooms.map(item => [item.id, item as ClassroomLike] as const));
  const cloudClassroomMap = new Map(cloudData.classrooms.map(item => [item.id, item as ClassroomLike] as const));

  const mergedSubjectMap = new Map([...localSubjectMap, ...cloudSubjectMap]);
  const mergedClassroomMap = new Map([...localClassroomMap, ...cloudClassroomMap]);

  const localMap = new Map(localData.allocations.map(item => [`${item.subjectId}__${item.classroomId}`, item] as const));
  const cloudMap = new Map(cloudData.allocations.map(item => [`${item.subjectId}__${item.classroomId}`, item] as const));
  const keys = [...new Set([...localMap.keys(), ...cloudMap.keys()])].sort((a, b) => a.localeCompare(b, 'ja'));

  keys.forEach(key => {
    const localItem = localMap.get(key);
    const cloudItem = cloudMap.get(key);
    const sourceItem = localItem || cloudItem;
    if (!sourceItem) return;

    const subject = mergedSubjectMap.get(sourceItem.subjectId);
    const classroom = mergedClassroomMap.get(sourceItem.classroomId);
    const subjectLabel = subject ? getSubjectLabel(subject) : getString(sourceItem.subjectId);
    const classroomLabel = classroom ? getClassroomLabel(classroom) : getString(sourceItem.classroomId);
    const label = `${subjectLabel} / ${classroomLabel}`.trim();

    if (!localItem && cloudItem) {
      entries.push({
        operation: 'added',
        label,
        localValue: '',
        cloudValue: stableSerialize(cloudItem)
      });
      return;
    }

    if (localItem && !cloudItem) {
      entries.push({
        operation: 'removed',
        label,
        localValue: stableSerialize(localItem),
        cloudValue: ''
      });
      return;
    }

    if (localItem && cloudItem && stableSerialize(localItem) !== stableSerialize(cloudItem)) {
      entries.push({
        operation: 'updated',
        label,
        localValue: stableSerialize(localItem),
        cloudValue: stableSerialize(cloudItem)
      });
    }
  });

  return entries;
};

export const buildCloudDiffCsv = (localData: CloudData, cloudData: CloudData) =>
  buildCloudDiffEntries(localData, cloudData).map(entry => ({
    種別: '配当',
    操作: entry.operation === 'added' ? '追加' : entry.operation === 'removed' ? '削除' : '更新',
    対象: entry.label,
    ローカル: entry.localValue,
    クラウド: entry.cloudValue
  }));
