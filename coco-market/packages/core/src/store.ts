import type {
  AnchorBatch, AuditLog, ComplianceApproval, Contribution, Dispute, FeatureFlag, IPAsset, JournalEntry,
  JournalLine, LicenseGrant, LicenseProduct, Merchant, Payout, Quest, Reward, RightsEvidence, Session, User,
} from './types';
import { DomainError } from './errors';

export interface Entity { id: string }

/** 저장소 포트. 필터는 동등 비교만 지원해서 메모리/SQL 구현이 같은 의미를 갖게 한다. */
export interface Collection<T extends Entity> {
  get(id: string): Promise<T | undefined>;
  find(where?: Partial<T>): Promise<T[]>;
  insert(doc: T): Promise<T>;
  update(id: string, patch: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

export interface Collections {
  users: Collection<User>;
  sessions: Collection<Session>;
  ips: Collection<IPAsset>;
  evidence: Collection<RightsEvidence>;
  products: Collection<LicenseProduct>;
  grants: Collection<LicenseGrant>;
  quests: Collection<Quest>;
  contributions: Collection<Contribution>;
  rewards: Collection<Reward>;
  merchants: Collection<Merchant>;
  journal: Collection<JournalEntry>;
  journalLines: Collection<JournalLine>;
  payouts: Collection<Payout>;
  disputes: Collection<Dispute>;
  flags: Collection<FeatureFlag>;
  approvals: Collection<ComplianceApproval>;
  audit: Collection<AuditLog>;
  anchors: Collection<AnchorBatch>;
}

export type CollectionName = keyof Collections;

export interface Store extends Collections {
  /** 모든 쓰기는 트랜잭션 안에서 수행한다. 실패하면 전부 롤백된다. */
  transaction<R>(fn: (tx: Collections) => Promise<R>): Promise<R>;
}

/** 컬렉션별 유니크 제약. 메모리 저장소와 SQL 마이그레이션이 같은 목록을 따른다. */
export const UNIQUE_KEYS: { [K in CollectionName]: string[] } = {
  users: ['email', 'ciHash', 'onboardingCode'],
  sessions: [],
  ips: [],
  evidence: [],
  products: [],
  grants: [],
  quests: [],
  contributions: [],
  rewards: ['contributionId'],
  merchants: ['businessNumber'],
  journal: ['idempotencyKey'],
  journalLines: [],
  payouts: [],
  disputes: [],
  flags: [],
  approvals: [],
  audit: ['seq'],
  anchors: [],
};

export const COLLECTION_NAMES = Object.keys(UNIQUE_KEYS) as CollectionName[];

export function uniqueViolation(collection: string, key: string): DomainError {
  return new DomainError('CONFLICT', `${collection}.${key} 값이 이미 존재합니다.`);
}
