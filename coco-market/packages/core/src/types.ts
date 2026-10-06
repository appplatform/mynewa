// 도메인 엔티티. 금액은 모두 KRW 정수(원). 날짜는 ISO-8601 문자열.
// 금지: 사용자 간 상하 관계 필드(sponsor/upline/parent 류)와 잔액 컬럼. 잔액은 원장에서만 계산한다.

export type Role = 'USER' | 'REVIEWER' | 'COMPLIANCE_OFFICER' | 'FINANCE' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  roles: Role[];
  identityVerified: boolean;
  /** 본인확인기관이 돌려준 CI의 해시. 주민등록번호는 저장하지 않는다. */
  ciHash: string | null;
  birthDate: string | null;
  /** 마케팅 분석용 유입 경로(1단계 기록). 어떤 보상 계산에도 쓰지 않는다. */
  referralSource: string | null;
  /** 가맹점이 입점 시 입력하는 온보딩 코드. 가맹점-기여자 연결에만 쓴다. */
  onboardingCode: string;
  createdAt: string;
}

export interface Session {
  id: string; // 토큰 자체
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export type IPType = 'PATENT' | 'COPYRIGHT' | 'TRADEMARK' | 'DESIGN' | 'CHARACTER' | 'OTHER';
export type IPStatus = 'DRAFT' | 'PENDING_REVIEW' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface CoHolder {
  email: string;
  userId: string | null;
  /** 정산 지분(basis points, 10000 = 100%) */
  shareBps: number;
  consented: boolean;
  consentedAt: string | null;
}

export interface IPAsset {
  id: string;
  ownerId: string;
  title: string;
  type: IPType;
  summary: string;
  registrationNo: string;
  status: IPStatus;
  /** 대표 권리자 몫 = 10000 - sum(coHolders.shareBps) */
  coHolders: CoHolder[];
  reviewNote: string | null;
  createdAt: string;
  activatedAt: string | null;
}

export type EvidenceKind = 'REGISTRATION_CERT' | 'REGISTRY_EXTRACT' | 'ASSIGNMENT_CONTRACT' | 'CO_OWNER_CONSENT' | 'OTHER';

export interface RightsEvidence {
  id: string;
  ipId: string;
  kind: EvidenceKind;
  reference: string;
  /** 업로드 파일의 SHA-256 (원본은 오브젝트 스토리지) */
  fileHash: string | null;
  createdAt: string;
}

export type Usage = 'MERCHANDISE' | 'ADVERTISING' | 'DERIVATIVE_WORK' | 'IN_STORE_DISPLAY' | 'DIGITAL_CONTENT';

export interface LicenseScope {
  usages: Usage[];
  territory: string;
  termMonths: number;
  exclusive: boolean;
  media: string[];
}

export interface LicenseProduct {
  id: string;
  ipId: string;
  name: string;
  scope: LicenseScope;
  priceKrw: number;
  platformFeeBps: number;
  active: boolean;
  createdAt: string;
}

export type GrantStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface LicenseGrant {
  id: string;
  productId: string;
  ipId: string;
  licenseeId: string;
  priceKrw: number;
  scope: LicenseScope;
  termsVersion: string;
  contractText: string;
  signatureHash: string;
  paymentRef: string;
  status: GrantStatus;
  startsAt: string;
  endsAt: string;
  anchorBatchId: string | null;
  createdAt: string;
}

export type QuestKind = 'MERCHANT_ONBOARDING' | 'AD_VERIFICATION' | 'REVIEW' | 'FIELD_SUPPORT' | 'CONSULTING';
export type Tier = 'CONSUMER' | 'TS' | 'CS' | 'BS' | 'OP' | 'RP' | 'HP';
export type IncomeType = 'BUSINESS' | 'OTHER';

export interface Quest {
  id: string;
  title: string;
  description: string;
  kind: QuestKind;
  rewardKrw: number;
  incomeType: IncomeType;
  minTier: Tier;
  /** 총 승인 가능 건수 */
  capacity: number;
  dailyLimitPerUser: number;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
}

export type ContributionStatus = 'SUBMITTED' | 'VERIFIED' | 'REJECTED';

export interface Contribution {
  id: string;
  questId: string;
  userId: string;
  kind: QuestKind;
  evidence: string;
  merchantId: string | null;
  status: ContributionStatus;
  reviewerId: string | null;
  reviewNote: string | null;
  anchorBatchId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface Reward {
  id: string;
  contributionId: string;
  userId: string;
  grossKrw: number;
  withholdingKrw: number;
  netKrw: number;
  incomeType: IncomeType;
  journalId: string;
  createdAt: string;
}

export interface Merchant {
  id: string;
  name: string;
  businessNumber: string;
  ownerUserId: string;
  region: string;
  /** 이 가맹점을 직접 온보딩한 기여자 1인. 사용자 간 관계가 아니라 가맹점-기여자 1단계 연결이다. */
  onboardedBy: string | null;
  membershipPaid: boolean;
  membershipFeeKrw: number;
  createdAt: string;
}

export interface JournalEntry {
  id: string;
  memo: string;
  refType: string;
  refId: string;
  idempotencyKey: string;
  createdAt: string;
}

export interface JournalLine {
  id: string;
  entryId: string;
  account: string;
  debit: number;
  credit: number;
  createdAt: string;
}

export type PayoutStatus = 'REQUESTED' | 'PAID' | 'REJECTED';

export interface Payout {
  id: string;
  userId: string;
  amountKrw: number;
  status: PayoutStatus;
  approvals: string[];
  rejectedBy: string | null;
  journalId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface Dispute {
  id: string;
  ipId: string;
  reporterId: string;
  reason: string;
  status: 'OPEN' | 'UPHELD' | 'DISMISSED';
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface FeatureFlag {
  id: string; // = flag key
  enabled: boolean;
  /** 기능별 파라미터(예: 영업대행 수수료율 bps) */
  params: Record<string, number>;
  updatedAt: string;
  updatedBy: string | null;
}

export interface ComplianceApproval {
  id: string;
  flagKey: string;
  lawFirm: string;
  opinionDocHash: string;
  scope: string;
  expiresAt: string;
  registeredBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  seq: number;
  actorId: string | null;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
  createdAt: string;
}

export interface AnchorBatch {
  id: string;
  merkleRoot: string;
  leafCount: number;
  chainTxRef: string;
  createdAt: string;
}
