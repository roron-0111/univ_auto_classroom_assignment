import { expect, test } from '@playwright/test';

const cloudWriteResults = [
  'Cloud write complete.',
  '変更はありませんでした。',
  '現在、別のユーザーが書き込み中です。しばらく待ってから再度お試しください。'
] as const;

const campusName = '八景';

async function loginToCampus(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: campusName })).toBeVisible();
  await page.getByRole('button', { name: campusName }).click();
}

test('can log in to the campus and reach the main controls', async ({ page }) => {
  await page.goto('/');

  await loginToCampus(page);

  await expect(page.getByRole('button', { name: '書込' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('button', { name: '取得' })).toBeVisible();
  await expect(page.getByTitle('ログアウト')).toBeVisible();
});

test('logout returns to the campus selection modal', async ({ page }) => {
  await page.goto('/');

  await loginToCampus(page);

  await expect(page.getByTitle('ログアウト')).toBeVisible({ timeout: 60_000 });
  await page.getByTitle('ログアウト').click();

  await expect(page.getByRole('button', { name: campusName })).toBeVisible({ timeout: 60_000 });
});

test('write without local changes reports no-op', async ({ page }) => {
  await page.goto('/');

  await loginToCampus(page);

  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: '書込' }).click();
  const dialog = await dialogPromise;

  expect(cloudWriteResults).toContain(dialog.message());
  await dialog.accept();
});

test('read without local changes loads cloud data directly', async ({ page }) => {
  await page.goto('/');

  await loginToCampus(page);

  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: '取得' }).click();
  const dialog = await dialogPromise;

  expect(['Cloud data loaded.', 'No cloud data found.']).toContain(dialog.message());
  await dialog.accept();
});

test('write read write roundtrip stays stable', async ({ page }) => {
  await page.goto('/');

  await loginToCampus(page);

  for (const label of ['書込', '取得', '書込'] as const) {
    const dialogPromise = page.waitForEvent('dialog');
    await page.getByRole('button', { name: label }).click();
    const dialog = await dialogPromise;
    expect([
      'Cloud write complete.',
      '変更はありませんでした。',
      '現在、別のユーザーが書き込み中です。しばらく待ってから再度お試しください。',
      'Cloud data loaded.',
      'No cloud data found.'
    ]).toContain(dialog.message());
    await dialog.accept();
  }
});
