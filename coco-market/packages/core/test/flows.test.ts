import { describe, expect, it } from 'vitest';
import { Accounts, MemoryStore, seedDemo, trialBalance, verifyAuditChain } from '../src';
import { activeIp, makeApp, makeDeps } from './helpers';

const expectCode = async (p: Promise<unknown>, code: string) => {
  await expect(p).rejects.toMatchObject({ code });
};

describe('인증·본인확인', () => {
  it('1인 1계정: 같은 CI로 두 번째 계정 본인확인은 거절', async () => {
    const app = makeApp();
    await app.user('a', { verify: false });
    await app.user('b', { verify: false });
    await app.call('a', 'identity.verify', { name: '홍길동', birthDate: '1990-01-01', phone: '010-1111-2222' });
    await expectCode(app.call('b', 'identity.verify', { name: '홍길동', birthDate: '1990-01-01', phone: '010-1111-2222' }), 'CONFLICT');
  });

  it('만 14세 미만은 본인확인 불가, 만 19세 미만은 구매 불가', async () => {
    const app = makeApp();
    await app.user('kid', { verify: false });
    await expectCode(app.call('kid', 'identity.verify', { name: 'kid', birthDate: '2015-01-01', phone: '010-9999-0001' }), 'AGE_RESTRICTED');
    await app.user('teen', { birth: '2010-03-01' });
    await app.user('owner');
    await app.user('rev');
    await app.grantRoles('rev', ['REVIEWER']);
    const { product, activate } = await activeIp(app, 'owner', 'rev');
    await activate();
    await expectCode(app.call('teen', 'license.checkout', { productId: product.id, agreeTerms: true }), 'AGE_RESTRICTED');
  });

  it('잘못된 비밀번호는 로그인 실패', async () => {
    const app = makeApp();
    await app.user('a');
    await expectCode(app.call(null, 'auth.login', { email: 'a@t.test', password: 'wrong-password' }), 'UNAUTHENTICATED');
  });
});

describe('IP 등록·심사', () => {
  it('공동권리자 동의 전에는 심사 요청 불가', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.user('co');
    await app.user('rev');
    await app.grantRoles('rev', ['REVIEWER']);
    const { ip, activate } = await activeIp(app, 'owner', 'rev', { coHolders: [{ email: 'co@t.test', shareBps: 3000 }] });
    await expectCode(activate(), 'BAD_REQUEST');
    await app.call('co', 'coholder.consent', { ipId: ip.id });
    await activate();
    const detail = await app.call(null, 'catalog.getIp', { ipId: ip.id });
    expect(detail.ip.status).toBe('ACTIVE');
  });

  it('투자·수익 암시 문구는 IP 설명에 쓸 수 없다', async () => {
    const app = makeApp();
    await app.user('owner');
    await expectCode(
      app.call('owner', 'studio.createIp', { title: '좋은 IP', type: 'OTHER', summary: '매달 고수익 배당을 드립니다. 원금 걱정 없이', registrationNo: 'DEMO-1', evidence: [], coHolders: [] }),
      'COMPLIANCE_BLOCKED',
    );
  });

  it('본인 IP는 심사할 수 없다', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.grantRoles('owner', ['REVIEWER']);
    const { ip } = await activeIp(app, 'owner', 'owner');
    await app.call('owner', 'studio.submitIp', { ipId: ip.id });
    await expectCode(app.call('owner', 'review.decideIp', { ipId: ip.id, approve: true, note: '' }), 'FORBIDDEN');
  });
});

