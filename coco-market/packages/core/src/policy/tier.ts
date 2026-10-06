import type { Contribution, QuestKind, Tier } from '../types';

// 기여 등급. 입력은 "본인이 직접 수행해 검증된 기여" 목록뿐이다.
// 다른 사용자의 모집·실적·구매는 함수 시그니처상 들어올 수 없다.

export const TIER_ORDER: Tier[] = ['CONSUMER', 'TS', 'CS', 'BS', 'OP', 'RP', 'HP'];

export const TIER_LABEL: Record<Tier, { ko: string; en: string }> = {
  CONSUMER: { ko: '일반 이용자', en: 'Member' },
  TS: { ko: '트라이얼 스카우트', en: 'Trial Scout' },
  CS: { ko: '커뮤니티 서포터', en: 'Community Supporter' },
  BS: { ko: '비즈니스 스페셜리스트', en: 'Business Specialist' },
  OP: { ko: '운영 프로바이더', en: 'Operations Provider' },
  RP: { ko: '지역 개척 파트너', en: 'Regional Pioneer' },
  HP: { ko: '명예 파트너', en: 'Honor Partner' },
};

export interface TierRule {
  tier: Tier;
  minVerified: number;
  minByKind: Partial<Record<QuestKind, number>>;
}

export const TIER_RULES: TierRule[] = [
  { tier: 'TS', minVerified: 3, minByKind: {} },
  { tier: 'CS', minVerified: 10, minByKind: { MERCHANT_ONBOARDING: 3 } },
  { tier: 'BS', minVerified: 20, minByKind: { CONSULTING: 4 } },
  { tier: 'OP', minVerified: 30, minByKind: { FIELD_SUPPORT: 3 } },
  { tier: 'RP', minVerified: 50, minByKind: { MERCHANT_ONBOARDING: 30 } },
  { tier: 'HP', minVerified: 100, minByKind: { MERCHANT_ONBOARDING: 30, AD_VERIFICATION: 20 } },
];

export interface TierProgress {
  tier: Tier;
  verified: number;
  byKind: Record<QuestKind, number>;
  next: { tier: Tier; missing: { label: string; have: number; need: number }[] } | null;
}

const KINDS: QuestKind[] = ['MERCHANT_ONBOARDING', 'AD_VERIFICATION', 'REVIEW', 'FIELD_SUPPORT', 'CONSULTING'];

export const KIND_LABEL: Record<QuestKind, string> = {
  MERCHANT_ONBOARDING: '가맹점 온보딩',
  AD_VERIFICATION: '광고 데이터 검증',
  REVIEW: '리뷰 작성',
  FIELD_SUPPORT: '현장 기술 지원',
  CONSULTING: '소상공인 컨설팅',
};

function meets(rule: TierRule, verified: number, byKind: Record<QuestKind, number>) {
  if (verified < rule.minVerified) return false;
  return Object.entries(rule.minByKind).every(([k, n]) => byKind[k as QuestKind] >= (n ?? 0));
}

export function computeTier(ownContributions: Pick<Contribution, 'status' | 'kind'>[]): TierProgress {
  const verifiedList = ownContributions.filter((c) => c.status === 'VERIFIED');
  const byKind = Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<QuestKind, number>;
  for (const c of verifiedList) byKind[c.kind] += 1;
  const verified = verifiedList.length;

  // 등급은 순서대로만 오른다: 앞 등급 조건을 모두 만족해야 다음 등급을 본다.
  let tier: Tier = 'CONSUMER';
  for (const rule of TIER_RULES) {
    if (!meets(rule, verified, byKind)) break;
    tier = rule.tier;
  }
  const nextRule = TIER_RULES[TIER_ORDER.indexOf(tier)]; // TIER_RULES[0]은 TS
  const next = nextRule
    ? {
        tier: nextRule.tier,
        missing: [
          { label: '검증된 기여', have: verified, need: nextRule.minVerified },
          ...Object.entries(nextRule.minByKind).map(([k, n]) => ({
            label: KIND_LABEL[k as QuestKind],
            have: byKind[k as QuestKind],
            need: n ?? 0,
          })),
        ].filter((m) => m.have < m.need),
      }
    : null;
  return { tier, verified, byKind, next };
}

export function tierAtLeast(tier: Tier, min: Tier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(min);
}
