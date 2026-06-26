import { expect, test } from '@playwright/test';

const campusName = '\u516b\u666f';
const subjectManagerLabel = '\u79d1\u76ee\u7ba1\u7406';
const writeButtonLabel = '\u66f8\u8fbc';
const csvImportLabel = 'CSV\u30a4\u30f3\u30dd\u30fc\u30c8';
const importedCode = 'TEST001';
const subjectCsv = [
  'Code,Name,TeacherCode,Teacher,Faculty,Department,Term,Day,Period,Campus,RequiredRoomCount,PreferredRoomType,RequiredCapacity',
  `${importedCode},CSV Import Smoke,999999,Test Teacher,Test,IR,spring,mon,1,${campusName},1,normal,10`
].join('\n');

test('import the specified subject csv', async ({ page }) => {
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.goto('/');
  await page.getByRole('button', { name: campusName }).click();
  await expect(page.getByRole('button', { name: writeButtonLabel })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 60_000 });

  await page.getByRole('button', { name: subjectManagerLabel }).click();
  await expect(page.locator('.manager-overlay')).toBeVisible({ timeout: 60_000 });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: csvImportLabel }).click()
  ]);
  await fileChooser.setFiles({
    name: 'subjects-import-smoke.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(subjectCsv, 'utf8')
  });

  await expect.poll(async () => page.evaluate(code =>
    Object.values(localStorage).some(value => typeof value === 'string' && value.includes(code)),
  importedCode), { timeout: 10_000 }).toBe(true);
});
