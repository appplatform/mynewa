import type { Deps } from './deps';
import { execute, type OpInput, type OpName, type OpOutput } from './operations';
import type { Store } from './store';
import type { Role } from './types';

// 데모 데이터. 실존 인물·기관·등록번호를 쓰지 않는다(등록번호는 DEMO- 접두사).
export const DEMO_PASSWORD = 'coco-demo-2026';

export const DEMO_USERS = [
  { key: 'admin', email: 'admin@coco.demo', name: '운영 관리자', roles: ['SUPER_ADMIN', 'REVIEWER', 'COMPLIANCE_OFFICER'] as Role[], birth: '1985-03-02', phone: '010-1000-0001' },
  { key: 'finance1', email: 'finance1@coco.demo', name: '재무 담당 1', roles: ['FINANCE'] as Role[], birth: '1988-07-11', phone: '010-1000-0002' },
  { key: 'finance2', email: 'finance2@coco.demo', name: '재무 담당 2', roles: ['FINANCE'] as Role[], birth: '1990-01-21', phone: '010-1000-0003' },
  { key: 'creator', email: 'creator@coco.demo', name: '한빛 작가', roles: [] as Role[], birth: '1979-05-05', phone: '010-2000-0001' },
  { key: 'illustrator', email: 'illust@coco.demo', name: '이음 일러스트', roles: [] as Role[], birth: '1992-09-19', phone: '010-2000-0002' },
  { key: 'mapmaker', email: 'mapmaker@coco.demo', name: '동네지도 스튜디오', roles: [] as Role[], birth: '1987-12-01', phone: '010-2000-0003' },
  { key: 'scout', email: 'scout@coco.demo', name: '청년 서포터 민준', roles: [] as Role[], birth: '2001-04-14', phone: '010-3000-0001' },
  { key: 'shop', email: 'shop@coco.demo', name: '골목 칼국수 사장', roles: [] as Role[], birth: '1968-02-27', phone: '010-4000-0001' },
  { key: 'buyer', email: 'buyer@coco.demo', name: '모퉁이 카페 대표', roles: [] as Role[], birth: '1983-08-08', phone: '010-5000-0001' },
] as const;

export type DemoKey = (typeof DEMO_USERS)[number]['key'];

