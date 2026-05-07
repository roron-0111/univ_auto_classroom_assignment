import { expect, test } from '@playwright/test';
import { mergeAllocationsBySubjectBaseline } from '../../src/utils/cloudAllocationMerge';
import type { CloudData } from '../../src/types_cloud';

const allocation = (subjectId: string, classroomId: string): CloudData['allocations'][number] => ({
  subjectId,
  classroomId
});

test('cloud write allocation merge keeps unrelated latest cloud changes', () => {
  const baseline = [allocation('s1', 'c1'), allocation('s2', 'c2')];
  const local = [allocation('s1', 'c3'), allocation('s2', 'c2')];
  const cloud = [allocation('s1', 'c1'), allocation('s2', 'c4')];

  const merged = mergeAllocationsBySubjectBaseline(baseline, local, cloud);

  expect(merged).toEqual(expect.arrayContaining([allocation('s1', 'c3'), allocation('s2', 'c4')]));
  expect(merged).toHaveLength(2);
});

test('cloud write allocation merge lets later same-subject writer replace the subject allocation set', () => {
  const baseline = [allocation('s1', 'c1')];
  const local = [allocation('s1', 'c2')];
  const cloud = [allocation('s1', 'c3')];

  const merged = mergeAllocationsBySubjectBaseline(baseline, local, cloud);

  expect(merged).toEqual([allocation('s1', 'c2')]);
});

test('cloud write allocation merge supports removing all rooms for a changed subject', () => {
  const baseline = [allocation('s1', 'c1'), allocation('s2', 'c2')];
  const local = [allocation('s2', 'c2')];
  const cloud = [allocation('s1', 'c3'), allocation('s2', 'c4')];

  const merged = mergeAllocationsBySubjectBaseline(baseline, local, cloud);

  expect(merged).toEqual([allocation('s2', 'c4')]);
});
