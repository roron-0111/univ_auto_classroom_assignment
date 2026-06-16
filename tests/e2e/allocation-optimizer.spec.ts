import { expect, test } from '@playwright/test';
import { relocateForUnassigned, runAutoAllocation } from '../../src/utils/optimizer';
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

test('auto allocation classifies room type hard failure as U2', () => {
  const targetSubject = subject({ id: 'pc-subject', preferredRoomType: 'pc' });
  const normalRoom = room({ id: 'normal-room', type: 'normal' });

  const result = runAutoAllocation([targetSubject], [normalRoom], [], rules);

  expect(result.allocations).toEqual([]);
  expect(result.unassigned).toHaveLength(1);
  expect(result.unassigned[0].reason).toBe('U2_room_type_blocked');
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