describe('라이선스 구매·정산', () => {
  it('결제 대금이 플랫폼 수수료와 권리자 지분대로 정확히 나뉜다', async () => {
    const app = makeApp();
    const ownerId = await app.user('owner');
    const coId = await app.user('co');
    await app.user('rev');
    await app.user('buyer');
    await app.grantRoles('rev', ['REVIEWER']);
    const { ip, product, activate } = await activeIp(app, 'owner', 'rev', { coHolders: [{ email: 'co@t.test', shareBps: 2500 }], price: 100_003 });
    await app.call('co', 'coholder.consent', { ipId: ip.id });
    await activate();
    await app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true });

    await app.store.transaction(async (tx) => {
      const tb = await trialBalance(tx);
      expect(tb.balanced).toBe(true);
      const bal = (a: string) => tb.rows.find((r) => r.account === a)?.balance ?? 0;
      expect(bal(Accounts.pgClearing)).toBe(100_003);
      expect(bal(Accounts.platformRevenue)).toBe(10_000);
      // 90,003원 중 25% = 22,500원(절사), 나머지 67,503원은 대표 권리자
      expect(bal(Accounts.userPayable(coId))).toBe(22_500);
      expect(bal(Accounts.userPayable(ownerId))).toBe(67_503);
    });
  });

  it('이용권 계약서는 양도 불가·투자 아님을 명시하고, 서명 해시를 남긴다', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.user('rev');
    await app.user('buyer');
    await app.grantRoles('rev', ['REVIEWER']);
    const { product, activate } = await activeIp(app, 'owner', 'rev');
    await activate();
    const g = await app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true });
    expect(g.contractText).toContain('양도·재판매');
    expect(g.contractText).toContain('투자 상품이 아니다');
    expect(g.signatureHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('독점 이용권이 유효하면 같은 용도 이용권은 더 팔 수 없다', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.user('rev');
    await app.user('b1');
    await app.user('b2');
    await app.grantRoles('rev', ['REVIEWER']);
    const { product, activate } = await activeIp(app, 'owner', 'rev', { exclusive: true });
    await activate();
    await app.call('b1', 'license.checkout', { productId: product.id, agreeTerms: true });
    await expectCode(app.call('b2', 'license.checkout', { productId: product.id, agreeTerms: true }), 'CONFLICT');
  });

  it('결제 실패 시 아무것도 기록되지 않는다(트랜잭션 롤백)', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.user('rev');
    await app.user('buyer');
    await app.grantRoles('rev', ['REVIEWER']);
    const { product, activate } = await activeIp(app, 'owner', 'rev', { price: 100_007 });
    await activate();
    await expectCode(app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true }), 'BAD_REQUEST');
    expect(await app.store.grants.find()).toHaveLength(0);
    expect(await app.store.journal.find()).toHaveLength(0);
  });

  it('분쟁이 접수되면 판매와 권리자 출금이 보류된다', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.user('rev');
    await app.user('buyer');
    await app.user('reporter');
    await app.grantRoles('rev', ['REVIEWER', 'COMPLIANCE_OFFICER']);
    const { ip, product, activate } = await activeIp(app, 'owner', 'rev');
    await activate();
    await app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true });
    const d = await app.call('reporter', 'disputes.report', { ipId: ip.id, reason: '제가 먼저 창작한 캐릭터와 동일합니다.' });
    await expectCode(app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true }), 'ON_HOLD');
    await expectCode(app.call('owner', 'payouts.request', { amountKrw: 10_000 }), 'ON_HOLD');
    await app.call('rev', 'disputes.decide', { disputeId: d.id, uphold: false, note: '증빙 부족' });
    await app.call('owner', 'payouts.request', { amountKrw: 10_000 });
  });
});

