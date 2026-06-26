import { expect, test, type Page, type TestInfo } from '@playwright/test';
import Papa from 'papaparse';
import fs from 'node:fs/promises';

const campusName = '八景';
const subjectManagerLabel = '科目管理';
const classroomManagerLabel = '教室管理';
const writeButtonLabel = '書込';
const csvExportLabel = 'CSVエクスポート';
const subjectCodeHeaders = ['コード', '時間割コード', 'subjectCode', 'Code'];
const subjectNameHeaders = ['時間割名称', '科目名', 'subjectName', 'Name'];
const classroomIdHeaders = ['教室ID', 'classroomId', 'ClassroomID', 'ID'];
const classroomNameHeaders = ['教室名', 'classroomName', 'ClassroomName', 'Name'];

async function loginToCampus(page: Page) {
  await expect(page.getByRole('button', { name: campusName })).toBeVisible();
  await page.getByRole('button', { name: campusName }).click();
  await expect(page.getByRole('button', { name: writeButtonLabel })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 60_000 });
}

async function openManager(page: Page, buttonName: string) {
  await page.getByRole('button', { name: buttonName }).click();
  await expect(page.getByRole('heading', { name: buttonName })).toBeVisible({ timeout: 60_000 });
}

async function closeManager(page: Page, buttonName: string) {
  await page.locator('.manager-overlay header button').click();
  await expect(page.getByRole('button', { name: buttonName })).toBeVisible({ timeout: 60_000 });
}

async function exportCsv(page: Page, testInfo: TestInfo, fileName: string) {
  const overlay = page.locator('.manager-overlay');
  await expect(overlay.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 });

  const downloadPromise = page.waitForEvent('download');
  await overlay.getByRole('button', { name: csvExportLabel }).click();
  const download = await downloadPromise;
  const savedPath = testInfo.outputPath(fileName);
  await download.saveAs(savedPath);
  return fs.readFile(savedPath, 'utf8');
}

async function importCsv(page: Page, csvPath: string) {
  const dialogPromise = page.waitForEvent('dialog');
  await page.locator('input[type="file"]').setInputFiles(csvPath);
  const dialog = await dialogPromise;
  await dialog.accept();
}

function parseCsv(text: string) {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ''), {
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

function ensureColumn(headers: string[], candidates: string[]) {
  const existing = candidates.find(candidate => headers.includes(candidate));
  if (existing) return existing;
  headers.push(candidates[0]);
  return candidates[0];
}

function assignOneClassroom(subjectCsvText: string, classroomCsvText: string) {
  const subjectCsv = parseCsv(subjectCsvText);
  const classroomCsv = parseCsv(classroomCsvText);
  const targetSubjectIndex = subjectCsv.rows.findIndex(row =>
    getCsvValue(row, subjectCodeHeaders) && getCsvValue(row, subjectNameHeaders)
  );
  if (targetSubjectIndex < 0) {
    throw new Error('No subject row found for auto allocation guard test.');
  }

  const targetSubject = subjectCsv.rows[targetSubjectIndex];
  const currentClassroomId = getCsvValue(targetSubject, classroomIdHeaders);
  const targetClassroom = classroomCsv.rows.find(row => {
    const classroomId = getCsvValue(row, classroomIdHeaders);
    return classroomId && classroomId !== currentClassroomId;
  });
  if (!targetClassroom) {
    throw new Error('No classroom row found for auto allocation guard test.');
  }

  const nextHeaders = [...subjectCsv.headers];
  const classroomIdHeader = ensureColumn(nextHeaders, classroomIdHeaders);
  const classroomNameHeader = ensureColumn(nextHeaders, classroomNameHeaders);
  const nextRows = subjectCsv.rows.map(row => ({ ...row }));
  nextRows[targetSubjectIndex][classroomIdHeader] = getCsvValue(targetClassroom, classroomIdHeaders);
  nextRows[targetSubjectIndex][classroomNameHeader] = getCsvValue(targetClassroom, classroomNameHeaders);

  return {
    csvText: '\uFEFF' + Papa.unparse(nextRows, { columns: nextHeaders }),
    subjectCode: getCsvValue(targetSubject, subjectCodeHeaders),
    classroomName: getCsvValue(targetClassroom, classroomNameHeaders)
  };
}

test('blocks auto allocation when local classroom changes are not written', async ({ page }, testInfo) => {
  await page.goto('/');
  await loginToCampus(page);

  await openManager(page, subjectManagerLabel);
  const subjectCsvText = await exportCsv(page, testInfo, 'subjects-before-local-change.csv');
  await closeManager(page, subjectManagerLabel);

  await openManager(page, classroomManagerLabel);
  const classroomCsvText = await exportCsv(page, testInfo, 'classrooms-before-local-change.csv');
  await closeManager(page, classroomManagerLabel);

  const changedSubjectCsv = assignOneClassroom(subjectCsvText, classroomCsvText);
  const changedSubjectPath = testInfo.outputPath('subjects-local-classroom-change.csv');
  await fs.writeFile(changedSubjectPath, changedSubjectCsv.csvText, 'utf8');

  await openManager(page, subjectManagerLabel);
  await importCsv(page, changedSubjectPath);
  await expect(page.locator('tr', { hasText: changedSubjectCsv.subjectCode }).getByText(changedSubjectCsv.classroomName, { exact: false })).toBeVisible({ timeout: 10_000 });
  await closeManager(page, subjectManagerLabel);

  await page.getByRole('button', { name: '配当ルール設定' }).click();
  await expect(page.getByRole('heading', { name: '配当ルール設定' })).toBeVisible({ timeout: 60_000 });

  await page.getByRole('button', { name: '教室自動配当' }).click();

  await expect(page.getByRole('heading', { name: '自動配当を開始できません' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText('ローカルとクラウドの内容が一致していません。')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ローカルから書込' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'クラウドから取得' })).toBeVisible();
  await expect(page.getByRole('button', { name: '中止' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '自動配当結果' })).toHaveCount(0);
});
