import { z } from 'zod';
import { DomainError, assert } from '../errors';
import { audit, op, requireAdult, requireUser, zId, zKrw, type Ctx } from '../op';
import { findBannedTerms } from '../policy/copy';
import type { CoHolder, IPAsset, LicenseProduct, RightsEvidence } from '../types';

export const IP_TYPES = ['PATENT', 'COPYRIGHT', 'TRADEMARK', 'DESIGN', 'CHARACTER', 'OTHER'] as const;
export const USAGES = ['MERCHANDISE', 'ADVERTISING', 'DERIVATIVE_WORK', 'IN_STORE_DISPLAY', 'DIGITAL_CONTENT'] as const;
export const EVIDENCE_KINDS = ['REGISTRATION_CERT', 'REGISTRY_EXTRACT', 'ASSIGNMENT_CONTRACT', 'CO_OWNER_CONSENT', 'OTHER'] as const;

export const DEFAULT_PLATFORM_FEE_BPS = 1_000; // 10%

export function assertCleanCopy(...texts: string[]) {
  for (const t of texts) {
    const v = findBannedTerms(t);
    if (v.length) {
      throw new DomainError(
        'COMPLIANCE_BLOCKED',
        `투자·수익을 암시하는 표현은 쓸 수 없습니다: "${v.map((x) => x.term).join('", "')}"`,
      );
    }
  }
}

export async function loadOwnedIp(ctx: Ctx, ipId: string): Promise<IPAsset> {
  const user = requireUser(ctx);
  const ip = await ctx.tx.ips.get(ipId);
  if (!ip) throw new DomainError('NOT_FOUND', 'IP를 찾을 수 없습니다.');
  if (ip.ownerId !== user.id) throw new DomainError('FORBIDDEN', '대표 권리자만 수정할 수 있습니다.');
  return ip;
}

export function ownerShareBps(ip: Pick<IPAsset, 'coHolders'>): number {
  return 10_000 - ip.coHolders.reduce((s, c) => s + c.shareBps, 0);
}

export async function hasOpenDispute(ctx: Ctx, ipId: string): Promise<boolean> {
  return (await ctx.tx.disputes.find({ ipId, status: 'OPEN' })).length > 0;
}