describe('퀘스트·기여 등급', () => {
  async function setup() {
    const app = makeApp();
    await app.user('admin');
    await app.user('scout');
    await app.grantRoles('admin', ['SUPER_ADMIN']);
    const q = await app.call('admin', 'quests.create', { title: '광고 QR 확인', description: '광고 QR 연결을 확인합니다.', kind: 'AD_VERIFICATION', rewardKrw: 3_000, incomeType: 'OTHER', minTier: 'CONSUMER', capacity: 100, dailyLimitPerUser: 50 });
    return { app, q };
  }

  it('승인 시 원천징수 후 금액이 적립된다 (기타소득 8.8%)', async () => {
    const { app, q } = await setup();
    const c = await app.call('scout', 'quests.submit', { questId: q.id, evidence: '신문 3면 광고 QR 연결 확인' });
    const r = await app.call('admin', 'review.decideContribution', { contributionId: c.id, approve: true, note: '' });
    expect(r.reward).toMatchObject({ grossKrw: 3_000, withholdingKrw: 264, netKrw: 2_736 });
    const w = await app.call('scout', 'wallet.summary', {});
    expect(w.payableKrw).toBe(2_736);
  });

  it('본인 기여는 본인이 검증할 수 없다', async () => {
    const { app, q } = await setup();
    await app.grantRoles('scout', ['REVIEWER']);
    const c = await app.call('scout', 'quests.submit', { questId: q.id, evidence: '신문 3면 광고 QR 연결 확인' });
    await expectCode(app.call('scout', 'review.decideContribution', { contributionId: c.id, approve: true, note: '' }), 'FORBIDDEN');
  });

  it('등급은 본인 검증 기여로만 오른다', async () => {
    const { app, q } = await setup();
    for (let i = 0; i < 3; i++) {
      const c = await app.call('scout', 'quests.submit', { questId: q.id, evidence: `확인 기록 번호 ${i}` });
      await app.call('admin', 'review.decideContribution', { contributionId: c.id, approve: true, note: '' });
    }
    const mine = await app.call('scout', 'quests.mine', {});
    expect(mine.progress.tier).toBe('TS');
  });

  it('하루 제출 한도를 넘으면 거절', async () => {
    const { app } = await setup();
    const q = await app.call('admin', 'quests.create', { title: '리뷰', description: '가맹점 리뷰를 작성합니다.', kind: 'REVIEW', rewardKrw: 2_000, incomeType: 'OTHER', minTier: 'CONSUMER', capacity: 100, dailyLimitPerUser: 1 });
    await app.call('scout', 'quests.submit', { questId: q.id, evidence: '첫 번째 리뷰 작성' });
    await expectCode(app.call('scout', 'quests.submit', { questId: q.id, evidence: '두 번째 리뷰 작성' }), 'LIMIT_EXCEEDED');
    app.advance(24 * 3_600_000);
    await app.call('scout', 'quests.submit', { questId: q.id, evidence: '다음 날 리뷰 작성' });
  });

  it('온보딩 퀘스트는 본인이 온보딩하고 입점을 마친 가맹점만 제출할 수 있다', async () => {
    const { app } = await setup();
    await app.user('shop');
    await app.user('other');
    const q = await app.call('admin', 'quests.create', { title: '입점 돕기', description: '가맹점 입점을 돕습니다.', kind: 'MERCHANT_ONBOARDING', rewardKrw: 30_000, incomeType: 'BUSINESS', minTier: 'CONSUMER', capacity: 10, dailyLimitPerUser: 5 });
    const me = await app.call('scout', 'auth.me', {});
    const m = await app.call('shop', 'merchant.register', { name: '테스트 식당', businessNumber: '999-81-00029', region: '서울', onboardingCode: me.user!.onboardingCode });
    await expectCode(app.call('scout', 'quests.submit', { questId: q.id, merchantId: m.id, evidence: '입점 상담 완료했습니다' }), 'BAD_REQUEST');
    await app.call('shop', 'merchant.payMembership', { merchantId: m.id });
    await expectCode(app.call('other', 'quests.submit', { questId: q.id, merchantId: m.id, evidence: '입점 상담 완료했습니다' }), 'FORBIDDEN');
    await app.call('scout', 'quests.submit', { questId: q.id, merchantId: m.id, evidence: '입점 상담 완료했습니다' });
    await expectCode(app.call('scout', 'quests.submit', { questId: q.id, merchantId: m.id, evidence: '같은 가맹점 재제출' }), 'CONFLICT');
  });
});

describe('Legal Gate: AMBER/RED 기능', () => {
  async function setup() {
    const app = makeApp();
    await app.user('officer');
    await app.user('scout');
    await app.user('shop');
    await app.grantRoles('officer', ['COMPLIANCE_OFFICER']);
    const me = await app.call('scout', 'auth.me', {});
    const m = await app.call('shop', 'merchant.register', { name: '테스트 식당', businessNumber: '999-81-00034', region: '서울', onboardingCode: me.user!.onboardingCode });
    return { app, m };
  }
  const HASH = 'a'.repeat(64);

  it('RED 기능은 켤 수 없다', async () => {
    const { app } = await setup();
    await expectCode(app.call('officer', 'compliance.setFlag', { key: 'lu.secondary_market', enabled: true }), 'RED_FEATURE_FORBIDDEN');
    await expectCode(app.call('officer', 'compliance.registerApproval', { flagKey: 'ipu.royalty_share', lawFirm: '테스트 법무법인', opinionDocHash: HASH, scope: '수익 분배 검토', expiresAt: '2027-12-31T00:00:00.000Z' }), 'RED_FEATURE_FORBIDDEN');
  });

  it('AMBER 기능은 유효한 의견서 없이 켤 수 없고, 꺼져 있으면 수수료가 나가지 않는다', async () => {
    const { app, m } = await setup();
    await expectCode(app.call('officer', 'compliance.setFlag', { key: 'merchant.onboarding_commission', enabled: true }), 'COMPLIANCE_BLOCKED');
    const r = await app.call('shop', 'merchant.payMembership', { merchantId: m.id });
    expect(r.commissionKrw).toBe(0);
  });

  it('의견서 등록 후 켜면 온보딩 수행자 1인에게만 수수료(사업소득 3.3% 원천징수)', async () => {
    const { app, m } = await setup();
    await app.call('officer', 'compliance.registerApproval', { flagKey: 'merchant.onboarding_commission', lawFirm: '테스트 법무법인', opinionDocHash: HASH, scope: '온보딩 수행자 1인 영업대행 수수료', expiresAt: '2027-12-31T00:00:00.000Z' });
    await app.call('officer', 'compliance.setFlag', { key: 'merchant.onboarding_commission', enabled: true, params: { commissionBps: 3000 } });
    const r = await app.call('shop', 'merchant.payMembership', { merchantId: m.id });
    expect(r.commissionKrw).toBe(60_000);
    const w = await app.call('scout', 'wallet.summary', {});
    expect(w.payableKrw).toBe(60_000 - 1_980);
  });

  it('의견서가 만료되면 flag가 켜져 있어도 동작하지 않는다', async () => {
    const { app, m } = await setup();
    await app.call('officer', 'compliance.registerApproval', { flagKey: 'merchant.onboarding_commission', lawFirm: '테스트 법무법인', opinionDocHash: HASH, scope: '온보딩 수행자 1인 영업대행 수수료', expiresAt: '2026-10-07T00:00:00.000Z' });
    await app.call('officer', 'compliance.setFlag', { key: 'merchant.onboarding_commission', enabled: true, params: { commissionBps: 3000 } });
    app.advance(2 * 24 * 3_600_000);
    const r = await app.call('shop', 'merchant.payMembership', { merchantId: m.id });
    expect(r.commissionKrw).toBe(0);
  });
});

