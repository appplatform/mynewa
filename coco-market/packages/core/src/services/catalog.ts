import { z } from 'zod';
import { canonicalJson, merkleProof, merkleRoot, sha256Hex, verifyMerkleProof } from '../crypto';
import { DomainError, assert } from '../errors';
import { audit, op, publicUser, requireUser, zId, type Ctx } from '../op';
import type { Collections } from '../store';
import type { Contribution, LicenseGrant, Role } from '../types';
import { hasOpenDispute, IP_TYPES } from './studio';

function contributionLeaf(c: Contribution) {
  return `contribution:${c.id}:${sha256Hex(canonicalJson({ userId: c.userId, questId: c.questId, evidence: c.evidence, status: c.status, decidedAt: c.decidedAt }))}`;
}
function grantLeaf(g: LicenseGrant) {
  return `grant:${g.id}:${g.signatureHash}`;
}

async function batchLeaves(tx: Collections, batchId: string): Promise<string[]> {
  const grants = await tx.grants.find({ anchorBatchId: batchId });
  const contributions = await tx.contributions.find({ anchorBatchId: batchId });
  return [...grants.map(grantLeaf), ...contributions.map(contributionLeaf)].sort();
}

async function holderName(ctx: Ctx, userId: string) {
  return (await ctx.tx.users.get(userId))?.name ?? '권리자';
}

