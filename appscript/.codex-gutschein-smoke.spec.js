const { test, expect } = require('playwright/test');

const ERP_URL = 'https://script.google.com/macros/s/AKfycbxnHuB2u4-pDD23JDdFDpHB0ZIzGxLWm15Xgc7_-qkyOTctNpGlYDMIcQyq4KB7QC6X8w/exec?p=admin';
const TEST_EMAIL = 'zzsky88@gmail.com';

test('ERP login and Gutschein smoke test', async ({ page }) => {
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.goto(ERP_URL, { waitUntil: 'domcontentloaded' });
  await page.fill('#loginPw', '1234');
  await page.click('button:has-text("로그인")');

  await page.waitForSelector('#mainWrap', { state: 'visible', timeout: 30000 });
  await page.click('.tab:has-text("굿샤인")');
  await page.waitForSelector('#tab_gutschein.content.active', { timeout: 30000 });

  await page.click('button:has-text("새 굿샤인")');
  await page.waitForSelector('#gutscheinModal.open', { timeout: 10000 });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.selectOption('#g_issueMode', '즉시발행');
  await page.selectOption('#g_voucherType', 'amount');
  await page.fill('#g_amount', '50');
  await page.fill('#g_purchaserName', `Codex Test ${stamp}`);
  await page.fill('#g_purchaserEmail', TEST_EMAIL);
  await page.fill('#g_recipientName', 'Studio mean Test');
  await page.fill('#g_message', `Codex Gutschein smoke test ${stamp}`);
  await page.selectOption('#g_lang', 'de');
  await page.selectOption('#g_paymentMethod', '계좌이체');
  await page.fill('#g_saleChannel', 'codex-smoke');
  await page.check('#g_sendMail');

  await page.click('#g_saveBtn');
  await page.waitForTimeout(8000);

  await expect(page.locator('#gutscheinModal')).not.toHaveClass(/open/, { timeout: 15000 });
  await expect(page.locator('#gutscheinBody')).toContainText(TEST_EMAIL, { timeout: 20000 });
});
