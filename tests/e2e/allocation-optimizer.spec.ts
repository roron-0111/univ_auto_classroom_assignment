import { expect, test } from '@playwright/test';
import { relocateForUnassigned, runAutoAllocation } from '../../src/utils/optimizer';
import {
  buildAllocationCountBySubjectId,
  isSubjectFullyAllocated,
  isSubjectUnfilled,
  shouldIncludeSubjectForAllocation
} from '../../src/utils/allocationStatus';
import { findTermPartner } from '../../src/utils/termPair';
import type { AllocationRule, Classroom, Subject, UnassignedInfo } from '../../src/types';

const rules: AllocationRule[] = [
  {
    id: 'capacity_fit',
    name: '適切な教室サイズ',
    description: '',
    tier: 'pref',
    enabled: true,
    order: 1,
    params: { minRatio: 1.3, maxRatio: 3.3 }
  },
  {
    id: 'room_type',
    name: '教室タイプマッチング',
    description: '',
    tier: 'hard',
    enabled: true,
    order: 0
  }
];
const termConsistencyRules: AllocationRule[] = [
  {
    id: 'term_consistency',
    name: '春秋同一教室',
    description: '',
    tier: 'pref',
    enabled: true,
    order: 1
  }
];

const subject = (overrides: Partial<Subject>): Subject => ({
  id: 's1',
  code: 'S1',
  name: '授業1',
  teacher: '教員A',
  faculty: '全学',
  department: 'IR',
  term: 'spring',
  day: 'mon',
  period: 1,
  requiredCapacity: 20,
  campus: '八景',
  priority: 1,
  requiredRoomCount: 1,
  ...overrides
});

const room = (overrides: Partial<Classroom>): Classroom => ({
  id: 'r1',
  name: 'R1',
  campus: '八景',
  building: 'フォーサイト',
  capacity: 40,
  type: 'normal',
  isMovable: false,
  equipment: [],
  ...overrides
});

test('auto allocation respects preserved allocation occupancy from context subjects', () => {
  const existingSubject = subject({ id: 'existing', code: 'EX', name: '既存配当' });
  const targetSubject = subject({ id: 'target', code: 'TG', name: '対象科目' });
  const classroom = room({ id: 'r1' });

  const result = runAutoAllocation(
    [targetSubject],
    [classroom],
    [{ subjectId: existingSubject.id, classroomId: classroom.id }],
    rules,
    undefined,
    { contextSubjects: [existingSubject, targetSubject] }
  );

  expect(result.allocations).toEqual([{ subjectId: existingSubject.id, classroomId: classroom.id }]);
  expect(result.unassigned.map(item => item.subject.id)).toEqual([targetSubject.id]);
});

test('partial multi-room subject is treated as unfilled', () => {
  const targetSubject = subject({ id: 'multi-room', requiredRoomCount: 2 });
  const counts = buildAllocationCountBySubjectId([
    { subjectId: targetSubject.id, classroomId: 'r1' }
  ]);

  expect(isSubjectFullyAllocated(targetSubject, counts)).toBe(false);
  expect(isSubjectUnfilled(targetSubject, counts)).toBe(true);
  expect(shouldIncludeSubjectForAllocation(targetSubject, counts, {
    includeAllocated: false,
    includeUnassigned: true
  })).toBe(true);
});

test('fully allocated subject is excluded from incremental allocation', () => {
  const targetSubject = subject({ id: 'multi-room', requiredRoomCount: 2 });
  const counts = buildAllocationCountBySubjectId([
    { subjectId: targetSubject.id, classroomId: 'r1' },
    { subjectId: targetSubject.id, classroomId: 'r2' }
  ]);

  expect(isSubjectFullyAllocated(targetSubject, counts)).toBe(true);
  expect(shouldIncludeSubjectForAllocation(targetSubject, counts, {
    includeAllocated: false,
    includeUnassigned: true
  })).toBe(false);
  expect(shouldIncludeSubjectForAllocation(targetSubject, counts, {
    includeAllocated: true,
    includeUnassigned: true
  })).toBe(true);
});

test('auto allocation fills only missing rooms for partially allocated multi-room subject', () => {
  const targetSubject = subject({ id: 'multi-room', requiredRoomCount: 2 });
  const firstRoom = room({ id: 'r1', name: 'R1', capacity: 40 });
  const secondRoom = room({ id: 'r2', name: 'R2', capacity: 42 });
  const existingAllocation = { subjectId: targetSubject.id, classroomId: firstRoom.id };

  const result = runAutoAllocation(
    [targetSubject],
    [firstRoom, secondRoom],
    [existingAllocation],
    rules,
    undefined,
    { contextSubjects: [targetSubject] }
  );

  expect(result.unassigned).toEqual([]);
  expect(result.allocations.map(allocation => ({
    subjectId: allocation.subjectId,
    classroomId: allocation.classroomId
  }))).toEqual([
    existingAllocation,
    { subjectId: targetSubject.id, classroomId: secondRoom.id }
  ]);
});

test('auto allocation classifies room type hard failure as U2', () => {
  const targetSubject = subject({ id: 'pc-subject', preferredRoomType: 'pc' });
  const normalRoom = room({ id: 'normal-room', type: 'normal' });

  const result = runAutoAllocation([targetSubject], [normalRoom], [], rules);

  expect(result.allocations).toEqual([]);
  expect(result.unassigned).toHaveLength(1);
  expect(result.unassigned[0].reason).toBe('U2_room_type_blocked');
});

