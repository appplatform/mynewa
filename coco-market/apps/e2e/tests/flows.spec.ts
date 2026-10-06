import { expect, test, type Page } from '@playwright/test';

// 데모 모드는 브라우저마다 새 localStorage로 시작하므로 테스트마다 시드 데이터가 깨끗하다.

async function loginAs(page: Page, name: string) {
  await page.goto('/#/login');
  const row = page.locator('li', { hasText: name });
  await row.getByRole('button', { name: '이 계정으로 로그인' }).click();
  await expect(page.locator('.user-menu')).toContainText(name);
}

async function openAdminTab(page: Page, tab: RegExp) {
  await page.goto('/#/admin');
  await page.getByRole('tab', { name: tab }).click();
}

test('공개 화면: 홈, IP 목록, 법적 검토 현황', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/#/ips');
  await expect(page.getByText('골목 히어로', { exact: false }).first()).toBeVisible();
  await page.goto('/#/legal/gates');
  await expect(page.getByText('LU 2차 거래 마켓', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('이용권 구매: 동의 전 결제 불가, 결제 후 계약서 발급', async ({ page }) => {
  await loginAs(page, '모퉁이 카페 대표');
  await page.goto('/#/ips');
  await page.getByText('골목 히어로', { exact: false }).first().click();
  const card = page.locator('.card', { hasText: '매장 홍보물 이용권' }).first();
  await card.getByRole('link', { name: '이용권 구매' }).click();
  await expect(page.getByText('살 수 없는 것', { exact: false }).first()).toBeVisible();
  const pay = page.getByRole('button', { name: /결제하기/ });
  await expect(pay).toBeDisabled();
  await page.getByLabel('약관에 동의합니다 (필수)').check();
  await pay.click();
  await page.getByRole('link', { name: '계약서 보기' }).click();
  await expect(page.locator('pre.contract')).toContainText('투자 상품이 아니다');
});

test('기여 퀘스트: 제출 → 운영자 검증 → 원천징수 후 적립', async ({ page }) => {
  await loginAs(page, '청년 서포터 민준');
  await page.goto('/#/quests');
  await page.getByText('지역 신문 광고 QR 확인').first().click();
  await page.getByLabel(/수행 내용과 증빙/).fill('마포 동네신문 5면 광고 QR 연결을 확인했습니다. 사진 첨부');
  await page.getByRole('button', { name: /제출/ }).click();
  await expect(page.getByRole('button', { name: '한 건 더 제출' })).toBeVisible();

  await loginAs(page, '운영 관리자');
  await openAdminTab(page, /기여 검증/);
  const item = page.locator('.card', { hasText: '마포 동네신문 5면' }).first();
  await item.getByRole('button', { name: '승인하고 지급' }).click();
  await expect(page.getByText('2,736원', { exact: false }).first()).toBeVisible();
});

test('출금: 재무 2인 승인 후 지급 완료', async ({ page }) => {
  // 시드에서 한빛 작가의 100,000원 출금이 재무 담당 1의 승인을 이미 받았다.
  await loginAs(page, '재무 담당 1');
  await openAdminTab(page, /출금 승인/);
  const row = page.locator('tr', { hasText: '한빛 작가' }).first();
  await expect(row.getByRole('button', { name: '승인' })).toBeDisabled();

  await loginAs(page, '재무 담당 2');
  await openAdminTab(page, /출금 승인/);
  await page.locator('tr', { hasText: '한빛 작가' }).first().getByRole('button', { name: '승인' }).click();
  await expect(page.getByText('지급 처리했어요', { exact: false })).toBeVisible();
});

test('컴플라이언스: 의견서 없이 AMBER 기능을 켤 수 없고 RED에는 스위치가 없다', async ({ page }) => {
  await loginAs(page, '운영 관리자');
  await openAdminTab(page, /컴플라이언스/);
  await expect(page.getByText('스위치 없음').first()).toBeVisible();
  const sw = page.getByRole('switch').first();
  await sw.click();
  await expect(page.getByText(/법률 의견서가 없어/).first()).toBeVisible();
  await expect(sw).not.toBeChecked();
});

test('투자 암시 문구가 들어간 IP 설명은 등록되지 않는다', async ({ page }) => {
  await loginAs(page, '동네지도 스튜디오');
  await page.goto('/#/studio/new');
  await page.getByLabel(/제목|이름/).first().fill('테스트 IP 등록');
  await page.getByLabel(/설명|소개/).first().fill('매달 고수익을 드리는 특별한 캐릭터입니다.');
  await page.getByLabel(/등록번호/).first().fill('DEMO-E2E-1');
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /다음/ }).click();
  await page.getByRole('button', { name: /등록|저장|만들기/ }).last().click();
  await expect(page.getByText(/쓸 수 없습니다/)).toBeVisible();
});
