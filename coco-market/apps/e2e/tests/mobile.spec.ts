import { expect, test } from '@playwright/test';

const ROUTES = ['/', '/#/ips', '/#/quests', '/#/transparency', '/#/legal/gates', '/#/login', '/#/merchant'];

test('모바일 폭에서 가로 스크롤이 생기지 않는다', async ({ page }) => {
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `${r} 가로 넘침`).toBeLessThanOrEqual(1);
  }
});