export const catalogOps = {
  'catalog.listIps': op({
    auth: 'public',
    doc: '판매 중인 IP 목록',
    input: z.object({ q: z.string().max(100).optional(), type: z.enum(IP_TYPES).optional() }).optional(),
    async run(ctx, input) {
      const q = input?.q?.trim().toLowerCase();
      const ips = (await ctx.tx.ips.find({ status: 'ACTIVE' }))
        .filter((ip) => !input?.type || ip.type === input.type)
        .filter((ip) => !q || ip.title.toLowerCase().includes(q) || ip.summary.toLowerCase().includes(q));
      const out = [];
      for (const ip of ips.sort((a, b) => (b.activatedAt ?? '').localeCompare(a.activatedAt ?? ''))) {
        const products = (await ctx.tx.products.find({ ipId: ip.id, active: true })).sort((a, b) => a.priceKrw - b.priceKrw);
        out.push({
          id: ip.id,
          title: ip.title,
          type: ip.type,
          summary: ip.summary,
          holderName: await holderName(ctx, ip.ownerId),
          coHolderCount: ip.coHolders.length,
          fromPriceKrw: products[0]?.priceKrw ?? null,
          productCount: products.length,
          onHold: await hasOpenDispute(ctx, ip.id),
        });
      }
      return out;
    },
  }),

  'catalog.getIp': op({
    auth: 'public',
    doc: 'IP 상세(권리 증빙 요약, 이용권 상품)',
    input: z.object({ ipId: zId }),
    async run(ctx, input) {
      const ip = await ctx.tx.ips.get(input.ipId);
      const canSeeDraft = !!ctx.user && !!ip && (ip.ownerId === ctx.user.id || ctx.user.roles.some((r: Role) => r === 'REVIEWER' || r === 'SUPER_ADMIN'));
      if (!ip || (ip.status !== 'ACTIVE' && ip.status !== 'SUSPENDED' && !canSeeDraft)) throw new DomainError('NOT_FOUND', 'IP를 찾을 수 없습니다.');
      const evidence = await ctx.tx.evidence.find({ ipId: ip.id });
      const products = (await ctx.tx.products.find({ ipId: ip.id })).filter((p) => p.active).sort((a, b) => a.priceKrw - b.priceKrw);
      const now = ctx.now.toISOString();
      const liveExclusive = (await ctx.tx.grants.find({ ipId: ip.id })).filter((g) => g.status === 'ACTIVE' && g.endsAt > now && g.scope.exclusive);
      return {
        ip: { id: ip.id, title: ip.title, type: ip.type, summary: ip.summary, registrationNo: ip.registrationNo, status: ip.status, activatedAt: ip.activatedAt },
        holderName: await holderName(ctx, ip.ownerId),
        coHolders: ip.coHolders.map((c) => ({ shareBps: c.shareBps, consented: c.consented })),
        evidence: evidence.map((e) => ({ kind: e.kind, reference: e.reference, hasFile: !!e.fileHash, createdAt: e.createdAt })),
        products: products.map((p) => ({
          ...p,
          blockedByExclusive: liveExclusive.some((g) => g.scope.usages.some((u) => p.scope.usages.includes(u))),
        })),
        onHold: await hasOpenDispute(ctx, ip.id),
        salesCount: (await ctx.tx.grants.find({ ipId: ip.id })).length,
      };
    },
  }),

  'transparency.stats': op({
    auth: 'public',
    doc: '투명성 대시보드(과거 집계치만)',
    input: z.object({}).optional(),
    async run(ctx) {
      const [ips, grants, contributions, rewards, merchants, disputes, payouts, anchors, lines, quests] = await Promise.all([
        ctx.tx.ips.find(), ctx.tx.grants.find(), ctx.tx.contributions.find(), ctx.tx.rewards.find(), ctx.tx.merchants.find(),
        ctx.tx.disputes.find(), ctx.tx.payouts.find({ status: 'PAID' }), ctx.tx.anchors.find(), ctx.tx.journalLines.find(), ctx.tx.quests.find(),
      ]);
      const entries = await ctx.tx.journal.find({ refType: 'license_grant' });
      const grantEntryIds = new Set(entries.map((e) => e.id));
      const toHolders = lines.filter((l) => grantEntryIds.has(l.entryId) && l.account.startsWith('payable:user:')).reduce((s, l) => s + l.credit, 0);
      const latest = anchors.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
      const active = ips.filter((i) => i.status === 'ACTIVE');
      return {
        asOf: ctx.now.toISOString(),
        ips: { active: active.length, rightsHolders: new Set(active.flatMap((i) => [i.ownerId, ...i.coHolders.map((c) => c.userId ?? c.email)])).size, pendingReview: ips.filter((i) => i.status === 'PENDING_REVIEW').length },
        licenses: { count: grants.length, salesKrw: grants.reduce((s, g) => s + g.priceKrw, 0), toRightsHoldersKrw: toHolders },
        contributions: {
          verified: contributions.filter((c) => c.status === 'VERIFIED').length,
          submitted: contributions.length,
          rewardsGrossKrw: rewards.reduce((s, r) => s + r.grossKrw, 0),
          withholdingKrw: rewards.reduce((s, r) => s + r.withholdingKrw, 0),
          openQuests: quests.filter((q) => q.status === 'OPEN').length,
        },
        merchants: { registered: merchants.length, active: merchants.filter((m) => m.membershipPaid).length },
        disputes: { open: disputes.filter((d) => d.status === 'OPEN').length, upheld: disputes.filter((d) => d.status === 'UPHELD').length, dismissed: disputes.filter((d) => d.status === 'DISMISSED').length },
        payouts: { paidKrw: payouts.reduce((s, p) => s + p.amountKrw, 0), count: payouts.length },
        anchoring: { batches: anchors.length, latest },
      };
    },
  }),

  'review.ipQueue': op({
    auth: 'user',
    roles: ['REVIEWER'],
    doc: 'IP 심사 대기열',
    input: z.object({}).optional(),
    async run(ctx) {
      const list = (await ctx.tx.ips.find({ status: 'PENDING_REVIEW' })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const out = [];
      for (const ip of list) {
        out.push({
          ip,
          holderName: await holderName(ctx, ip.ownerId),
          evidence: await ctx.tx.evidence.find({ ipId: ip.id }),
          products: await ctx.tx.products.find({ ipId: ip.id }),
        });
      }
      return out;
    },
  }),

  'review.decideIp': op({
    auth: 'user',
    roles: ['REVIEWER'],
    doc: 'IP 심사 결정',
    input: z.object({ ipId: zId, approve: z.boolean(), note: z.string().trim().max(1000).default('') }),
    async run(ctx, input) {
      const reviewer = requireUser(ctx);
      const ip = await ctx.tx.ips.get(input.ipId);
      if (!ip) throw new DomainError('NOT_FOUND', 'IP를 찾을 수 없습니다.');
      assert(ip.status === 'PENDING_REVIEW', 'CONFLICT', '심사 대기 상태가 아닙니다.');
      assert(ip.ownerId !== reviewer.id && !ip.coHolders.some((c) => c.userId === reviewer.id), 'FORBIDDEN', '본인이 권리자인 IP는 심사할 수 없습니다.');
      assert(input.approve || input.note.length >= 2, 'BAD_REQUEST', '반려 사유를 적어 주세요.');
      const updated = await ctx.tx.ips.update(ip.id, input.approve
        ? { status: 'ACTIVE', activatedAt: ctx.now.toISOString(), reviewNote: input.note || null }
        : { status: 'REJECTED', reviewNote: input.note });
      await audit(ctx, input.approve ? 'review.approveIp' : 'review.rejectIp', `ip:${ip.id}`);
      return updated;
    },
  }),

  'anchor.run': op({
    auth: 'user',
    roles: ['SUPER_ADMIN'],
    doc: '미앵커링 이용권·검증 기여를 Merkle root로 묶어 체인에 기록',
    input: z.object({}).optional(),
    async run(ctx) {
      const grants = (await ctx.tx.grants.find()).filter((g) => !g.anchorBatchId);
      const contribs = (await ctx.tx.contributions.find({ status: 'VERIFIED' })).filter((c) => !c.anchorBatchId);
      assert(grants.length + contribs.length > 0, 'CONFLICT', '새로 기록할 항목이 없습니다.');
      const leaves = [...grants.map(grantLeaf), ...contribs.map(contributionLeaf)].sort();
      const root = merkleRoot(leaves);
      const { txRef } = await ctx.deps.anchor.anchor(root);
      const batch = { id: ctx.deps.ids(), merkleRoot: root, leafCount: leaves.length, chainTxRef: txRef, createdAt: ctx.now.toISOString() };
      await ctx.tx.anchors.insert(batch);
      for (const g of grants) await ctx.tx.grants.update(g.id, { anchorBatchId: batch.id });
      for (const c of contribs) await ctx.tx.contributions.update(c.id, { anchorBatchId: batch.id });
      await audit(ctx, 'anchor.run', `anchor:${batch.id}`, { root, leafCount: leaves.length });
      return batch;
    },
  }),

  'anchor.verify': op({
    auth: 'public',
    doc: '이용권 또는 기여의 앵커링 증명(Merkle proof) 검증',
    input: z.object({ kind: z.enum(['grant', 'contribution']), id: zId }),
    async run(ctx, input) {
      const doc = input.kind === 'grant' ? await ctx.tx.grants.get(input.id) : await ctx.tx.contributions.get(input.id);
      if (!doc) throw new DomainError('NOT_FOUND', '기록을 찾을 수 없습니다.');
      if (!doc.anchorBatchId) return { anchored: false as const };
      const batch = await ctx.tx.anchors.get(doc.anchorBatchId);
      if (!batch) throw new DomainError('NOT_FOUND', '앵커 배치를 찾을 수 없습니다.');
      const leaves = await batchLeaves(ctx.tx, batch.id);
      const leaf = input.kind === 'grant' ? grantLeaf(doc as LicenseGrant) : contributionLeaf(doc as Contribution);
      const index = leaves.indexOf(leaf);
      if (index < 0) return { anchored: true as const, valid: false, batch, leaf, proof: [] };
      const proof = merkleProof(leaves, index);
      return { anchored: true as const, valid: verifyMerkleProof(leaf, proof, batch.merkleRoot), batch, leaf, proof };
    },
  }),

  'admin.users': op({
    auth: 'user',
    roles: ['SUPER_ADMIN'],
    doc: '회원 목록',
    input: z.object({}).optional(),
    async run(ctx) {
      return (await ctx.tx.users.find()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(publicUser);
    },
  }),

  'admin.setRoles': op({
    auth: 'user',
    roles: ['SUPER_ADMIN'],
    doc: '역할 변경',
    input: z.object({ userId: zId, roles: z.array(z.enum(['USER', 'REVIEWER', 'COMPLIANCE_OFFICER', 'FINANCE', 'SUPER_ADMIN'])).min(1) }),
    async run(ctx, input) {
      const target = await ctx.tx.users.get(input.userId);
      if (!target) throw new DomainError('NOT_FOUND', '회원을 찾을 수 없습니다.');
      const roles = [...new Set<Role>(['USER', ...input.roles])];
      const updated = await ctx.tx.users.update(target.id, { roles });
      await audit(ctx, 'admin.setRoles', `user:${target.id}`, { roles });
      return publicUser(updated);
    },
  }),
};

