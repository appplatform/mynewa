// Legal Gate Matrix (메타 프롬프트 §2.1). 기능의 법적 위험 등급과 Feature Flag 키의 단일 출처.
// RED 기능에는 flag 키가 없다. 키가 없으니 켤 방법도 없다.

export type GateLevel = 'GREEN' | 'AMBER' | 'RED';

export interface GateEntry {
  no: number;
  feature: string;
  level: GateLevel;
  /** AMBER 기능만 가진다. GREEN은 항상 켜져 있고, RED는 존재하지 않는다. */
  flagKey?: AmberFlagKey;
  reason: string;
  alternative: string;
  /** 기본 파라미터 (AMBER 기능용) */
  defaultParams?: Record<string, number>;
}

export const AMBER_FLAG_KEYS = [
  'merchant.onboarding_commission',
  'governance.task_fee',
  'voucher.partner',
  'event.random_reward',
] as const;

export type AmberFlagKey = (typeof AMBER_FLAG_KEYS)[number];

export const GATES: GateEntry[] = [
  { no: 1, feature: 'IP 등록·권리 증빙·심사', level: 'GREEN', reason: '일반 플랫폼 기능', alternative: '—' },
  { no: 2, feature: 'IP 이용권(라이선스) 판매', level: 'GREEN', reason: '실제 사용권 매매. 통신판매중개자 고지 필요', alternative: '—' },
  { no: 3, feature: '퀘스트/바운티 용역 대가 지급(KRW)', level: 'GREEN', reason: '본인 용역의 대가. 원천징수 처리', alternative: '—' },
  { no: 4, feature: '기여 등급 TS~HP (본인 실적만)', level: 'GREEN', reason: '하위 모집·하위 매출과 무관', alternative: '—' },
  {
    no: 5, feature: '가맹점 가입비 중 영업대행 수수료', level: 'AMBER', flagKey: 'merchant.onboarding_commission',
    reason: '직접 온보딩한 본인 1인에게만 지급해야 하며, 라인 배분은 계층 수당으로 볼 여지', alternative: '온보딩 수행자 + 본사 2자 분배',
    defaultParams: { commissionBps: 0 },
  },
  {
    no: 6, feature: 'HP/RP 거버넌스 자문료·검증 수수료', level: 'AMBER', flagKey: 'governance.task_fee',
    reason: '업무 산출물 없이 등급만으로 지급하면 위험', alternative: '업무 단위 계약 + 산출물 연결',
  },
  {
    no: 7, feature: '다수 가맹점용 결제 바우처', level: 'AMBER', flagKey: 'voucher.partner',
    reason: '전자금융거래법상 선불전자지급수단 해당 가능성', alternative: '등록 선불/PG 사업자 제휴',
  },
  {
    no: 8, feature: '랜덤 보상 이벤트', level: 'AMBER', flagKey: 'event.random_reward',
    reason: '우연에 따른 재산상 이익은 사행성 문제', alternative: '무작위성 없는 참여 보상',
  },
  { no: 9, feature: 'LU 2차 거래 마켓(회전 1~4회)', level: 'RED', reason: '가상자산 또는 증권 해당 가능성', alternative: '양도 불가 이용권' },
  { no: 10, feature: '1+2 증정(Tri-Split) + 고정가 30,000원', level: 'RED', reason: '신규 매수 자금으로 기존 보유자 회수를 충당', alternative: '폐기' },
  { no: 11, feature: 'IPU 영구 저작료 분배·Co-DAO 배당', level: 'RED', reason: '투자계약증권 요건에 근접', alternative: '정식 인가 경로(Phase 4)' },
  { no: 12, feature: '미래 수익률 시뮬레이션 공개', level: 'RED', reason: '확정·고수익 암시 표시', alternative: '과거 집계치만 공개' },
  { no: 13, feature: '에스크로 가치 보증 표현', level: 'RED', reason: '예치금을 지켜 준다는 약정으로 해석될 수 있음', alternative: '예치 현황 사실 공개' },
  { no: 14, feature: '미션 대행(Bounty Delegation)', level: 'RED', reason: '본인 활동 요건 형해화', alternative: '폐기' },
  { no: 15, feature: '구매 승급·하위 양성 승급·오버라이딩', level: 'RED', reason: '방문판매법상 다단계 요건', alternative: '폐기' },
];

export function gateForFlag(key: string): GateEntry | undefined {
  return GATES.find((g) => g.flagKey === key);
}

export function isAmberFlagKey(key: string): key is AmberFlagKey {
  return (AMBER_FLAG_KEYS as readonly string[]).includes(key);
}
