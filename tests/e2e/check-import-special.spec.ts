import { expect, test } from '@playwright/test';

const filePath = 'C:\\Users\\kotok\\Downloads\\import用（暫定×）.csv';

test('import the specified subject csv', async ({ page }) => {
  const alerts: string[] = [];
  page.on('dialog', async dialog => {
    alerts.push(dialog.message());
    await dialog.accept();
  });

  await page.goto('/');
  const modalButtons = page.locator('.modal-overlay button');
  if (await modalButtons.count()) {
    const box = await modalButtons.first().boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }
  }
  await expect(page.locator('.modal-overlay')).toHaveCount(0, { timeout: 60_000 });

  const managerButton = page.locator('header button').nth(3);
  await managerButton.click();
  await expect(page.locator('.manager-overlay')).toBeVisible({ timeout: 60_000 });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /CSV/ }).click()
  ]);
  await fileChooser.setFiles(filePath);

  await page.waitForTimeout(1000);
  const bodyText = await page.locator('body').innerText();
  console.log(JSON.stringify({ alerts, bodyText: bodyText.slice(0, 1200) }, null, 2));
});
