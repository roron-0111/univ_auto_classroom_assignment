import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const guideLabel = 'ガイド';
const openGuideLabel = 'ガイドを開く';

async function backToGuideMenu(page: Page) {
  await page.getByRole('button', { name: '項目選択へ' }).click();
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();
}

async function expectStableGuideStep(page: Page) {
  const card = page.locator('.guide-step-card');
  await expect(card).toBeVisible();
  await expect(page.locator('.guide-missing-target')).toHaveCount(0);
  await expect(page.locator('.guide-tour-dim')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  const box = await card.boundingBox();
  const viewport = page.viewportSize();

  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectGuideTargetText(page: Page, selector: string, text: string) {
  const target = page.locator(selector);
  await expect(target).toBeVisible();
  await expect(target).toContainText(text);
}

test('guide tour switches screens and returns to the guide menu', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: openGuideLabel }).click();
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();
  await expect(page.getByText('項目を選択すると、ガイドツアーを開始します。')).toBeVisible();
  await expect(page.getByRole('button', { name: '終了', exact: true })).toHaveCount(0);
  await expect(page.locator('.guide-topic-icon-overview')).toHaveCount(1);
  await expect(page.locator('.guide-topic-icon-subjects')).toHaveCount(1);
  await expect(page.locator('.guide-topic-icon-classrooms')).toHaveCount(1);
  await expect(page.locator('.guide-topic-icon-auto')).toHaveCount(1);
  await expect(page.locator('.guide-topic-icon-manual')).toHaveCount(1);
  await expect(page.locator('.guide-topic-icon-cloud')).toHaveCount(1);
  await expect(page.locator('.guide-topic-icon-trouble')).toHaveCount(1);

  await page.getByRole('button', { name: /科目の追加・削除/ }).click();
  await expect(page.getByRole('heading', { name: '授業管理を開く' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.locator('[data-tour="subject-manager-screen"]').getByRole('heading', { name: '授業管理' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '授業を確認する' })).toBeVisible();
  await expectStableGuideStep(page);
  await backToGuideMenu(page);
  await expect(page.getByRole('heading', { name: '授業を確認する' })).toHaveCount(0);

  await page.getByRole('button', { name: /教室マスタの設定/ }).click();
  await expect(page.getByRole('heading', { name: '教室管理を開く' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.locator('[data-tour="classroom-manager-screen"]').getByRole('heading', { name: '教室管理' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '教室を確認する' })).toBeVisible();
  await expectStableGuideStep(page);
  await backToGuideMenu(page);
  await expect(page.getByRole('heading', { name: '教室を確認する' })).toHaveCount(0);

  await page.getByRole('button', { name: /科目の教室自動配当/ }).click();
  await expect(page.getByRole('heading', { name: '配当ルール設定を開く' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.locator('[data-tour="allocation-settings-screen"]').getByRole('heading', { name: '配当ルール設定' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '自動配当の準備' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.getByRole('heading', { name: '対象を選ぶ' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.getByRole('heading', { name: '配当方法を選ぶ' })).toBeVisible();
  await expectGuideTargetText(page, '[data-tour="allocation-mode"]', '配当モード');
  await expectStableGuideStep(page);
  await backToGuideMenu(page);
  await expect(page.getByRole('heading', { name: '自動配当の準備' })).toHaveCount(0);

  await page.getByRole('button', { name: 'ガイドを閉じる', exact: true }).click();
  await expect(page.getByRole('heading', { name: guideLabel })).toHaveCount(0);
});
