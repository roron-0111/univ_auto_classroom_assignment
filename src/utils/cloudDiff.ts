import type { CloudData } from '../types_cloud';

export type DiffCount = {
  added: number;
  removed: number;
  updated: number;
};

export type CloudDiffKind = 'subjects' | 'classrooms' | 'allocations' | 'settings' | 'equipmentSettings' | 'subjectTaxonomy';
export type CloudDiffOperation = 'added' | 'removed' | 'updated';

export type CloudDiffEntry = {
  kind: CloudDiffKind;
  operation: CloudDiffOperation;
  label: string;
  localValue: string;
  cloudValue: string;
};

export type CloudWriteWarningSummary = {
  subjects: DiffCount;
  classrooms: DiffCount;
  allocations: DiffCount;
  settingsChanged: boolean;
  equipmentSettingsChanged: boolean;
  subjectTaxonomyChanged: boolean;
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

const compareCollections = <T,>(
  localItems: T[],
  cloudItems: T[],
  getKey: (item: T) => string
): DiffCount => {
  const localMap = new Map(localItems.map(item => [getKey(item), item] as const));
  const cloudMap = new Map(cloudItems.map(item => [getKey(item), item] as const));
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
  summary.subjects.added > 0 ||
  summary.subjects.removed > 0 ||
  summary.subjects.updated > 0 ||
  summary.classrooms.added > 0 ||
  summary.classrooms.removed > 0 ||
  summary.classrooms.updated > 0 ||
  summary.allocations.added > 0 ||
  summary.allocations.removed > 0 ||
  summary.allocations.updated > 0 ||
  summary.settingsChanged ||
  summary.equipmentSettingsChanged ||
  summary.subjectTaxonomyChanged;

const buildDiffEntry = (
  kind: CloudDiffKind,
  operation: CloudDiffOperation,
  label: string,
  localValue: string,
  cloudValue: string
): CloudDiffEntry => ({
  kind,
  operation,
  label,
  localValue,
  cloudValue
});

export const compareCloudSnapshots = (localData: CloudData, cloudData: CloudData): CloudWriteWarningSummary => {
  const summary: CloudWriteWarningSummary = {
    subjects: compareCollections(localData.subjects, cloudData.subjects, subject => subject.id),
    classrooms: compareCollections(localData.classrooms, cloudData.classrooms, room => room.id),
    allocations: compareCollections(
      localData.allocations,
      cloudData.allocations,
      allocation => `${allocation.subjectId}__${allocation.classroomId}`
    ),
    settingsChanged: stableSerialize(localData.settings) !== stableSerialize(cloudData.settings),
    equipmentSettingsChanged: stableSerialize(localData.equipmentSettings) !== stableSerialize(cloudData.equipmentSettings),
    subjectTaxonomyChanged: stableSerialize(localData.subjectTaxonomy) !== stableSerialize(cloudData.subjectTaxonomy),
    hasDiff: false
  };
  summary.hasDiff = hasAnyDiff(summary);
  return summary;
};

export const buildCloudDiffEntries = (localData: CloudData, cloudData: CloudData): CloudDiffEntry[] => {
  const entries: CloudDiffEntry[] = [];

  const asRecordArray = <T,>(items: T[]) => items.map(item => item as unknown as Record<string, unknown>);
  const getString = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : '');

  const getSubjectLabel = (item: Record<string, unknown>) => {
    const code = getString(item.code);
    const name = getString(item.name);
    const id = getString(item.id);
    return [code, name].filter(Boolean).join('_') || id;
  };

  const getClassroomLabel = (item: Record<string, unknown>) => getString(item.name) || getString(item.id);

  const getAllocationLabel = (
    item: Record<string, unknown>,
    subjectMap: Map<string, Record<string, unknown>>,
    classroomMap: Map<string, Record<string, unknown>>
  ) => {
    const subjectId = getString(item.subjectId);
    const classroomId = getString(item.classroomId);
    const subject = subjectMap.get(subjectId);
    const classroom = classroomMap.get(classroomId);
    const subjectLabel = subject ? getSubjectLabel(subject) : subjectId;
    const classroomLabel = classroom ? getClassroomLabel(classroom) : classroomId;
    return [subjectLabel, classroomLabel].filter(Boolean).join(' / ');
  };

  const addEntries = (
    kind: CloudDiffKind,
    localItems: Record<string, unknown>[],
    cloudItems: Record<string, unknown>[],
    keyFn: (item: Record<string, unknown>) => string,
    labelFn?: (item: Record<string, unknown>) => string
  ) => {
    const localMap = new Map(localItems.map(item => [keyFn(item), item]));
    const cloudMap = new Map(cloudItems.map(item => [keyFn(item), item]));
    const keys = [...new Set([...localMap.keys(), ...cloudMap.keys()])].sort((a, b) => a.localeCompare(b, 'ja'));

    keys.forEach(key => {
      const localItem = localMap.get(key);
      const cloudItem = cloudMap.get(key);
      const label = labelFn?.(localItem || cloudItem || {}) || key;

      if (!localItem && cloudItem) {
        entries.push(buildDiffEntry(kind, 'added', label, '', stableSerialize(cloudItem)));
      } else if (localItem && !cloudItem) {
        entries.push(buildDiffEntry(kind, 'removed', label, stableSerialize(localItem), ''));
      } else if (localItem && cloudItem && stableSerialize(localItem) !== stableSerialize(cloudItem)) {
        entries.push(buildDiffEntry(kind, 'updated', label, stableSerialize(localItem), stableSerialize(cloudItem)));
      }
    });
  };

  const localSubjectMap = new Map(asRecordArray(localData.subjects).map(item => [String(item.id ?? ''), item] as const));
  const cloudSubjectMap = new Map(asRecordArray(cloudData.subjects).map(item => [String(item.id ?? ''), item] as const));
  const localClassroomMap = new Map(asRecordArray(localData.classrooms).map(item => [String(item.id ?? ''), item] as const));
  const cloudClassroomMap = new Map(asRecordArray(cloudData.classrooms).map(item => [String(item.id ?? ''), item] as const));
  const mergedSubjectMap = new Map([...localSubjectMap, ...cloudSubjectMap]);
  const mergedClassroomMap = new Map([...localClassroomMap, ...cloudClassroomMap]);

  addEntries('subjects', asRecordArray(localData.subjects), asRecordArray(cloudData.subjects), item => String(item.id ?? ''), item => getSubjectLabel(item));
  addEntries('classrooms', asRecordArray(localData.classrooms), asRecordArray(cloudData.classrooms), item => String(item.id ?? ''), item => getClassroomLabel(item));
  addEntries(
    'allocations',
    asRecordArray(localData.allocations),
    asRecordArray(cloudData.allocations),
    item => `${String(item.subjectId ?? '')}__${String(item.classroomId ?? '')}`,
    item => getAllocationLabel(item, mergedSubjectMap, mergedClassroomMap)
  );

  if (stableSerialize(localData.settings) !== stableSerialize(cloudData.settings)) {
    entries.push(buildDiffEntry('settings', 'updated', '配当ルール', stableSerialize(localData.settings), stableSerialize(cloudData.settings)));
  }
  if (stableSerialize(localData.equipmentSettings) !== stableSerialize(cloudData.equipmentSettings)) {
    entries.push(buildDiffEntry('equipmentSettings', 'updated', '機材設定', stableSerialize(localData.equipmentSettings), stableSerialize(cloudData.equipmentSettings)));
  }
  if (stableSerialize(localData.subjectTaxonomy) !== stableSerialize(cloudData.subjectTaxonomy)) {
    entries.push(buildDiffEntry('subjectTaxonomy', 'updated', '開講学部・管轄', stableSerialize(localData.subjectTaxonomy), stableSerialize(cloudData.subjectTaxonomy)));
  }

  return entries;
};

export const buildCloudDiffCsv = (localData: CloudData, cloudData: CloudData) =>
  buildCloudDiffEntries(localData, cloudData).map(entry => ({
    種別: entry.kind,
    操作: entry.operation === 'added' ? '追加' : entry.operation === 'removed' ? '削除' : '変更',
    対象: entry.label,
    ローカル: entry.localValue,
    クラウド: entry.cloudValue
  }));
