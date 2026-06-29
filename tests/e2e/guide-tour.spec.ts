import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const guideLabel = 'ガイド';
const guideButtonSelector = '[data-tour="guide-button"]';
const campusName = '八景';
const highlightPadding = 6;
const guideCardGap = 14;
const guideCardMargin = 16;
const guideCardMinWidth = 220;
const highlightAlignmentTolerance = 4;

type GuideTargetExpectation = {
  title: string;
  target: string;
  targetText?: string;
};

type GuideTopicExpectation = {
  topic: string;
  steps: GuideTargetExpectation[];
};

const targetTextBySelector: Record<string, string | null> = {
  '[data-tour="guide-button"]': 'ガイド',
  '[data-tour="unassigned-list"]': '未配当',
  '[data-tour="timetable-grid"]': null,
  '[data-tour="day-tabs"]': '月曜日',
  '[data-tour="filters"]': '建物',
  '[data-tour="legend"]': '凡例',
  '[data-tour="subject-manager"]': '科目管理',
  '[data-tour="subject-manager-header"]': '科目管理',
  '[data-tour="subject-add"]': '新規追加',
  '[data-tour="subject-import"]': 'CSVインポート',
  '[data-tour="subject-table"]': 'コード',
  '[data-tour="subject-column-settings"]': '列設定',
  '[data-tour="subject-taxonomy"]': '開講学部・管轄',
  '[data-tour="subject-export"]': 'CSVエクスポート',
  '[data-tour="classroom-manager"]': '教室管理',
  '[data-tour="classroom-manager-header"]': '教室管理',
  '[data-tour="classroom-add"]': '新規教室',
  '[data-tour="classroom-import"]': 'CSVインポート',
  '[data-tour="classroom-table"]': '教室名',
  '[data-tour="classroom-column-settings"]': '列設定',
  '[data-tour="classroom-excluded-note"]': '配当対象外',
  '[data-tour="classroom-export"]': 'CSVエクスポート',
  '[data-tour="allocation-rules"]': '配当ルール設定',
  '[data-tour="allocation-settings-header"]': '配当ルール設定',
  '[data-tour="allocation-basic-settings"]': '配当基本設定',
  '[data-tour="allocation-mode"]': '配当モード',
  '[data-tour="allocation-preference-rules"]': '希望条件の順序',
  '[data-tour="allocation-equipment-rules"]': '対象機材',
  '[data-tour="allocation-run"]': '教室自動配当',
  '[data-tour="cloud-write"]': '書込',
  '[data-tour="cloud-read"]': '取得',
  '[data-tour="logout"]': 'ログアウト',
  '[data-tour="allocation-clear"]': '配当クリア'
};

const guideTargetExpectations: GuideTopicExpectation[] = [
  {
    topic: '画面の見方',
    steps: [
      { title: 'ガイド', target: '[data-tour="guide-button"]' },
      { title: '未配当の科目', target: '[data-tour="unassigned-list"]' },
      { title: '教室の空き状況', target: '[data-tour="timetable-grid"]' },
      { title: '曜日を変える', target: '[data-tour="day-tabs"]' },
      { title: '教室を探しやすくする', target: '[data-tour="filters"]' },
      { title: '表示の意味を見る', target: '[data-tour="legend"]' }
    ]
  },
  {
    topic: '科目の追加・削除',
    steps: [
      { title: '科目管理を開く', target: '[data-tour="subject-manager"]' },
      { title: '登録済み科目を確認する', target: '[data-tour="subject-manager-header"]' },
      { title: '新規追加', target: '[data-tour="subject-add"]' },
      { title: 'CSVインポート', target: '[data-tour="subject-import"]' },
      { title: '一覧で編集・削除する', target: '[data-tour="subject-table"]' },
      { title: '列設定', target: '[data-tour="subject-column-settings"]' },
      { title: '開講学部・管轄を整える', target: '[data-tour="subject-taxonomy"]' },
      { title: 'CSVエクスポート', target: '[data-tour="subject-export"]' }
    ]
  },
  {
    topic: '教室マスタの設定',
    steps: [
      { title: '教室管理を開く', target: '[data-tour="classroom-manager"]' },
      { title: '登録済み教室を確認する', target: '[data-tour="classroom-manager-header"]' },
      { title: '新規教室', target: '[data-tour="classroom-add"]' },
      { title: 'CSVインポート', target: '[data-tour="classroom-import"]' },
      { title: '一覧で編集・削除する', target: '[data-tour="classroom-table"]' },
      { title: '列設定', target: '[data-tour="classroom-column-settings"]' },
      { title: '使わない教室を外す', target: '[data-tour="classroom-excluded-note"]' },
      { title: 'CSVエクスポート', target: '[data-tour="classroom-export"]' }
    ]
  },
  {
    topic: '科目の教室自動配当',
    steps: [
      { title: '未保存の変更を確認する', target: '[data-tour="cloud-write"]' },
      { title: '配当ルール設定を開く', target: '[data-tour="allocation-rules"]' },
      { title: '自動配当の準備', target: '[data-tour="allocation-settings-header"]' },
      { title: '対象を選ぶ', target: '[data-tour="allocation-basic-settings"]' },
      { title: '配当方法を選ぶ', target: '[data-tour="allocation-mode"]' },
      { title: '優先したい条件', target: '[data-tour="allocation-preference-rules"]' },
      { title: '必要な機材', target: '[data-tour="allocation-equipment-rules"]' },
      { title: '自動配当を実行', target: '[data-tour="allocation-run"]' }
    ]
  },
  {
    topic: '手動教室調整',
    steps: [
      { title: '調整する科目を探す', target: '[data-tour="unassigned-list"]' },
      { title: '曜日を合わせる', target: '[data-tour="day-tabs"]' },
      { title: '候補教室を絞る', target: '[data-tour="filters"]' },
      { title: '空き枠へ移動する', target: '[data-tour="timetable-grid"]' },
      { title: '表示を確認する', target: '[data-tour="legend"]' },
      { title: '変更を書込する', target: '[data-tour="cloud-write"]' }
    ]
  },
  {
    topic: '教室再配当、配当クリア',
    steps: [
      { title: '表示の意味を見る', target: '[data-tour="legend"]' },
      { title: '配当を消す', target: '[data-tour="allocation-clear"]' },
      { title: '配当ルール設定を開く', target: '[data-tour="allocation-rules"]' },
      { title: '再配当の範囲', target: '[data-tour="allocation-mode"]' }
    ]
  }
];

