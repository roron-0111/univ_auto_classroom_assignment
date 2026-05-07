import type { Classroom, Subject } from '../types';
import type { CloudData } from '../types_cloud';
import { getDayLabel, getPeriodLabel } from '../types';

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

export type CloudDiffCsvRow = {
  種別: string;
  操作: string;
  ローカル: string;
  クラウド: string;
  教室: string;
  曜日: string;
  講時: string;
  科目名: string;
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

type AllocationLike = CloudData['allocations'][number];

type AllocationDiffRow = {
  operation: CloudDiffOperation;
  localItem?: AllocationLike;
  cloudItem?: AllocationLike;
};

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

const getAllocationSubjectMap = (items: AllocationLike[]) => {
  const map = new Map<string, AllocationLike[]>();
  items.forEach(item => {
    const list = map.get(item.subjectId) ?? [];
    list.push(item);
    map.set(item.subjectId, list);
  });
  map.forEach(list => list.sort((a, b) => a.classroomId.localeCompare(b.classroomId, 'ja')));
  return map;
};

const buildAllocationDiffRows = (localItems: AllocationLike[], cloudItems: AllocationLike[]): AllocationDiffRow[] => {
  const localGroups = getAllocationSubjectMap(localItems);
  const cloudGroups = getAllocationSubjectMap(cloudItems);
  const subjectIds = [...new Set([...localGroups.keys(), ...cloudGroups.keys()])].sort((a, b) => a.localeCompare(b, 'ja'));
  const rows: AllocationDiffRow[] = [];

  subjectIds.forEach(subjectId => {
    const localGroup = localGroups.get(subjectId) ?? [];
    const cloudGroup = cloudGroups.get(subjectId) ?? [];
    const cloudByClassroom = new Map(cloudGroup.map(item => [item.classroomId, item] as const));
    const localByClassroom = new Map(localGroup.map(item => [item.classroomId, item] as const));

    const localOnly = localGroup.filter(item => !cloudByClassroom.has(item.classroomId));
    const cloudOnly = cloudGroup.filter(item => !localByClassroom.has(item.classroomId));
    const sharedCount = Math.min(localOnly.length, cloudOnly.length);

    for (let index = 0; index < sharedCount; index += 1) {
      rows.push({
        operation: 'updated',
        localItem: localOnly[index],
        cloudItem: cloudOnly[index]
      });
    }

    for (let index = sharedCount; index < localOnly.length; index += 1) {
      rows.push({
        operation: 'removed',
        localItem: localOnly[index]
      });
    }

    for (let index = sharedCount; index < cloudOnly.length; index += 1) {
      rows.push({
        operation: 'added',
        cloudItem: cloudOnly[index]
      });
    }
  });

  return rows;
};

const compareAllocations = (localItems: CloudData['allocations'], cloudItems: CloudData['allocations']): DiffCount => {
  const diff = createDiffCount();
  buildAllocationDiffRows(localItems, cloudItems).forEach(row => {
    diff[row.operation] += 1;
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
  day?: string;
  period?: number | string;
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
  const localSubjectMap = new Map(localData.subjects.map(item => [item.id, item] as const));
  const cloudSubjectMap = new Map(cloudData.subjects.map(item => [item.id, item] as const));
  const localClassroomMap = new Map(localData.classrooms.map(item => [item.id, item] as const));
  const cloudClassroomMap = new Map(cloudData.classrooms.map(item => [item.id, item] as const));

  const mergedSubjectMap = new Map([...localSubjectMap, ...cloudSubjectMap]);
  const mergedClassroomMap = new Map([...localClassroomMap, ...cloudClassroomMap]);
  return buildAllocationDiffRows(localData.allocations, cloudData.allocations).map(row => {
    const sourceItem = row.localItem || row.cloudItem;
    const subject = sourceItem ? mergedSubjectMap.get(sourceItem.subjectId) : undefined;
    const localClassroom = row.localItem ? mergedClassroomMap.get(row.localItem.classroomId) : undefined;
    const cloudClassroom = row.cloudItem ? mergedClassroomMap.get(row.cloudItem.classroomId) : undefined;
    const subjectLabel = subject ? getSubjectLabel(subject) : getString(sourceItem?.subjectId);
    const classroomLabel =
      row.operation === 'updated'
        ? `${getClassroomLabel(localClassroom || { id: row.localItem?.classroomId ?? '' })} → ${getClassroomLabel(cloudClassroom || { id: row.cloudItem?.classroomId ?? '' })}`
        : getClassroomLabel(localClassroom || cloudClassroom || { id: sourceItem?.classroomId ?? '' });

    return {
      operation: row.operation,
      label: `${subjectLabel} / ${classroomLabel}`.trim(),
      localValue:
        row.operation === 'added'
          ? 'なし'
          : row.operation === 'removed'
            ? getClassroomLabel(localClassroom || { id: row.localItem?.classroomId ?? '' })
            : `${getClassroomLabel(localClassroom || { id: row.localItem?.classroomId ?? '' })} → なし`,
      cloudValue:
        row.operation === 'added'
          ? getClassroomLabel(cloudClassroom || { id: row.cloudItem?.classroomId ?? '' })
          : row.operation === 'removed'
            ? 'なし'
            : `なし → ${getClassroomLabel(cloudClassroom || { id: row.cloudItem?.classroomId ?? '' })}`
    };
  });
};

const buildSubjectMap = (cloudData: CloudData, localData: CloudData) =>
  new Map([...localData.subjects, ...cloudData.subjects].map(item => [item.id, item] as const));

const buildClassroomMap = (cloudData: CloudData, localData: CloudData) =>
  new Map([...localData.classrooms, ...cloudData.classrooms].map(item => [item.id, item] as const));

const buildDiffCsvRow = (
  operation: CloudDiffOperation,
  localItem: CloudData['allocations'][number] | undefined,
  cloudItem: CloudData['allocations'][number] | undefined,
  subjectMap: Map<string, Subject>,
  classroomMap: Map<string, Classroom>
): CloudDiffCsvRow => {
  const sourceItem = localItem || cloudItem;
  const subject = sourceItem ? subjectMap.get(sourceItem.subjectId) : undefined;
  const localClassroom = localItem ? classroomMap.get(localItem.classroomId) : undefined;
  const cloudClassroom = cloudItem ? classroomMap.get(cloudItem.classroomId) : undefined;
  const subjectCode = getString(subject?.code);
  const subjectName = getString(subject?.name);
  const localClassroomName = getString(localClassroom?.name) || getString(localItem?.classroomId);
  const cloudClassroomName = getString(cloudClassroom?.name) || getString(cloudItem?.classroomId);
  const day = subject ? getDayLabel(subject.day) : '';
  const period = subject ? getPeriodLabel(subject.period) : '';
  const presence =
    operation === 'added'
      ? { local: 'なし', cloud: 'なし→あり' }
      : operation === 'removed'
        ? { local: 'あり→なし', cloud: 'あり' }
        : { local: 'あり→なし', cloud: 'なし→あり' };

  return {
    種別: '配当',
    操作: operation === 'added' ? '追加' : operation === 'removed' ? '削除' : '更新',
    ローカル: presence.local,
    クラウド: presence.cloud,
    教室:
      operation === 'updated'
        ? `${localClassroomName || ''} → ${cloudClassroomName || ''}`.trim()
        : (localClassroomName || cloudClassroomName || ''),
    曜日: day || '',
    講時: period || '',
    科目名: [subjectCode, subjectName].filter(Boolean).join('_') || sourceItem?.subjectId || ''
  };
};

export const buildCloudDiffCsv = (localData: CloudData, cloudData: CloudData): CloudDiffCsvRow[] => {
  const diffRows = buildAllocationDiffRows(localData.allocations, cloudData.allocations);
  const subjectMap = buildSubjectMap(cloudData, localData);
  const classroomMap = buildClassroomMap(cloudData, localData);

  return diffRows.map(row =>
    buildDiffCsvRow(row.operation, row.localItem, row.cloudItem, subjectMap, classroomMap)
  );
};