test('auto allocation does not use rooms excluded from auto allocation', () => {
  const targetSubject = subject({ id: 'target' });
  const excludedRoom = room({ id: 'excluded-room', isExcluded: true });

  const result = runAutoAllocation([targetSubject], [excludedRoom], [], rules);

  expect(result.allocations).toEqual([]);
  expect(result.unassigned).toHaveLength(1);
  expect(result.unassigned[0].reason).toBe('U1_no_hard_candidate');
});

test('strict level 5 equipment is handled as a hard condition', () => {
  const targetSubject = subject({ id: 'projector-subject', requiresProjector: true });
  const noProjectorRoom = room({ id: 'no-projector', equipment: [] });

  const result = runAutoAllocation(
    [targetSubject],
    [noProjectorRoom],
    [],
    rules,
    {
      strictLevel5: true,
      items: {
        'PJ(中)': { enabled: true, importance: 5 },
        'PJ(横)': { enabled: true, importance: 5 }
      }
    }
  );

  expect(result.allocations).toEqual([]);
  expect(result.unassigned).toHaveLength(1);
  expect(result.unassigned[0].reason).toBe('U1_no_hard_candidate');
});

test('term consistency prefers the spring partner room when available', () => {
  const springPartner = subject({
    id: 'spring-partner',
    code: 'PAIR',
    term: 'spring',
    teacher: '教員A',
    teacherCode: '1001'
  });
  const autumnSubject = subject({
    id: 'autumn-target',
    code: 'PAIR',
    term: 'autumn',
    teacher: '教員B',
    teacherCode: '1001'
  });
  const otherRoom = room({ id: 'r1', name: 'R1', capacity: 40 });
  const partnerRoom = room({ id: 'r2', name: 'R2', capacity: 40 });

  const result = runAutoAllocation(
    [autumnSubject],
    [otherRoom, partnerRoom],
    [{ subjectId: springPartner.id, classroomId: partnerRoom.id }],
    termConsistencyRules,
    undefined,
    { contextSubjects: [springPartner, autumnSubject] }
  );

  expect(result.allocations.some(allocation =>
    allocation.subjectId === autumnSubject.id && allocation.classroomId === partnerRoom.id
  )).toBe(true);
  expect(result.unassigned).toEqual([]);
});

test('full-year allocation blocks spring and autumn terms in the same room', () => {
  const fullYearSubject = subject({ id: 'full-year', term: 'full_year' });
  const springSubject = subject({ id: 'spring-target', term: 'spring' });
  const classroom = room({ id: 'r1', name: 'R1' });

  const result = runAutoAllocation(
    [springSubject],
    [classroom],
    [{ subjectId: fullYearSubject.id, classroomId: classroom.id }],
    rules,
    undefined,
    { contextSubjects: [fullYearSubject, springSubject] }
  );

  expect(result.allocations.map(allocation => allocation.subjectId)).toEqual([fullYearSubject.id]);
  expect(result.unassigned.map(item => item.subject.id)).toEqual([springSubject.id]);
});

test('spring first and spring second can use the same room', () => {
  const springFirstSubject = subject({ id: 'spring-first', term: 'spring_first' });
  const springSecondSubject = subject({ id: 'spring-second', term: 'spring_second' });
  const classroom = room({ id: 'r1', name: 'R1' });

  const result = runAutoAllocation(
    [springSecondSubject],
    [classroom],
    [{ subjectId: springFirstSubject.id, classroomId: classroom.id }],
    rules,
    undefined,
    { contextSubjects: [springFirstSubject, springSecondSubject] }
  );

  expect(result.unassigned).toEqual([]);
  expect(result.allocations.some(allocation =>
    allocation.subjectId === springSecondSubject.id && allocation.classroomId === classroom.id
  )).toBe(true);
});

test('relocation keeps room type as a hard condition', () => {
  const targetSubject = subject({ id: 'pc-subject', preferredRoomType: 'pc' });
  const normalRoom = room({ id: 'normal-room', type: 'normal' });
  const unassigned: UnassignedInfo[] = [
    {
      subject: targetSubject,
      reason: 'U2_room_type_blocked'
    }
  ];

  const result = relocateForUnassigned(
    [targetSubject],
    [normalRoom],
    [],
    unassigned,
    rules,
    undefined,
    { maxDepth: 1, timeoutMs: 1000 }
  );

  expect(result.allocations).toEqual([]);
  expect(result.placed).toEqual([]);
  expect(result.unresolved.map(item => item.reason)).toEqual(['U2_room_type_blocked']);
});

test('term partner matching requires non-provisional teacher codes', () => {
  const springWithoutCode = subject({ id: 'spring-no-code', term: 'spring', teacher: '教員A', teacherCode: '' });
  const autumnWithoutCode = subject({ id: 'autumn-no-code', term: 'autumn', teacher: '教員A', teacherCode: '' });
  const springWithCode = subject({ id: 'spring-code', term: 'spring', teacher: '教員A', teacherCode: '1001' });
  const autumnWithCode = subject({ id: 'autumn-code', term: 'autumn', teacher: '教員B', teacherCode: '1001' });
  const provisionalAutumn = subject({ id: 'autumn-provisional', term: 'autumn', teacher: '教員A', teacherCode: '9001' });

  expect(findTermPartner(springWithoutCode, [springWithoutCode, autumnWithoutCode])).toBeNull();
  expect(findTermPartner(springWithCode, [springWithCode, autumnWithCode])).toEqual(autumnWithCode);
  expect(findTermPartner(springWithCode, [springWithCode, provisionalAutumn])).toBeNull();
});
