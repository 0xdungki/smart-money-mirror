const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1800 } });
  await page.goto('https://0xdungki.github.io/smart-money-mirror/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'docs/dashboard.png', fullPage: false });
  await page.evaluate(() => window.scrollTo(0, 1100));
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'docs/wallets.png', fullPage: false });
  console.log('OK shots written');
  await browser.close();
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