export const studioOps = {
  'studio.createIp': op({
    auth: 'verified',
    doc: 'IP 초안 등록(증빙·공동권리자 포함)',
    input: z.object({
      title: z.string().trim().min(2).max(120),
      type: z.enum(IP_TYPES),
      summary: z.string().trim().min(10).max(2000),
      registrationNo: z.string().trim().min(3).max(60),
      evidence: z
        .array(z.object({ kind: z.enum(EVIDENCE_KINDS), reference: z.string().trim().min(2).max(300), fileHash: z.string().regex(/^[0-9a-f]{64}$/).optional() }))
        .max(20)
        .default([]),
      coHolders: z.array(z.object({ email: z.string().email().transform((s) => s.toLowerCase()), shareBps: z.number().int().min(1).max(9_999) })).max(10).default([]),
    }),
    async run(ctx, input) {
      const user = requireAdult(ctx);
      assertCleanCopy(input.title, input.summary);
      const total = input.coHolders.reduce((s, c) => s + c.shareBps, 0);
      assert(total < 10_000, 'BAD_REQUEST', '공동권리자 지분 합계는 100% 미만이어야 합니다.');
      assert(!input.coHolders.some((c) => c.email === user.email), 'BAD_REQUEST', '본인을 공동권리자로 넣을 수 없습니다.');
      assert(new Set(input.coHolders.map((c) => c.email)).size === input.coHolders.length, 'BAD_REQUEST', '공동권리자 이메일이 중복됩니다.');

      const coHolders: CoHolder[] = [];
      for (const c of input.coHolders) {
        const [u] = await ctx.tx.users.find({ email: c.email });
        coHolders.push({ email: c.email, userId: u?.id ?? null, shareBps: c.shareBps, consented: false, consentedAt: null });
      }
      const ip: IPAsset = {
        id: ctx.deps.ids(),
        ownerId: user.id,
        title: input.title,
        type: input.type,
        summary: input.summary,
        registrationNo: input.registrationNo,
        status: 'DRAFT',
        coHolders,
        reviewNote: null,
        createdAt: ctx.now.toISOString(),
        activatedAt: null,
      };
      await ctx.tx.ips.insert(ip);
      for (const e of input.evidence) {
        const ev: RightsEvidence = { id: ctx.deps.ids(), ipId: ip.id, kind: e.kind, reference: e.reference, fileHash: e.fileHash ?? null, createdAt: ctx.now.toISOString() };
        await ctx.tx.evidence.insert(ev);
      }
      await audit(ctx, 'studio.createIp', `ip:${ip.id}`, { title: ip.title });
      return ip;
    },
  }),

  'studio.addEvidence': op({
    auth: 'verified',
    doc: '권리 증빙 추가',
    input: z.object({ ipId: zId, kind: z.enum(EVIDENCE_KINDS), reference: z.string().trim().min(2).max(300), fileHash: z.string().regex(/^[0-9a-f]{64}$/).optional() }),
    async run(ctx, input) {
      const ip = await loadOwnedIp(ctx, input.ipId);
      assert(ip.status === 'DRAFT' || ip.status === 'REJECTED', 'CONFLICT', '초안 상태에서만 증빙을 추가할 수 있습니다.');
      const ev: RightsEvidence = { id: ctx.deps.ids(), ipId: ip.id, kind: input.kind, reference: input.reference, fileHash: input.fileHash ?? null, createdAt: ctx.now.toISOString() };
      await ctx.tx.evidence.insert(ev);
      return ev;
    },
  }),

  'studio.addProduct': op({
    auth: 'verified',
    doc: '라이선스 상품 추가',
    input: z.object({
      ipId: zId,
      name: z.string().trim().min(2).max(120),
      usages: z.array(z.enum(USAGES)).min(1),
      territory: z.string().trim().min(2).max(60),
      termMonths: z.number().int().min(1).max(120),
      exclusive: z.boolean(),
      media: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
      priceKrw: zKrw.min(1_000),
    }),
    async run(ctx, input) {
      const ip = await loadOwnedIp(ctx, input.ipId);
      assert(ip.status !== 'SUSPENDED', 'CONFLICT', '정지된 IP에는 상품을 추가할 수 없습니다.');
      assertCleanCopy(input.name);
      const product: LicenseProduct = {
        id: ctx.deps.ids(),
        ipId: ip.id,
        name: input.name,
        scope: { usages: [...new Set(input.usages)], territory: input.territory, termMonths: input.termMonths, exclusive: input.exclusive, media: input.media },
        priceKrw: input.priceKrw,
        platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
        active: true,
        createdAt: ctx.now.toISOString(),
      };
      await ctx.tx.products.insert(product);
      await audit(ctx, 'studio.addProduct', `product:${product.id}`, { ipId: ip.id, priceKrw: product.priceKrw });
      return product;
    },
  }),

  'studio.setProductActive': op({
    auth: 'verified',
    doc: '라이선스 상품 판매 중지/재개',
    input: z.object({ productId: zId, active: z.boolean() }),
    async run(ctx, input) {
      const p = await ctx.tx.products.get(input.productId);
      if (!p) throw new DomainError('NOT_FOUND', '상품을 찾을 수 없습니다.');
      await loadOwnedIp(ctx, p.ipId);
      return ctx.tx.products.update(p.id, { active: input.active });
    },
  }),

  'studio.submitIp': op({
    auth: 'verified',
    doc: 'IP 심사 요청',
    input: z.object({ ipId: zId }),
    async run(ctx, input) {
      const ip = await loadOwnedIp(ctx, input.ipId);
      assert(ip.status === 'DRAFT' || ip.status === 'REJECTED', 'CONFLICT', '초안 또는 반려 상태에서만 심사를 요청할 수 있습니다.');
      const ev = await ctx.tx.evidence.find({ ipId: ip.id });
      assert(ev.length > 0, 'BAD_REQUEST', '권리 증빙을 1건 이상 등록해 주세요.');
      const products = await ctx.tx.products.find({ ipId: ip.id });
      assert(products.length > 0, 'BAD_REQUEST', '라이선스 상품을 1개 이상 만들어 주세요.');
      const pending = ip.coHolders.filter((c) => !c.consented).map((c) => c.email);
      assert(pending.length === 0, 'BAD_REQUEST', `공동권리자 동의가 필요합니다: ${pending.join(', ')}`);
      const updated = await ctx.tx.ips.update(ip.id, { status: 'PENDING_REVIEW', reviewNote: null });
      await audit(ctx, 'studio.submitIp', `ip:${ip.id}`);
      return updated;
    },
  }),

  'studio.myIps': op({
    auth: 'user',
    doc: '내가 대표 권리자이거나 공동권리자인 IP',
    input: z.object({}).optional(),
    async run(ctx) {
      const user = requireUser(ctx);
      const all = await ctx.tx.ips.find();
      const mine = all.filter((ip) => ip.ownerId === user.id || ip.coHolders.some((c) => c.userId === user.id || c.email === user.email));
      const out = [];
      for (const ip of mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        const grants = await ctx.tx.grants.find({ ipId: ip.id });
        out.push({
          ip,
          role: ip.ownerId === user.id ? ('OWNER' as const) : ('CO_HOLDER' as const),
          myConsentPending: ip.coHolders.some((c) => (c.userId === user.id || c.email === user.email) && !c.consented),
          products: await ctx.tx.products.find({ ipId: ip.id }),
          evidence: await ctx.tx.evidence.find({ ipId: ip.id }),
          salesCount: grants.length,
          salesKrw: grants.reduce((s, g) => s + g.priceKrw, 0),
          openDispute: await hasOpenDispute(ctx, ip.id),
        });
      }
      return out;
    },
  }),

  'coholder.consent': op({
    auth: 'verified',
    doc: '공동권리자 동의(전자서명)',
    input: z.object({ ipId: zId }),
    async run(ctx, input) {
      const user = requireAdult(ctx);
      const ip = await ctx.tx.ips.get(input.ipId);
      if (!ip) throw new DomainError('NOT_FOUND', 'IP를 찾을 수 없습니다.');
      const me = ip.coHolders.find((c) => c.email === user.email || c.userId === user.id);
      if (!me) throw new DomainError('FORBIDDEN', '이 IP의 공동권리자가 아닙니다.');
      if (me.consented) return ip;
      const updated = await ctx.tx.ips.update(ip.id, {
        coHolders: ip.coHolders.map((c) => (c === me ? { ...c, userId: user.id, consented: true, consentedAt: ctx.now.toISOString() } : c)),
      });
      await audit(ctx, 'coholder.consent', `ip:${ip.id}`);
      return updated;
    },
  }),
};
