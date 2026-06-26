import { expect, test, type Page, type TestInfo } from '@playwright/test';
import Papa from 'papaparse';
import fs from 'node:fs/promises';

const campusName = '\u516b\u666f';
const subjectManagerLabel = '\u79d1\u76ee\u7ba1\u7406';
const classroomManagerLabel = '\u6559\u5ba4\u7ba1\u7406';
const writeButtonLabel = '\u66f8\u8fbc';
const readButtonLabel = '\u53d6\u5f97';
const csvExportLabel = 'CSV\u30a8\u30af\u30b9\u30dd\u30fc\u30c8';
const codeHeader = '\u30b3\u30fc\u30c9';
const subjectNameHeader = '\u6642\u9593\u5272\u540d\u79f0';
const classroomIdHeader = '\u6559\u5ba4ID';
const classroomNameHeader = '\u6559\u5ba4\u540d';

test.describe.configure({ mode: 'serial' });

async function loginToCampus(page: Page) {
  await expect(page.getByRole('button', { name: campusName })).toBeVisible();
  await page.getByRole('button', { name: campusName }).click();
  await expect(page.getByRole('button', { name: writeButtonLabel })).toBeVisible({ timeout: 60_000 });
}

async function openSubjectManager(page: Page) {
  await page.getByRole('button', { name: subjectManagerLabel }).click();
  await expect(page.getByRole('heading', { name: subjectManagerLabel })).toBeVisible({ timeout: 60_000 });
}

async function openClassroomManager(page: Page) {
  await page.getByRole('button', { name: classroomManagerLabel }).click();
  await expect(page.getByRole('heading', { name: classroomManagerLabel })).toBeVisible({ timeout: 60_000 });
}

async function closeManager(page: Page, buttonName: string) {
  await page.locator('.manager-overlay header button').click();
  await expect(page.getByRole('button', { name: buttonName })).toBeVisible({ timeout: 60_000 });
}

async function exportCsv(page: Page, testInfo: TestInfo, fileName: string) {
  const overlay = page.locator('.manager-overlay');
  await expect(overlay.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const downloadPromise = page.waitForEvent('download');
    await overlay.getByRole('button', { name: csvExportLabel }).click();
    const download = await downloadPromise;
    const savedPath = testInfo.outputPath(fileName);
    await download.saveAs(savedPath);
    const text = await fs.readFile(savedPath, 'utf8');
    if (text.replace(/^\uFEFF/, '').trim().length > 0) {
      return text;
    }
    await page.waitForTimeout(500);
  }

  const savedPath = testInfo.outputPath(fileName);
  return fs.readFile(savedPath, 'utf8');
}

type SubjectTarget = {
  index: number;
  code: string;
  name: string;
};

type ClassroomTarget = {
  index: number;
  classroomId: string;
  classroomName: string;
};

function parseCsv(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true
  });
  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map(error => error.message).join(' / '));
  }
  return {
    headers: parsed.meta.fields ?? [],
    rows: parsed.data
  };
}

function getCsvValue(row: Record<string, string>, candidates: string[]) {
  for (const key of candidates) {
    const value = String(row[key] ?? '').trim();
    if (value) return value;
  }
  return '';
}

function setCsvValue(row: Record<string, string>, candidates: string[], value: string) {
  const key = candidates.find(candidate => Object.prototype.hasOwnProperty.call(row, candidate)) ?? candidates[0];
  row[key] = value;
}

function pickTwoSubjectRows(rows: Record<string, string>[]) {
  const targets = rows
    .map((row, index): SubjectTarget | null => {
      const code = getCsvValue(row, [codeHeader, '\u6642\u9593\u5272\u30b3\u30fc\u30c9', 'subjectCode']);
      const name = getCsvValue(row, [subjectNameHeader, '\u79d1\u76ee\u540d', 'subjectName']);
      if (!code || !name) return null;
      return { index, code, name };
    })
    .filter((row): row is SubjectTarget => row !== null);

  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      if (targets[i].code !== targets[j].code) {
        return [targets[i], targets[j]] as const;
      }
    }
  }

  throw new Error('Could not find two comparable subject rows in the CSV export.');
}