export async function seedDemo(store: Store, deps: Deps): Promise<Record<DemoKey, string>> {
  const tokens = {} as Record<DemoKey, string>;
  const ids = {} as Record<DemoKey, string>;
  const as = <N extends OpName>(who: DemoKey | null, name: N, input: OpInput<N>): Promise<OpOutput<N>> =>
    execute(store, deps, name, input, { sessionToken: who ? tokens[who] : null });

  for (const u of DEMO_USERS) {
    const r = await as(null, 'auth.register', { email: u.email, password: DEMO_PASSWORD, name: u.name });
    tokens[u.key] = r.token;
    ids[u.key] = r.user.id;
    await as(u.key, 'identity.verify', { name: u.name, birthDate: u.birth, phone: u.phone });
  }
  // 최초 관리자 부트스트랩(이후 역할 변경은 admin.setRoles로만)
  await store.transaction(async (tx) => {
    for (const u of DEMO_USERS) if (u.roles.length) await tx.users.update(ids[u.key], { roles: ['USER', ...u.roles] });
  });

  // ── IP 1: 캐릭터(공동권리자 포함) ──
  const coco = await as('creator', 'studio.createIp', {
    title: '골목 히어로 “코코” 캐릭터',
    type: 'CHARACTER',
    summary: '동네 가게를 지키는 고양이 히어로 캐릭터입니다. 표정 12종, 포즈 20종 원화와 로고타입을 제공합니다. 매장 홍보물, 굿즈, SNS 콘텐츠에 쓸 수 있습니다.',
    registrationNo: 'DEMO-C-2025-0001',
    evidence: [
      { kind: 'REGISTRATION_CERT', reference: '저작권 등록증 사본 (데모)' },
      { kind: 'CO_OWNER_CONSENT', reference: '공동저작자 이용허락 동의서 (데모)' },
    ],
    coHolders: [{ email: 'illust@coco.demo', shareBps: 2_000 }],
  });
  const cocoGoods = await as('creator', 'studio.addProduct', { ipId: coco.id, name: '굿즈 제작 이용권(비독점)', usages: ['MERCHANDISE'], territory: '대한민국', termMonths: 12, exclusive: false, media: ['스티커', '머그컵', '에코백'], priceKrw: 300_000 });
  await as('creator', 'studio.addProduct', { ipId: coco.id, name: '매장 홍보물 이용권(비독점)', usages: ['IN_STORE_DISPLAY', 'DIGITAL_CONTENT'], territory: '대한민국', termMonths: 6, exclusive: false, media: ['포스터', 'SNS'], priceKrw: 50_000 });
  await as('creator', 'studio.addProduct', { ipId: coco.id, name: '지역 광고 독점 이용권', usages: ['ADVERTISING'], territory: '서울특별시', termMonths: 12, exclusive: true, media: ['지역 신문', '옥외 광고'], priceKrw: 1_500_000 });
  await as('illustrator', 'coholder.consent', { ipId: coco.id });
  await as('creator', 'studio.submitIp', { ipId: coco.id });
  await as('admin', 'review.decideIp', { ipId: coco.id, approve: true, note: '증빙 확인 완료' });

  // ── IP 2: 특허 ──
  const patent = await as('creator', 'studio.createIp', {
    title: 'QR 기반 소상공인 광고 성과 측정 방법',
    type: 'PATENT',
    summary: '매장 QR 결제 데이터와 광고 노출 기록을 연결해 광고 성과를 측정하는 방법에 관한 특허입니다. 결제 대행·광고 플랫폼 사업자가 실시권을 받을 수 있습니다.',
    registrationNo: 'DEMO-P-2024-0007',
    evidence: [{ kind: 'REGISTRY_EXTRACT', reference: '특허 등록원부 (데모)' }],
    coHolders: [],
  });
  await as('creator', 'studio.addProduct', { ipId: patent.id, name: '통상실시권 12개월', usages: ['DERIVATIVE_WORK'], territory: '대한민국', termMonths: 12, exclusive: false, media: ['소프트웨어'], priceKrw: 2_000_000 });
  await as('creator', 'studio.submitIp', { ipId: patent.id });
  await as('admin', 'review.decideIp', { ipId: patent.id, approve: true, note: '등록원부 확인' });

  // ── IP 3: 다른 권리자의 저작물 ──
  const map = await as('mapmaker', 'studio.createIp', {
    title: '우리 동네 일러스트 지도 시리즈',
    type: 'COPYRIGHT',
    summary: '서울 골목 상권 24곳을 손그림으로 담은 일러스트 지도입니다. 가게 위치 표시, 상권 안내판, 지역 축제 홍보물에 쓸 수 있습니다.',
    registrationNo: 'DEMO-C-2025-0042',
    evidence: [{ kind: 'REGISTRATION_CERT', reference: '저작권 등록증 사본 (데모)' }],
    coHolders: [],
  });
  const mapDisplay = await as('mapmaker', 'studio.addProduct', { ipId: map.id, name: '상권 안내판·전단 이용권', usages: ['IN_STORE_DISPLAY', 'ADVERTISING'], territory: '서울특별시', termMonths: 12, exclusive: false, media: ['안내판', '전단'], priceKrw: 120_000 });
  await as('mapmaker', 'studio.submitIp', { ipId: map.id });
  await as('admin', 'review.decideIp', { ipId: map.id, approve: true, note: '' });

  // ── IP 4: 심사 대기 ──
  const pending = await as('mapmaker', 'studio.createIp', {
    title: '전통시장 상인 캐리커처 아트워크',
    type: 'COPYRIGHT',
    summary: '전통시장 상인 40명의 동의를 받아 그린 캐리커처 아트워크입니다. 시장 홍보 영상과 포스터에 쓸 수 있습니다.',
    registrationNo: 'DEMO-C-2025-0077',
    evidence: [{ kind: 'OTHER', reference: '초상 이용 동의서 묶음 (데모)' }],
    coHolders: [],
  });
  await as('mapmaker', 'studio.addProduct', { ipId: pending.id, name: '시장 홍보물 이용권', usages: ['ADVERTISING'], territory: '대한민국', termMonths: 6, exclusive: false, media: ['포스터', '영상'], priceKrw: 80_000 });
  await as('mapmaker', 'studio.submitIp', { ipId: pending.id });

  // ── 퀘스트 ──
  const qOnboard = await as('admin', 'quests.create', { title: '골목 가게 입점 돕기', description: '동네 가게가 CO-CO 가맹점으로 입점하도록 안내하고, 가입 절차를 함께 마칩니다. 가게가 입점을 마치면 제출할 수 있습니다.', kind: 'MERCHANT_ONBOARDING', rewardKrw: 30_000, incomeType: 'BUSINESS', minTier: 'CONSUMER', capacity: 500, dailyLimitPerUser: 5 });
  const qAd = await as('admin', 'quests.create', { title: '지역 신문 광고 QR 확인', description: '지정된 지역 신문 광고의 QR이 올바른 가게 페이지로 연결되는지 확인하고 사진과 함께 기록합니다.', kind: 'AD_VERIFICATION', rewardKrw: 3_000, incomeType: 'OTHER', minTier: 'CONSUMER', capacity: 2_000, dailyLimitPerUser: 10 });
  await as('admin', 'quests.create', { title: '가맹점 방문 리뷰 작성', description: '가맹점을 직접 이용하고 영수증 승인번호와 함께 솔직한 리뷰를 남깁니다. 광고성 대가 표시 문구를 포함해야 합니다.', kind: 'REVIEW', rewardKrw: 2_000, incomeType: 'OTHER', minTier: 'CONSUMER', capacity: 3_000, dailyLimitPerUser: 2 });
  await as('admin', 'quests.create', { title: '매장 QR 결제 단말 설치 지원', description: '입점한 가게에 QR 결제 스탠드와 안내 스티커를 설치하고 결제 테스트를 마칩니다.', kind: 'FIELD_SUPPORT', rewardKrw: 20_000, incomeType: 'BUSINESS', minTier: 'TS', capacity: 300, dailyLimitPerUser: 4 });
  await as('admin', 'quests.create', { title: '소상공인 B2B 홍보 컨설팅', description: '가맹점과 1시간 상담으로 IP 활용 홍보 계획서를 함께 작성합니다. 계획서 사본을 제출합니다.', kind: 'CONSULTING', rewardKrw: 50_000, incomeType: 'BUSINESS', minTier: 'CS', capacity: 200, dailyLimitPerUser: 2 });
  await as('admin', 'quests.create', { title: '프랜차이즈 본사 50개 매장 일괄 제휴', description: '프랜차이즈 본사와 50개 매장 일괄 입점 계약을 성사시킵니다. 계약서와 매장 목록을 제출합니다.', kind: 'MERCHANT_ONBOARDING', rewardKrw: 1_000_000, incomeType: 'BUSINESS', minTier: 'RP', capacity: 10, dailyLimitPerUser: 1 });

  // ── 가맹점 입점(서포터 온보딩 코드) ──
  const scoutUser = await as('scout', 'auth.me', {});
  const shop = await as('shop', 'merchant.register', { name: '골목 칼국수', businessNumber: '999-81-00015', region: '서울 마포구', onboardingCode: scoutUser.user!.onboardingCode });
  await as('shop', 'merchant.payMembership', { merchantId: shop.id });

  // ── 서포터 기여 ──
  const c1 = await as('scout', 'quests.submit', { questId: qOnboard.id, merchantId: shop.id, evidence: '골목 칼국수 사장님과 입점 상담 후 가입 절차를 함께 마쳤습니다. 가입비 결제 확인.' });
  await as('admin', 'review.decideContribution', { contributionId: c1.id, approve: true, note: 'PG 결제 확인' });
  for (let i = 1; i <= 3; i++) {
    const c = await as('scout', 'quests.submit', { questId: qAd.id, evidence: `마포 동네신문 ${i}면 광고 QR 연결 확인, 사진 첨부(데모 ${i})` });
    if (i < 3) await as('admin', 'review.decideContribution', { contributionId: c.id, approve: true, note: '' });
  }

  // ── 라이선스 구매 ──
  await as('buyer', 'license.checkout', { productId: cocoGoods.id, agreeTerms: true });
  await as('buyer', 'license.checkout', { productId: mapDisplay.id, agreeTerms: true });

  // ── 앵커링, 출금 ──
  await as('admin', 'anchor.run', {});
  const p = await as('creator', 'payouts.request', { amountKrw: 100_000 });
  await as('finance1', 'finance.approvePayout', { payoutId: p.id });

  return ids;
}
