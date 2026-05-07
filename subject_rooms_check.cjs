const { chromium } = require('playwright');
(async() => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'subject_rooms_home.png', fullPage: true });
  await browser.close();
})();
