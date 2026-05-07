import type { CloudData } from '../types_cloud';

const groupBySubject = (items: CloudData['allocations']) => {
  const map = new Map<string, CloudData['allocations']>();
  items.forEach(item => {
    const list = map.get(item.subjectId) ?? [];
    list.push(item);
    map.set(item.subjectId, list);
  });
  map.forEach(list => list.sort((a, b) => a.classroomId.localeCompare(b.classroomId, 'ja')));
  return map;
};

const getClassroomSignature = (items: CloudData['allocations']) =>
  items.map(item => item.classroomId).sort((a, b) => a.localeCompare(b, 'ja')).join('\u0000');

export const mergeAllocationsBySubjectBaseline = (
  baselineAllocations: CloudData['allocations'],
  localAllocations: CloudData['allocations'],
  cloudAllocations: CloudData['allocations']
) => {
  const baselineGroups = groupBySubject(baselineAllocations);
  const localGroups = groupBySubject(localAllocations);
  const cloudGroups = groupBySubject(cloudAllocations);
  const subjectIds = new Set([...baselineGroups.keys(), ...localGroups.keys()]);

  subjectIds.forEach(subjectId => {
    const baselineGroup = baselineGroups.get(subjectId) ?? [];
    const localGroup = localGroups.get(subjectId) ?? [];
    if (getClassroomSignature(baselineGroup) !== getClassroomSignature(localGroup)) {
      if (localGroup.length > 0) {
        cloudGroups.set(subjectId, localGroup);
      } else {
        cloudGroups.delete(subjectId);
      }
    }
  });

  return [...cloudGroups.values()].flat();
};
