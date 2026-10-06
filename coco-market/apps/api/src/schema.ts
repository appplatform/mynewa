// Drizzle 테이블 정의. migrations/0001_init.sql 과 1:1로 맞춘다.
// JS 키는 core 엔티티 필드명과 같고, DB 컬럼은 snake_case다.
import { bigint, boolean, date, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const money = (name: string) => bigint(name, { mode: 'number' });

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  roles: jsonb('roles').notNull(),
  identityVerified: boolean('identity_verified').notNull(),
  ciHash: text('ci_hash'),
  birthDate: date('birth_date', { mode: 'string' }),
  referralSource: text('referral_source'),
  onboardingCode: text('onboarding_code').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  expiresAt: ts('expires_at').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const ips = pgTable('ips', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  title: text('title').notNull(),
  type: text('type').notNull(),
  summary: text('summary').notNull(),
  registrationNo: text('registration_no').notNull(),
  status: text('status').notNull(),
  coHolders: jsonb('co_holders').notNull(),
  reviewNote: text('review_note'),
  createdAt: ts('created_at').notNull(),
  activatedAt: ts('activated_at'),
});

export const evidence = pgTable('rights_evidence', {
  id: text('id').primaryKey(),
  ipId: text('ip_id').notNull(),
  kind: text('kind').notNull(),
  reference: text('reference').notNull(),
  fileHash: text('file_hash'),
  createdAt: ts('created_at').notNull(),
});

export const products = pgTable('license_products', {
  id: text('id').primaryKey(),
  ipId: text('ip_id').notNull(),
  name: text('name').notNull(),
  scope: jsonb('scope').notNull(),
  priceKrw: money('price_krw').notNull(),
  platformFeeBps: integer('platform_fee_bps').notNull(),
  active: boolean('active').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const grants = pgTable('license_grants', {
  id: text('id').primaryKey(),
  productId: text('product_id').notNull(),
  ipId: text('ip_id').notNull(),
  licenseeId: text('licensee_id').notNull(),
  priceKrw: money('price_krw').notNull(),
  scope: jsonb('scope').notNull(),
  termsVersion: text('terms_version').notNull(),
  contractText: text('contract_text').notNull(),
  signatureHash: text('signature_hash').notNull(),
  paymentRef: text('payment_ref').notNull(),
  status: text('status').notNull(),
  startsAt: ts('starts_at').notNull(),
  endsAt: ts('ends_at').notNull(),
  anchorBatchId: text('anchor_batch_id'),
  createdAt: ts('created_at').notNull(),
});

export const quests = pgTable('quests', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  kind: text('kind').notNull(),
  rewardKrw: money('reward_krw').notNull(),
  incomeType: text('income_type').notNull(),
  minTier: text('min_tier').notNull(),
  capacity: integer('capacity').notNull(),
  dailyLimitPerUser: integer('daily_limit_per_user').notNull(),
  status: text('status').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const contributions = pgTable('contributions', {
  id: text('id').primaryKey(),
  questId: text('quest_id').notNull(),
  userId: text('user_id').notNull(),
  kind: text('kind').notNull(),
  evidence: text('evidence').notNull(),
  merchantId: text('merchant_id'),
  status: text('status').notNull(),
  reviewerId: text('reviewer_id'),
  reviewNote: text('review_note'),
  anchorBatchId: text('anchor_batch_id'),
  createdAt: ts('created_at').notNull(),
  decidedAt: ts('decided_at'),
});

export const rewards = pgTable('rewards', {
  id: text('id').primaryKey(),
  contributionId: text('contribution_id').notNull(),
  userId: text('user_id').notNull(),
  grossKrw: money('gross_krw').notNull(),
  withholdingKrw: money('withholding_krw').notNull(),
  netKrw: money('net_krw').notNull(),
  incomeType: text('income_type').notNull(),
  journalId: text('journal_id').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const merchants = pgTable('merchants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  businessNumber: text('business_number').notNull(),
  ownerUserId: text('owner_user_id').notNull(),
  region: text('region').notNull(),
  onboardedBy: text('onboarded_by'),
  membershipPaid: boolean('membership_paid').notNull(),
  membershipFeeKrw: money('membership_fee_krw').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const journal = pgTable('journal_entries', {
  id: text('id').primaryKey(),
  memo: text('memo').notNull(),
  refType: text('ref_type').notNull(),
  refId: text('ref_id').notNull(),
  idempotencyKey: text('idempotency_key').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const journalLines = pgTable('journal_lines', {
  id: text('id').primaryKey(),
  entryId: text('entry_id').notNull(),
  account: text('account').notNull(),
  debit: money('debit').notNull(),
  credit: money('credit').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const payouts = pgTable('payouts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  amountKrw: money('amount_krw').notNull(),
  status: text('status').notNull(),
  approvals: jsonb('approvals').notNull(),
  rejectedBy: text('rejected_by'),
  journalId: text('journal_id'),
  createdAt: ts('created_at').notNull(),
  decidedAt: ts('decided_at'),
});

export const disputes = pgTable('disputes', {
  id: text('id').primaryKey(),
  ipId: text('ip_id').notNull(),
  reporterId: text('reporter_id').notNull(),
  reason: text('reason').notNull(),
  status: text('status').notNull(),
  decisionNote: text('decision_note'),
  createdAt: ts('created_at').notNull(),
  decidedAt: ts('decided_at'),
});

export const flags = pgTable('feature_flags', {
  id: text('id').primaryKey(),
  enabled: boolean('enabled').notNull(),
  params: jsonb('params').notNull(),
  updatedAt: ts('updated_at').notNull(),
  updatedBy: text('updated_by'),
});

export const approvals = pgTable('compliance_approvals', {
  id: text('id').primaryKey(),
  flagKey: text('flag_key').notNull(),
  lawFirm: text('law_firm').notNull(),
  opinionDocHash: text('opinion_doc_hash').notNull(),
  scope: text('scope').notNull(),
  expiresAt: ts('expires_at').notNull(),
  registeredBy: text('registered_by').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const audit = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  seq: integer('seq').notNull(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  target: text('target').notNull(),
  detail: text('detail').notNull(),
  prevHash: text('prev_hash').notNull(),
  hash: text('hash').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const anchors = pgTable('anchor_batches', {
  id: text('id').primaryKey(),
  merkleRoot: text('merkle_root').notNull(),
  leafCount: integer('leaf_count').notNull(),
  chainTxRef: text('chain_tx_ref').notNull(),
  createdAt: ts('created_at').notNull(),
});

export const tables = {
  users, sessions, ips, evidence, products, grants, quests, contributions, rewards, merchants,
  journal, journalLines, payouts, disputes, flags, approvals, audit, anchors,
};
