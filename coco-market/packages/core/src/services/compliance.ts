import { z } from 'zod';
import { DomainError, assert } from '../errors';
import { audit, op, requireUser, verifyAuditChain, zId, type Ctx } from '../op';
import { AMBER_FLAG_KEYS, GATES, gateForFlag, isAmberFlagKey, type AmberFlagKey } from '../policy/gates';
import type { Collections } from '../store';
import type { FeatureFlag } from '../types';

/** AMBER 기능은 (1) flag가 켜져 있고 (2) 만료되지 않은 법률 의견서가 있을 때만 동작한다. 사용 시점마다 둘 다 확인한다. */
export async function activeFlag(tx: Collections, key: AmberFlagKey, now: Date): Promise<FeatureFlag | null> {
  const flag = await tx.flags.get(key);
  if (!flag?.enabled) return null;
  const approvals = await tx.approvals.find({ flagKey: key });
  const valid = approvals.some((a) => a.expiresAt > now.toISOString());
  return valid ? flag : null;
}

async function flagView(ctx: Ctx, key: AmberFlagKey) {
  const gate = gateForFlag(key)!;
  const flag = await ctx.tx.flags.get(key);
  const approvals = (await ctx.tx.approvals.find({ flagKey: key })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const validApproval = approvals.find((a) => a.expiresAt > ctx.now.toISOString()) ?? null;
  return {
    key,
    gate,
    enabled: flag?.enabled ?? false,
    params: flag?.params ?? gate.defaultParams ?? {},
    effective: !!flag?.enabled && !!validApproval,
    validApproval,
    approvals,
  };
}

export const complianceOps = {
  'gates.list': op({
    auth: 'public',
    doc: '기능별 법적 위험 등급표(Legal Gate Matrix)',
    input: z.object({}).optional(),
    async run() {
      return GATES;
    },
  }),

  'compliance.flags': op({
    auth: 'user',
    roles: ['COMPLIANCE_OFFICER'],
    doc: 'AMBER 기능 flag와 의견서 현황',
    input: z.object({}).optional(),
    async run(ctx) {
      const out = [];
      for (const key of AMBER_FLAG_KEYS) out.push(await flagView(ctx, key));
      return out;
    },
  }),

  'compliance.registerApproval': op({
    auth: 'user',
    roles: ['COMPLIANCE_OFFICER'],
    doc: '법무법인 서면 의견서 등록(문서 해시)',
    input: z.object({
      flagKey: z.string(),
      lawFirm: z.string().trim().min(2).max(100),
      opinionDocHash: z.string().regex(/^[0-9a-f]{64}$/, '의견서 파일의 SHA-256(소문자 hex 64자)'),
      scope: z.string().trim().min(5).max(1000),
      expiresAt: z.string().datetime(),
    }),
    async run(ctx, input) {
      const user = requireUser(ctx);
      if (!isAmberFlagKey(input.flagKey)) {
        throw new DomainError('RED_FEATURE_FORBIDDEN', '의견서를 등록할 수 있는 기능은 AMBER 등급뿐입니다.');
      }
      assert(input.expiresAt > ctx.now.toISOString(), 'BAD_REQUEST', '만료일이 이미 지났습니다.');
      const approval = { id: ctx.deps.ids(), ...input, registeredBy: user.id, createdAt: ctx.now.toISOString() };
      await ctx.tx.approvals.insert(approval);
      await audit(ctx, 'compliance.registerApproval', `flag:${input.flagKey}`, { lawFirm: input.lawFirm, docHash: input.opinionDocHash, expiresAt: input.expiresAt });
      return approval;
    },
  }),

  'compliance.setFlag': op({
    auth: 'user',
    roles: ['COMPLIANCE_OFFICER'],
    doc: 'AMBER 기능 켜기/끄기·파라미터 변경. 켜려면 유효한 의견서가 필요',
    input: z.object({ key: z.string(), enabled: z.boolean(), params: z.record(z.number().int().min(0).max(10_000)).optional() }),
    async run(ctx, input) {
      const user = requireUser(ctx);
      if (!isAmberFlagKey(input.key)) {
        const red = GATES.find((g) => g.level === 'RED' && g.feature.includes(input.key));
        throw new DomainError('RED_FEATURE_FORBIDDEN', red ? `RED 등급 기능은 켤 수 없습니다: ${red.feature}` : `등록되지 않은 기능입니다: ${input.key}`);
      }
      if (input.enabled) {
        const approvals = await ctx.tx.approvals.find({ flagKey: input.key });
        const ok = approvals.some((a) => a.expiresAt > ctx.now.toISOString());
        if (!ok) throw new DomainError('COMPLIANCE_BLOCKED', '유효한 법률 의견서가 없어 켤 수 없습니다.');
      }
      const gate = gateForFlag(input.key)!;
      const existing = await ctx.tx.flags.get(input.key);
      const params = { ...(gate.defaultParams ?? {}), ...(existing?.params ?? {}), ...(input.params ?? {}) };
      const doc: FeatureFlag = { id: input.key, enabled: input.enabled, params, updatedAt: ctx.now.toISOString(), updatedBy: user.id };
      if (existing) await ctx.tx.flags.update(input.key, doc);
      else await ctx.tx.flags.insert(doc);
      await audit(ctx, 'compliance.setFlag', `flag:${input.key}`, { enabled: input.enabled, params });
      return flagView(ctx, input.key);
    },
  }),

  'audit.list': op({
    auth: 'user',
    roles: ['COMPLIANCE_OFFICER'],
    doc: '감사 로그(최신순)와 해시 체인 검증 결과',
    input: z.object({ limit: z.number().int().min(1).max(500).default(100) }).optional(),
    async run(ctx, input) {
      const rows = (await ctx.tx.audit.find()).sort((a, b) => b.seq - a.seq).slice(0, input?.limit ?? 100);
      return { rows, chain: await verifyAuditChain(ctx.tx) };
    },
  }),

  'disputes.report': op({
    auth: 'user',
    doc: '권리 침해·분쟁 신고. 접수 즉시 해당 IP 판매와 권리자 정산이 보류된다',
    input: z.object({ ipId: zId, reason: z.string().trim().min(10).max(2000) }),
    async run(ctx, input) {
      const user = requireUser(ctx);
      const ip = await ctx.tx.ips.get(input.ipId);
      if (!ip) throw new DomainError('NOT_FOUND', 'IP를 찾을 수 없습니다.');
      const d = { id: ctx.deps.ids(), ipId: ip.id, reporterId: user.id, reason: input.reason, status: 'OPEN' as const, decisionNote: null, createdAt: ctx.now.toISOString(), decidedAt: null };
      await ctx.tx.disputes.insert(d);
      await audit(ctx, 'disputes.report', `ip:${ip.id}`, { disputeId: d.id });
      return d;
    },
  }),

  'disputes.queue': op({
    auth: 'user',
    roles: ['COMPLIANCE_OFFICER'],
    doc: '분쟁 목록',
    input: z.object({}).optional(),
    async run(ctx) {
      const all = (await ctx.tx.disputes.find()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const out = [];
      for (const d of all) out.push({ dispute: d, ipTitle: (await ctx.tx.ips.get(d.ipId))?.title ?? '' });
      return out;
    },
  }),

  'disputes.decide': op({
    auth: 'user',
    roles: ['COMPLIANCE_OFFICER'],
    doc: '분쟁 결정. 인용 시 IP 판매 정지',
    input: z.object({ disputeId: zId, uphold: z.boolean(), note: z.string().trim().min(2).max(2000) }),
    async run(ctx, input) {
      const d = await ctx.tx.disputes.get(input.disputeId);
      if (!d) throw new DomainError('NOT_FOUND', '분쟁을 찾을 수 없습니다.');
      assert(d.status === 'OPEN', 'CONFLICT', '이미 결정된 분쟁입니다.');
      const updated = await ctx.tx.disputes.update(d.id, { status: input.uphold ? 'UPHELD' : 'DISMISSED', decisionNote: input.note, decidedAt: ctx.now.toISOString() });
      if (input.uphold) await ctx.tx.ips.update(d.ipId, { status: 'SUSPENDED' });
      await audit(ctx, 'disputes.decide', `dispute:${d.id}`, { uphold: input.uphold });
      return updated;
    },
  }),
};