const cloudGuideTargetExpectation: GuideTopicExpectation = {
  topic: 'クラウドへの書込と取得',
  steps: [
    { title: 'ローカルから書込', target: '[data-tour="cloud-write"]' },
    { title: 'クラウドから取得', target: '[data-tour="cloud-read"]' },
    { title: 'ログアウト', target: '[data-tour="logout"]' }
  ]
};

async function loginToCampus(page: Page) {
  await expect(page.getByRole('button', { name: campusName })).toBeVisible();
  await page.getByRole('button', { name: campusName }).click();
  await expect(page.locator(guideButtonSelector)).toBeVisible({ timeout: 60_000 });
}

async function openGuideChooser(page: Page) {
  await page.locator(guideButtonSelector).click();
  await expect(page.getByRole('menu', { name: 'ガイドの種類' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'ガイドツアー' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'マニュアル' })).toBeVisible();
}

async function openGuideTour(page: Page) {
  await openGuideChooser(page);
  await page.getByRole('menuitem', { name: 'ガイドツアー' }).click();
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();
}

async function openManualFromGuideChooser(page: Page) {
  await openGuideChooser(page);
  await page.getByRole('menuitem', { name: 'マニュアル' }).click();
}

async function backToGuideMenu(page: Page) {
  await page.getByRole('button', { name: '項目選択へ' }).click();
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();
}

