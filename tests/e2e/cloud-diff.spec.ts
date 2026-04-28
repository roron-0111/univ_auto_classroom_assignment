import { expect, test } from '@playwright/test';
import { compareCloudSnapshots, buildCloudDiffCsv } from '../../src/utils/cloudDiff';
import { getDefaultSubjectTaxonomy } from '../../src/utils/subjectTaxonomy';
import type { CloudData } from '../../src/types_cloud';

const baseData: CloudData = {
  subjects: [
    {
      id: 's1',
      code: '110001',
      name: 'KGUキャリアデザイン基礎',
      teacherCode: '',
      teacher: '教員A',
      faculty: '全学',
      department: 'IR',
      term: 'spring',
      day: 'mon',
      period: 1,
      requiredCapacity: 30,
      campus: '八景',
      requiredRoomCount: 1,
      priority: 1
    }
  ],
  classrooms: [
    {
      id: 'c1',
      name: 'F-201',
      campus: '八景',
      building: 'フォーサイト',
      capacity: 40,
      type: 'normal',
      isMovable: false,
      equipment: [],
      isExcluded: false
    }
  ],
  allocations: [],
  settings: [],
  equipmentSettings: {
    items: {},
    strictLevel5: false
  },
  subjectTaxonomy: getDefaultSubjectTaxonomy('八景')
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

test('allocations diff reports added / updated / removed', () => {
  const local = clone(baseData);
  const cloud = clone(baseData);
  cloud.allocations = [
    {
      subjectId: 's1',
      classroomId: 'c1'
    }
  ];

  const summary = compareCloudSnapshots(local, cloud);
  expect(summary.allocations.added).toBe(1);
  expect(summary.allocations.removed).toBe(0);
  expect(summary.allocations.updated).toBe(0);
  expect(summary.hasDiff).toBe(true);
});

test('allocations diff csv uses human readable labels', () => {
  const local = clone(baseData);
  const cloud = clone(baseData);
  cloud.allocations = [
    {
      subjectId: 's1',
      classroomId: 'c1'
    }
  ];

  const csv = buildCloudDiffCsv(local, cloud);
  expect(csv).toHaveLength(1);
  expect(csv[0]).toMatchObject({
    種別: '配当',
    操作: '追加',
    対象: '110001_KGUキャリアデザイン基礎 / F-201'
  });
});

test('allocations diff csv captures updated cases', () => {
  const local = clone(baseData);
  const cloud = clone(baseData);
  local.allocations = [
    {
      subjectId: 's1',
      classroomId: 'c1',
      isLocked: false
    }
  ];
  cloud.allocations = [
    {
      subjectId: 's1',
      classroomId: 'c1',
      isLocked: true
    },
    {
      subjectId: 's1',
      classroomId: 'c2'
    }
  ];
  cloud.classrooms.push({
    id: 'c2',
    name: 'F-202',
    campus: '八景',
    building: 'フォーサイト',
    capacity: 40,
    type: 'normal',
    isMovable: false,
    equipment: [],
    isExcluded: false
  });

  const csv = buildCloudDiffCsv(local, cloud);
  const updated = csv.find(row => row.対象 === '110001_KGUキャリアデザイン基礎 / F-201');
  const added = csv.find(row => row.対象 === '110001_KGUキャリアデザイン基礎 / F-202');

  expect(updated).toMatchObject({
    操作: '更新',
    種別: '配当'
  });
  expect(added).toMatchObject({
    操作: '追加',
    種別: '配当'
  });
});

test('allocations diff csv captures removed cases', () => {
  const local = clone(baseData);
  const cloud = clone(baseData);
  local.allocations = [
    {
      subjectId: 's1',
      classroomId: 'c1'
    }
  ];

  const csv = buildCloudDiffCsv(local, cloud);
  expect(csv).toHaveLength(1);
  expect(csv[0]).toMatchObject({
    操作: '削除',
    種別: '配当',
    対象: '110001_KGUキャリアデザイン基礎 / F-201'
  });
});
