-- CO-CO Market 초기 스키마
-- 원칙: 금액은 KRW 정수(bigint), 잔액 컬럼 없음(원장에서 계산), 사용자 간 상하 관계 컬럼 없음.

CREATE TABLE users (
  id               text PRIMARY KEY,
  email            text NOT NULL UNIQUE,
  name             text NOT NULL,
  password_hash    text NOT NULL,
  roles            jsonb NOT NULL DEFAULT '["USER"]',
  identity_verified boolean NOT NULL DEFAULT false,
  ci_hash          text UNIQUE,                 -- 본인확인 CI의 해시. 주민등록번호는 저장하지 않는다
  birth_date       date,
  referral_source  text,                        -- 유입 경로(분석용). 보상 계산에 쓰지 않는다
  onboarding_code  text NOT NULL UNIQUE,
  created_at       timestamptz NOT NULL
);

CREATE TABLE sessions (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE ips (
  id              text PRIMARY KEY,
  owner_id        text NOT NULL REFERENCES users(id),
  title           text NOT NULL,
  type            text NOT NULL CHECK (type IN ('PATENT','COPYRIGHT','TRADEMARK','DESIGN','CHARACTER','OTHER')),
  summary         text NOT NULL,
  registration_no text NOT NULL,
  status          text NOT NULL CHECK (status IN ('DRAFT','PENDING_REVIEW','ACTIVE','SUSPENDED','REJECTED')),
  co_holders      jsonb NOT NULL DEFAULT '[]',
  review_note     text,
  created_at      timestamptz NOT NULL,
  activated_at    timestamptz
);
CREATE INDEX ips_owner_idx ON ips(owner_id);
CREATE INDEX ips_status_idx ON ips(status);

CREATE TABLE rights_evidence (
  id         text PRIMARY KEY,
  ip_id      text NOT NULL REFERENCES ips(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  reference  text NOT NULL,
  file_hash  text,
  created_at timestamptz NOT NULL
);
CREATE INDEX evidence_ip_idx ON rights_evidence(ip_id);

CREATE TABLE license_products (
  id               text PRIMARY KEY,
  ip_id            text NOT NULL REFERENCES ips(id),
  name             text NOT NULL,
  scope            jsonb NOT NULL,
  price_krw        bigint NOT NULL CHECK (price_krw > 0),
  platform_fee_bps integer NOT NULL CHECK (platform_fee_bps BETWEEN 0 AND 10000),
  active           boolean NOT NULL,
  created_at       timestamptz NOT NULL
);
CREATE INDEX products_ip_idx ON license_products(ip_id);

CREATE TABLE license_grants (
  id              text PRIMARY KEY,
  product_id      text NOT NULL REFERENCES license_products(id),
  ip_id           text NOT NULL REFERENCES ips(id),
  licensee_id     text NOT NULL REFERENCES users(id),
  price_krw       bigint NOT NULL,
  scope           jsonb NOT NULL,
  terms_version   text NOT NULL,
  contract_text   text NOT NULL,
  signature_hash  text NOT NULL,
  payment_ref     text NOT NULL,
  status          text NOT NULL CHECK (status IN ('ACTIVE','EXPIRED','REVOKED')),
  starts_at       timestamptz NOT NULL,
  ends_at         timestamptz NOT NULL,
  anchor_batch_id text,
  created_at      timestamptz NOT NULL
);
CREATE INDEX grants_ip_idx ON license_grants(ip_id);
CREATE INDEX grants_licensee_idx ON license_grants(licensee_id);

CREATE TABLE quests (
  id                   text PRIMARY KEY,
  title                text NOT NULL,
  description          text NOT NULL,
  kind                 text NOT NULL,
  reward_krw           bigint NOT NULL,
  income_type          text NOT NULL CHECK (income_type IN ('BUSINESS','OTHER')),
  min_tier             text NOT NULL,
  capacity             integer NOT NULL,
  daily_limit_per_user integer NOT NULL,
  status               text NOT NULL CHECK (status IN ('OPEN','CLOSED')),
  created_at           timestamptz NOT NULL
);

CREATE TABLE contributions (
  id              text PRIMARY KEY,
  quest_id        text NOT NULL REFERENCES quests(id),
  user_id         text NOT NULL REFERENCES users(id),
  kind            text NOT NULL,
  evidence        text NOT NULL,
  merchant_id     text,
  status          text NOT NULL CHECK (status IN ('SUBMITTED','VERIFIED','REJECTED')),
  reviewer_id     text REFERENCES users(id),
  review_note     text,
  anchor_batch_id text,
  created_at      timestamptz NOT NULL,
  decided_at      timestamptz,
  CHECK (reviewer_id IS NULL OR reviewer_id <> user_id)
);
CREATE INDEX contributions_user_idx ON contributions(user_id);
CREATE INDEX contributions_quest_idx ON contributions(quest_id, status);

CREATE TABLE rewards (
  id              text PRIMARY KEY,
  contribution_id text NOT NULL UNIQUE REFERENCES contributions(id),
  user_id         text NOT NULL REFERENCES users(id),
  gross_krw       bigint NOT NULL,
  withholding_krw bigint NOT NULL,
  net_krw         bigint NOT NULL,
  income_type     text NOT NULL,
  journal_id      text NOT NULL,
  created_at      timestamptz NOT NULL,
  CHECK (gross_krw = withholding_krw + net_krw)
);

CREATE TABLE merchants (
  id                text PRIMARY KEY,
  name              text NOT NULL,
  business_number   text NOT NULL UNIQUE,
  owner_user_id     text NOT NULL REFERENCES users(id),
  region            text NOT NULL,
  onboarded_by      text REFERENCES users(id),   -- 가맹점-기여자 1단계 연결
  membership_paid   boolean NOT NULL,
  membership_fee_krw bigint NOT NULL,
  created_at        timestamptz NOT NULL,
  CHECK (onboarded_by IS NULL OR onboarded_by <> owner_user_id)
);

CREATE TABLE journal_entries (
  id              text PRIMARY KEY,
  memo            text NOT NULL,
  ref_type        text NOT NULL,
  ref_id          text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL
);

CREATE TABLE journal_lines (
  id         text PRIMARY KEY,
  entry_id   text NOT NULL REFERENCES journal_entries(id),
  account    text NOT NULL,
  debit      bigint NOT NULL CHECK (debit >= 0),
  credit     bigint NOT NULL CHECK (credit >= 0),
  created_at timestamptz NOT NULL,
  CHECK ((debit = 0) <> (credit = 0))
);
CREATE INDEX journal_lines_account_idx ON journal_lines(account);
CREATE INDEX journal_lines_entry_idx ON journal_lines(entry_id);

-- 원장은 수정·삭제할 수 없다. 정정은 반대 분개로만 한다.
CREATE FUNCTION forbid_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger rows are append-only';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER journal_entries_immutable BEFORE UPDATE OR DELETE ON journal_entries FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
CREATE TRIGGER journal_lines_immutable BEFORE UPDATE OR DELETE ON journal_lines FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

CREATE TABLE payouts (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id),
  amount_krw  bigint NOT NULL CHECK (amount_krw > 0),
  status      text NOT NULL CHECK (status IN ('REQUESTED','PAID','REJECTED')),
  approvals   jsonb NOT NULL DEFAULT '[]',
  rejected_by text,
  journal_id  text,
  created_at  timestamptz NOT NULL,
  decided_at  timestamptz
);
CREATE INDEX payouts_user_idx ON payouts(user_id, status);

CREATE TABLE disputes (
  id            text PRIMARY KEY,
  ip_id         text NOT NULL REFERENCES ips(id),
  reporter_id   text NOT NULL REFERENCES users(id),
  reason        text NOT NULL,
  status        text NOT NULL CHECK (status IN ('OPEN','UPHELD','DISMISSED')),
  decision_note text,
  created_at    timestamptz NOT NULL,
  decided_at    timestamptz
);
CREATE INDEX disputes_ip_idx ON disputes(ip_id, status);

-- AMBER 기능만 저장된다. RED 기능은 키 자체가 없다.
CREATE TABLE feature_flags (
  id         text PRIMARY KEY CHECK (id IN ('merchant.onboarding_commission','governance.task_fee','voucher.partner','event.random_reward')),
  enabled    boolean NOT NULL,
  params     jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL,
  updated_by text
);

CREATE TABLE compliance_approvals (
  id               text PRIMARY KEY,
  flag_key         text NOT NULL,
  law_firm         text NOT NULL,
  opinion_doc_hash text NOT NULL CHECK (opinion_doc_hash ~ '^[0-9a-f]{64}$'),
  scope            text NOT NULL,
  expires_at       timestamptz NOT NULL,
  registered_by    text NOT NULL REFERENCES users(id),
  created_at       timestamptz NOT NULL
);

CREATE TABLE audit_logs (
  id         text PRIMARY KEY,
  seq        integer NOT NULL UNIQUE,
  actor_id   text,
  action     text NOT NULL,
  target     text NOT NULL,
  detail     text NOT NULL,
  prev_hash  text NOT NULL,
  hash       text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();

CREATE TABLE anchor_batches (
  id           text PRIMARY KEY,
  merkle_root  text NOT NULL,
  leaf_count   integer NOT NULL,
  chain_tx_ref text NOT NULL,
  created_at   timestamptz NOT NULL
);
