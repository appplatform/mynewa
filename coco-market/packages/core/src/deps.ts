// 외부 연동 포트. 실제 사업자(PG, 본인확인기관, 체인)는 계약 후 어댑터로 교체한다.
// Mock 구현은 adapters/mock.ts 에 있다.

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

export interface PaymentRequest { orderId: string; amountKrw: number; description: string; payerId: string }
export interface PaymentResult { approved: boolean; paymentRef: string; failureReason?: string }

/** PG(결제대행). 실서비스: 토스페이먼츠/포트원 등. 승인 웹훅 서명 검증은 API 계층에서 한다. */
export interface PaymentGateway {
  charge(req: PaymentRequest): Promise<PaymentResult>;
}

export interface IdentityRequest { name: string; birthDate: string; phone: string }
export interface IdentityResult { verified: boolean; ci: string; name: string; birthDate: string }

/** 휴대폰 본인확인(PASS 등). CI 원문은 해시만 저장한다. */
export interface IdentityProvider {
  verify(req: IdentityRequest): Promise<IdentityResult>;
}

/** 증거 계층: Merkle root를 체인에 기록하고 트랜잭션 참조를 돌려준다. */
export interface AnchorClient {
  anchor(merkleRoot: string): Promise<{ txRef: string }>;
}

export interface Deps {
  clock: () => Date;
  ids: () => string;
  hasher: PasswordHasher;
  payments: PaymentGateway;
  identity: IdentityProvider;
  anchor: AnchorClient;
  /** 약관 버전 */
  termsVersion: string;
  /** 가맹점 기본 가입비 */
  membershipFeeKrw: number;
}