function pickTwoClassroomRows(rows: Record<string, string>[]) {
  const targets = rows
    .map((row, index): ClassroomTarget | null => {
      const classroomId = getCsvValue(row, [classroomIdHeader, 'ID']);
      const classroomName = getCsvValue(row, [classroomNameHeader, 'Name']);
      if (!classroomId || !classroomName) return null;
      return { index, classroomId, classroomName };
    })
    .filter((row): row is ClassroomTarget => row !== null);

  for (let i = 0; i < targets.length; i += 1) {
    for (let j = i + 1; j < targets.length; j += 1) {
      if (targets[i].classroomId !== targets[j].classroomId) {
        return [targets[i], targets[j]] as const;
      }
    }
  }

  throw new Error('Could not find two comparable classroom rows in the CSV export.');
}

function buildSwappedCsv(
  rows: Record<string, string>[],
  headers: string[],
  subjectLeft: SubjectTarget,
  subjectRight: SubjectTarget,
  classroomLeft: ClassroomTarget,
  classroomRight: ClassroomTarget
) {
  const cloned = rows.map(row => ({ ...row }));
  setCsvValue(cloned[subjectLeft.index], [classroomIdHeader, 'ID'], classroomRight.classroomId);
  setCsvValue(cloned[subjectLeft.index], [classroomNameHeader, 'Name'], classroomRight.classroomName);
  setCsvValue(cloned[subjectRight.index], [classroomIdHeader, 'ID'], classroomLeft.classroomId);
  setCsvValue(cloned[subjectRight.index], [classroomNameHeader, 'Name'], classroomLeft.classroomName);

  return '\uFEFF' + Papa.unparse(cloned, { columns: headers });
}

async function importCsv(page: Page, csvPath: string) {
  const dialogPromise = page.waitForEvent('dialog');
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  const dialog = await dialogPromise;
  await dialog.accept();
}

async function waitForAllocationCell(page: Page, subjectCode: string, classroomName: string) {
  await expect(
    page.locator('tr', { hasText: subjectCode }).getByText(classroomName, { exact: false })
  ).toBeVisible({ timeout: 10_000 });
}

async function writeCurrentChanges(page: Page) {
  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: writeButtonLabel }).click();
  const dialog = await dialogPromise;
  await dialog.accept();
}

async function seedCampusState(context: BrowserContext) {
  await context.addInitScript(
    ({ campusLabel, classrooms, subjects, allocations }) => {
      const write = (key: string, value: unknown) => {
        localStorage.setItem(`campus:${campusLabel}:${key}`, JSON.stringify(value));
      };
      write('classrooms', classrooms);
      write('subjects', subjects);
      write('allocations', allocations);
      write('allocationSettings', []);
      write('equipmentSettings', {});
      write('displayConfig', {});
      write('subjectTaxonomy', {});
    },
    {
      campusLabel: campusName,
      classrooms: [
        {
          id: 'R101',
          name: '101',
          campus: campusName,
          building: 'A棟',
          capacity: 50,
          examCapacity: 25,
          type: 'normal',
          isMovable: false,
          equipment: [],
          isExcluded: false
        },
        {
          id: 'R102',
          name: '102',
          campus: campusName,
          building: 'A棟',
          capacity: 60,
          examCapacity: 30,
          type: 'normal',
          isMovable: false,
          equipment: [],
          isExcluded: false
        }
      ],
      subjects: [
        {
          id: 'S101',
          code: 'S101',
          name: 'Subject 101',
          teacherCode: 'T101',
          teacher: 'Teacher 101',
          faculty: 'Faculty',
          department: 'Dept',
          term: 'spring',
          day: 'mon',
          period: 1,
          requiredCapacity: 30,
          campus: campusName,
          previousRooms: [],
          preferredRoomType: 'normal',
          requiresProjector: false,
          requiresMovable: false,
          requiredEquipment: [],
          mandatoryEquipment: [],
          isContinuous: false,
          priority: 1,
          requiredRoomCount: 1
        },
        {
          id: 'S102',
          code: 'S102',
          name: 'Subject 102',
          teacherCode: 'T102',
          teacher: 'Teacher 102',
          faculty: 'Faculty',
          department: 'Dept',
          term: 'spring',
          day: 'mon',
          period: 2,
          requiredCapacity: 30,
          campus: campusName,
          previousRooms: [],
          preferredRoomType: 'normal',
          requiresProjector: false,
          requiresMovable: false,
          requiredEquipment: [],
          mandatoryEquipment: [],
          isContinuous: false,
          priority: 1,
          requiredRoomCount: 1
        }
      ],
      allocations: []
    }
  );
}