async function expectStableGuideStep(page: Page) {
  const card = page.locator('.guide-step-card');
  await expect(card).toHaveCount(1);
  await expect(card).toBeVisible();
  await expect(page.locator('.guide-missing-target')).toHaveCount(0);
  await expect(page.locator('.guide-caution')).toHaveCount(0);
  await expect(page.locator('.guide-tour-dim')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');

  await expect.poll(async () => await card.boundingBox()).not.toBeNull();
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

async function expectGuideTargetAlignment(page: Page, { target, targetText }: GuideTargetExpectation) {
  const targetLocator = page.locator(target);
  const highlightLocator = page.locator('.guide-highlight');
  const cardLocator = page.locator('.guide-step-card');
  const expectedTargetText = targetText ?? targetTextBySelector[target];
  if (!(target in targetTextBySelector)) {
    throw new Error(`Guide target is not covered by E2E expectations: ${target}`);
  }
  await expect(targetLocator).toBeVisible();
  if (expectedTargetText) {
    await expect(targetLocator).toContainText(expectedTargetText);
  }
  await expect(highlightLocator).toHaveCount(1);
  await expect(highlightLocator).toBeVisible();
  await expect(highlightLocator).toHaveCSS('box-shadow', /9999px/);
  await expect.poll(async () => await targetLocator.boundingBox()).not.toBeNull();
  await expect.poll(async () => await highlightLocator.boundingBox()).not.toBeNull();

  await expect.poll(async () => {
    const targetBox = await targetLocator.boundingBox();
    const highlightBox = await highlightLocator.boundingBox();
    const viewport = page.viewportSize();
    if (!targetBox || !highlightBox || !viewport) return Number.POSITIVE_INFINITY;

    const expectedX = Math.max(targetBox.x - highlightPadding, 0);
    const expectedY = Math.max(targetBox.y - highlightPadding, 0);
    const expectedWidth = Math.min(targetBox.width + highlightPadding * 2, viewport.width - expectedX);
    const expectedHeight = Math.min(targetBox.height + highlightPadding * 2, viewport.height - expectedY);

    return Math.max(
      Math.abs(highlightBox.x - expectedX),
      Math.abs(highlightBox.y - expectedY),
      Math.abs(highlightBox.width - expectedWidth),
      Math.abs(highlightBox.height - expectedHeight)
    );
  }).toBeLessThanOrEqual(highlightAlignmentTolerance);

  const targetBox = await targetLocator.boundingBox();
  const cardBox = await cardLocator.boundingBox();
  const viewport = page.viewportSize();
  expect(targetBox).not.toBeNull();
  expect(cardBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!targetBox || !cardBox || !viewport) return;

  const canFitOutsideHorizontally =
    targetBox.x - guideCardMargin - guideCardGap >= guideCardMinWidth
    || viewport.width - (targetBox.x + targetBox.width) - guideCardMargin - guideCardGap >= guideCardMinWidth;
  const canFitOutsideVertically =
    targetBox.y - guideCardMargin - guideCardGap >= cardBox.height
    || viewport.height - (targetBox.y + targetBox.height) - guideCardMargin - guideCardGap >= cardBox.height;

  if (canFitOutsideHorizontally || canFitOutsideVertically) {
    const overlapWidth = Math.max(
      0,
      Math.min(targetBox.x + targetBox.width, cardBox.x + cardBox.width) - Math.max(targetBox.x, cardBox.x)
    );
    const overlapHeight = Math.max(
      0,
      Math.min(targetBox.y + targetBox.height, cardBox.y + cardBox.height) - Math.max(targetBox.y, cardBox.y)
    );
    expect(overlapWidth * overlapHeight).toBeLessThanOrEqual(1);
  }
}

function textPattern(text: string) {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
}

async function expectCurrentGuideTarget(page: Page, expectation: GuideTargetExpectation) {
  await expect(page.locator('.guide-step-card')).toBeVisible();
  await expect(page.locator('#guide-step-title')).toBeVisible();
  await expect(page.locator('#guide-step-title')).toHaveText(expectation.title);
  await expectStableGuideStep(page);
  await expectGuideTargetAlignment(page, expectation);
}

async function runGuideTopicTargetChecks(page: Page, topic: GuideTopicExpectation) {
  await page.getByRole('button', { name: textPattern(topic.topic) }).click();
  for (let index = 0; index < topic.steps.length; index += 1) {
    await test.step(`${topic.topic}: ${topic.steps[index].title}`, async () => {
      await expectCurrentGuideTarget(page, topic.steps[index]);
      await expect(page.locator('.guide-step-count')).toHaveAttribute('aria-label', `ステップ ${index + 1} / ${topic.steps.length}`);
    });
    if (index < topic.steps.length - 1) {
      await page.getByRole('button', { name: /次へ/ }).click();
    }
  }
  await backToGuideMenu(page);
}

test('guide tour switches screens and returns to the guide menu', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator(guideButtonSelector)).toHaveCount(0);
  await loginToCampus(page);

  await openGuideChooser(page);
  await expect(page.getByRole('heading', { name: guideLabel })).toHaveCount(0);
  await page.getByRole('menuitem', { name: 'ガイドツアー' }).click();
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
  await expect(page.getByRole('heading', { name: '科目管理を開く' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.locator('[data-tour="subject-manager-screen"]').getByRole('heading', { name: '科目管理' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '登録済み科目を確認する' })).toBeVisible();
  await expectStableGuideStep(page);
  await backToGuideMenu(page);
  await expect(page.getByRole('heading', { name: '登録済み科目を確認する' })).toHaveCount(0);

  await page.getByRole('button', { name: /教室マスタの設定/ }).click();
  await expect(page.getByRole('heading', { name: '教室管理を開く' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expect(page.locator('[data-tour="classroom-manager-screen"]').getByRole('heading', { name: '教室管理' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '登録済み教室を確認する' })).toBeVisible();
  await expectStableGuideStep(page);
  await backToGuideMenu(page);
  await expect(page.getByRole('heading', { name: '登録済み教室を確認する' })).toHaveCount(0);

  await page.getByRole('button', { name: /科目の教室自動配当/ }).click();
  await expect(page.getByRole('heading', { name: '未保存の変更を確認する' })).toBeVisible();
  await expectStableGuideStep(page);
  await page.getByRole('button', { name: /次へ/ }).click();
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

test('manual opens as a sidebar and keeps the app operable', async ({ page }) => {
  await page.goto('/');
  await loginToCampus(page);

  await openManualFromGuideChooser(page);
  await expect(page.getByRole('heading', { name: guideLabel })).toHaveCount(0);
  const manualPanel = page.getByRole('complementary', { name: 'マニュアル' });
  await expect(manualPanel).toBeVisible();
  await expect(manualPanel.getByRole('heading', { name: '教室配当マニュアル', exact: true })).toBeVisible();
  await expect(manualPanel.getByLabel('マニュアルを検索')).toBeVisible();
  await expect(manualPanel.getByRole('button', { name: /画面の見方/ })).toBeVisible();
  await expect(manualPanel.getByLabel('関連する場所')).toBeVisible();
  await expect(manualPanel.getByRole('button', { name: '編集', exact: true })).toBeVisible();

  const widthBefore = await manualPanel.boundingBox();
  const resizeHandle = page.locator('.guide-manual-resize-handle');
  const handleBox = await resizeHandle.boundingBox();
  expect(widthBefore).not.toBeNull();
  expect(handleBox).not.toBeNull();
  if (widthBefore && handleBox) {
    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 90, handleBox.y + handleBox.height / 2);
    await page.mouse.up();
    await expect.poll(async () => (await manualPanel.boundingBox())?.width ?? 0).toBeGreaterThan(widthBefore.width + 50);
  }

  await manualPanel.getByRole('button', { name: '編集', exact: true }).click();
  await expect(manualPanel.locator('input').first()).toHaveValue('教室配当マニュアル');
  await expect(manualPanel.locator('.guide-manual-edit-list')).toBeVisible();
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click();
  await expect(manualPanel.locator('.guide-manual-edit-list')).toHaveCount(0);

  await manualPanel.getByRole('button', { name: /科目を1件追加・編集する/ }).click();
  await manualPanel.getByRole('button', { name: '新規追加' }).click();
  await expect(page.locator('[data-tour="subject-manager-screen"]').getByRole('heading', { name: '科目管理' })).toBeVisible();
  await expect(page.locator('[data-tour="subject-add"]')).toHaveClass(/manual-target-flash/);
  await expect(manualPanel).toBeVisible();

  await page.getByRole('button', { name: 'マニュアルを閉じる' }).click();
  await expect(page.getByRole('complementary', { name: 'マニュアル' })).toHaveCount(0);
});

test('guide closes with Escape from menu and step views', async ({ page }) => {
  await page.goto('/');
  await loginToCampus(page);

  await openGuideTour(page);
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: guideLabel })).toHaveCount(0);

  await openGuideTour(page);
  await page.getByRole('button', { name: /科目の追加・削除/ }).click();
  await expect(page.getByRole('heading', { name: '科目管理を開く' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: '科目管理を開く' })).toHaveCount(0);
  await expect(page.locator('[data-tour="subject-manager-screen"]')).toHaveCount(0);
});

test('guide remains usable on narrow and zoomed layouts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await loginToCampus(page);

  await openGuideTour(page);
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();
  await page.getByRole('button', { name: /科目の追加・削除/ }).click();
  await expectCurrentGuideTarget(page, guideTargetExpectations[1].steps[0]);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expectCurrentGuideTarget(page, guideTargetExpectations[1].steps[1]);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expectCurrentGuideTarget(page, guideTargetExpectations[1].steps[2]);
  await page.keyboard.press('Escape');
  await expect(page.locator('.guide-step-card')).toHaveCount(0);

  await page.setViewportSize({ width: 900, height: 650 });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('zoom', '1.25');
  });
  await openGuideTour(page);
  await page.getByRole('button', { name: /科目の教室自動配当/ }).click();
  await expectCurrentGuideTarget(page, guideTargetExpectations[3].steps[0]);
  await page.getByRole('button', { name: /次へ/ }).click();
  await expectCurrentGuideTarget(page, guideTargetExpectations[3].steps[1]);
});

test('guide target highlights match the guided controls', async ({ page }) => {
  await page.goto('/');
  await loginToCampus(page);

  await openGuideTour(page);
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();

  for (const topic of guideTargetExpectations) {
    await runGuideTopicTargetChecks(page, topic);
  }

  await page.getByRole('button', { name: 'ガイドを閉じる', exact: true }).click();
  await expect(page.getByRole('heading', { name: guideLabel })).toHaveCount(0);
});

test('cloud guide target highlights match logged-in controls', async ({ page }) => {
  await page.goto('/');
  await loginToCampus(page);

  await openGuideTour(page);
  await expect(page.getByRole('heading', { name: guideLabel })).toBeVisible();
  await runGuideTopicTargetChecks(page, cloudGuideTargetExpectation);

  await page.getByRole('button', { name: 'ガイドを閉じる', exact: true }).click();
  await expect(page.getByRole('heading', { name: guideLabel })).toHaveCount(0);
});