describe('출금·감사·앵커링', () => {
  it('출금은 서로 다른 재무 담당 2인이 승인해야 지급된다', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.user('rev');
    await app.user('buyer');
    await app.user('f1');
    await app.user('f2');
    await app.grantRoles('rev', ['REVIEWER']);
    await app.grantRoles('f1', ['FINANCE']);
    await app.grantRoles('f2', ['FINANCE']);
    const { product, activate } = await activeIp(app, 'owner', 'rev');
    await activate();
    await app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true });
    await expectCode(app.call('owner', 'payouts.request', { amountKrw: 90_001 }), 'INSUFFICIENT_FUNDS');
    const p = await app.call('owner', 'payouts.request', { amountKrw: 50_000 });
    const a1 = await app.call('f1', 'finance.approvePayout', { payoutId: p.id });
    expect(a1.status).toBe('REQUESTED');
    await expectCode(app.call('f1', 'finance.approvePayout', { payoutId: p.id }), 'CONFLICT');
    const a2 = await app.call('f2', 'finance.approvePayout', { payoutId: p.id });
    expect(a2.status).toBe('PAID');
    const w = await app.call('owner', 'wallet.summary', {});
    expect(w.payableKrw).toBe(40_000);
  });

  it('데모 시드 전체 실행 후 원장이 균형이고 감사 로그 체인이 온전하다', async () => {
    const store = new MemoryStore();
    const { deps } = makeDeps();
    await seedDemo(store, deps);
    await store.transaction(async (tx) => {
      expect((await trialBalance(tx)).balanced).toBe(true);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it('감사 로그를 고치면 체인 검증이 실패한다', async () => {
    const store = new MemoryStore();
    const { deps } = makeDeps();
    await seedDemo(store, deps);
    const rows = (await store.audit.find()).sort((a, b) => a.seq - b.seq);
    await store.transaction(async (tx) => {
      await tx.audit.update(rows[5]!.id, { detail: '{"tampered":true}' });
    });
    await store.transaction(async (tx) => {
      const r = await verifyAuditChain(tx);
      expect(r.ok).toBe(false);
      expect(r.brokenAt).toBe(rows[5]!.seq);
    });
  });

  it('앵커링된 이용권은 Merkle 증명으로 검증된다', async () => {
    const app = makeApp();
    await app.user('owner');
    await app.user('rev');
    await app.user('buyer');
    await app.grantRoles('rev', ['REVIEWER', 'SUPER_ADMIN']);
    const { product, activate } = await activeIp(app, 'owner', 'rev');
    await activate();
    const g1 = await app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true });
    const g2 = await app.call('buyer', 'license.checkout', { productId: product.id, agreeTerms: true });
    await app.call('rev', 'anchor.run', {});
    for (const g of [g1, g2]) {
      const v = await app.call(null, 'anchor.verify', { kind: 'grant', id: g.id });
      expect(v.anchored && v.valid).toBe(true);
    }
  });
});