async function readCloud(page: Page) {
  await page.getByRole('button', { name: readButtonLabel }).click();
  const confirmButton = page.getByRole('button', { name: 'それでも取得する' });
  try {
    await expect(confirmButton).toBeVisible({ timeout: 15_000 });
    await confirmButton.click();
    await expect(confirmButton).toBeHidden({ timeout: 15_000 });
    return;
  } catch {
    // The warning modal did not appear; continue with the already loaded data.
  }
  await page.waitForTimeout(500);
}

test('stale local write keeps latest cloud allocations and preserves earlier writes', async ({ browser }, testInfo) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  let baselineSubjectCsvText = '';

  try {
    await seedCampusState(contextA);
    await seedCampusState(contextB);
    await seedCampusState(contextC);

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const pageC = await contextC.newPage();

    await pageA.goto('/');
    await pageB.goto('/');

    await loginToCampus(pageA);
    await loginToCampus(pageB);

    const seedSubjectsPath = testInfo.outputPath('seed-subjects.csv');
    const seedClassroomsPath = testInfo.outputPath('seed-classrooms.csv');
    await fs.writeFile(
      seedSubjectsPath,
      '\uFEFF' + Papa.unparse([
        {
          Code: 'S101',
          Name: 'Subject 101',
          TeacherCode: 'T101',
          Teacher: 'Teacher 101',
          Faculty: 'Faculty',
          Department: 'Dept',
          Term: 'spring',
          Day: 'mon',
          Period: 1,
          Campus: campusName,
          RequiredRoomCount: 1,
          PreferredRoomType: 'normal'
        },
        {
          Code: 'S102',
          Name: 'Subject 102',
          TeacherCode: 'T102',
          Teacher: 'Teacher 102',
          Faculty: 'Faculty',
          Department: 'Dept',
          Term: 'spring',
          Day: 'mon',
          Period: 2,
          Campus: campusName,
          RequiredRoomCount: 1,
          PreferredRoomType: 'normal'
        }
      ]),
      'utf8'
    );
    await fs.writeFile(
      seedClassroomsPath,
      '\uFEFF' + Papa.unparse([
        { ID: 'R101', Name: '101', Campus: campusName, Building: 'A棟', Capacity: 50, ExamCapacity: 25, Type: 'normal' },
        { ID: 'R102', Name: '102', Campus: campusName, Building: 'A棟', Capacity: 60, ExamCapacity: 30, Type: 'normal' }
      ]),
      'utf8'
    );

    await openSubjectManager(pageA);
    await importCsv(pageA, seedSubjectsPath);
    await closeManager(pageA, subjectManagerLabel);

    await openClassroomManager(pageA);
    await importCsv(pageA, seedClassroomsPath);
    await closeManager(pageA, classroomManagerLabel);

    await openSubjectManager(pageA);
    baselineSubjectCsvText = await exportCsv(pageA, testInfo, 'baseline-subjects.csv');
    const subjectCsv = parseCsv(baselineSubjectCsvText);
    const [subjectA, subjectB] = pickTwoSubjectRows(subjectCsv.rows);
    await closeManager(pageA, subjectManagerLabel);

    await openClassroomManager(pageA);
    const classroomCsvText = await exportCsv(pageA, testInfo, 'baseline-classrooms.csv');
    const classroomCsv = parseCsv(classroomCsvText);
    const [classroomA, classroomB] = pickTwoClassroomRows(classroomCsv.rows);
    await closeManager(pageA, classroomManagerLabel);

    const swappedACsv = buildSwappedCsv(subjectCsv.rows, subjectCsv.headers, subjectA, subjectB, classroomA, classroomB);
    const swappedBCsv = buildSwappedCsv(subjectCsv.rows, subjectCsv.headers, subjectB, subjectA, classroomB, classroomA);

    const pathA = testInfo.outputPath('stale-write-a.csv');
    const pathB = testInfo.outputPath('stale-write-b.csv');
    await fs.writeFile(pathA, swappedACsv, 'utf8');
    await fs.writeFile(pathB, swappedBCsv, 'utf8');

    await openSubjectManager(pageA);
    await importCsv(pageA, pathA);
    await closeManager(pageA, subjectManagerLabel);
    await openSubjectManager(pageA);
    await waitForAllocationCell(pageA, subjectA.code, classroomB.classroomName);
    const afterImportA = parseCsv(await exportCsv(pageA, testInfo, 'after-import-a.csv'));
    expect(
      afterImportA.rows.find(
        row =>
          String(row[codeHeader] ?? '').trim() === subjectA.code &&
          String(row[classroomIdHeader] ?? '').trim() === classroomB.classroomId
      )
    ).toBeTruthy();
    await closeManager(pageA, subjectManagerLabel);

    await writeCurrentChanges(pageA);

    await openSubjectManager(pageB);
    await importCsv(pageB, pathB);
    await closeManager(pageB, subjectManagerLabel);
    await openSubjectManager(pageB);
    await waitForAllocationCell(pageB, subjectB.code, classroomA.classroomName);
    const afterImportB = parseCsv(await exportCsv(pageB, testInfo, 'after-import-b.csv'));
    expect(
      afterImportB.rows.find(
        row =>
          String(row[codeHeader] ?? '').trim() === subjectB.code &&
          String(row[classroomIdHeader] ?? '').trim() === classroomA.classroomId
      )
    ).toBeTruthy();
    await closeManager(pageB, subjectManagerLabel);

    await writeCurrentChanges(pageB);

    await pageC.goto('/');
    await loginToCampus(pageC);
    await readCloud(pageC);

    await openSubjectManager(pageC);
    const exportedAfterWrites = await exportCsv(pageC, testInfo, 'after-stale-writes.csv');
    const after = parseCsv(exportedAfterWrites);

    const leftRow = after.rows.find(
      row =>
        String(row[codeHeader] ?? '').trim() === subjectA.code &&
        String(row[classroomIdHeader] ?? '').trim() === classroomB.classroomId
    );
    const rightRow = after.rows.find(
      row =>
        String(row[codeHeader] ?? '').trim() === subjectB.code &&
        String(row[classroomIdHeader] ?? '').trim() === classroomA.classroomId
    );

    expect(leftRow).toBeTruthy();
    expect(rightRow).toBeTruthy();

    const restorePath = testInfo.outputPath('restore-baseline.csv');
    await fs.writeFile(restorePath, baselineSubjectCsvText, 'utf8');
    await importCsv(pageC, restorePath);
    await closeManager(pageC, subjectManagerLabel);
    await writeCurrentChanges(pageC);
  } finally {
    await contextA.close().catch(() => {});
    await contextB.close().catch(() => {});
    await contextC.close().catch(() => {});
  }
});
