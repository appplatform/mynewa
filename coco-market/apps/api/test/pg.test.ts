import { DEMO_PASSWORD, execute, seedDemo, trialBalance, verifyAuditChain } from '@coco/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { freshDb, testDeps } from './setup';

const conn = await freshDb();
const deps = testDeps();
afterAll(() => conn.pool.end());

describe('PgStore', () => {
  beforeAll(async () => {
    await seedDemo(conn.store, deps);
  });

  it('데모 시드 후 원장이 균형이고 감사 체인이 온전하다', async () => {
    await conn.store.transaction(async (tx) => {
      expect((await trialBalance(tx)).balanced).toBe(true);
      expect((await verifyAuditChain(tx)).ok).toBe(true);
    });
  });

  it('원장과 감사 로그는 DB 트리거로 수정·삭제가 막힌다', async () => {
    await expect(conn.pool.query('UPDATE journal_lines SET credit = credit + 1')).rejects.toThrow(/append-only/);
    await expect(conn.pool.query('DELETE FROM audit_logs')).rejects.toThrow(/append-only/);
  });

  it('RED 기능 키는 feature_flags 테이블에 넣을 수 없다', async () => {
    await expect(conn.pool.query("INSERT INTO feature_flags(id, enabled, updated_at) VALUES ('lu.secondary_market', true, now())")).rejects.toThrow(/check/i);
  });

  it('독점 이용권 동시 구매 시 한 건만 성공한다 (SERIALIZABLE)', async () => {
    const login = async (email: string) => (await execute(conn.store, deps, 'auth.login', { email, password: DEMO_PASSWORD })).token;
    const creator = await login('creator@coco.demo');
    const admin = await login('admin@coco.demo');
    const ip = await execute(conn.store, deps, 'studio.createIp', {
      title: '동시성 테스트 IP', type: 'OTHER', summary: '동시 구매 테스트용 IP 설명입니다.', registrationNo: 'DEMO-X-1',
      evidence: [{ kind: 'OTHER', reference: '테스트 증빙' }], coHolders: [],
    }, { sessionToken: creator });
    const product = await execute(conn.store, deps, 'studio.addProduct', {
      ipId: ip.id, name: '독점 광고권', usages: ['ADVERTISING'], territory: '서울', termMonths: 12, exclusive: true, media: [], priceKrw: 500_000,
    }, { sessionToken: creator });
    await execute(conn.store, deps, 'studio.submitIp', { ipId: ip.id }, { sessionToken: creator });
    await execute(conn.store, deps, 'review.decideIp', { ipId: ip.id, approve: true, note: '' }, { sessionToken: admin });

    const buyers = await Promise.all(['buyer@coco.demo', 'scout@coco.demo', 'shop@coco.demo', 'mapmaker@coco.demo'].map(login));
    const results = await Promise.allSettled(
      buyers.map((t) => execute(conn.store, deps, 'license.checkout', { productId: product.id, agreeTerms: true }, { sessionToken: t })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const grants = await conn.pool.query('SELECT count(*)::int AS n FROM license_grants WHERE product_id = $1', [product.id]);
    expect(grants.rows[0].n).toBe(1);
  });

  it('출금 동시 승인에도 한 번만 지급된다', async () => {
    const login = async (email: string) => (await execute(conn.store, deps, 'auth.login', { email, password: DEMO_PASSWORD })).token;
    const [creator, f1, f2] = await Promise.all(['creator@coco.demo', 'finance1@coco.demo', 'finance2@coco.demo'].map(login));
    const p = await execute(conn.store, deps, 'payouts.request', { amountKrw: 10_000 }, { sessionToken: creator });
    await Promise.allSettled([f1, f2, f1, f2].map((t) => execute(conn.store, deps, 'finance.approvePayout', { payoutId: p.id }, { sessionToken: t })));
    const lines = await conn.pool.query("SELECT count(*)::int AS n FROM journal_entries WHERE idempotency_key = $1", [`payout:${p.id}`]);
    expect(lines.rows[0].n).toBe(1);
    const row = await conn.pool.query('SELECT status, approvals FROM payouts WHERE id = $1', [p.id]);
    expect(row.rows[0].status).toBe('PAID');
    expect(new Set(row.rows[0].approvals).size).toBe(2);
  });
});
