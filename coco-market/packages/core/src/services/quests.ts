import { z } from 'zod';
import { DomainError, assert } from '../errors';
import { Accounts, post } from '../ledger';
import { audit, op, requireAdult, requireUser, zId, zKrw, type Ctx } from '../op';
import { computeTier, tierAtLeast, TIER_ORDER } from '../policy/tier';
import { withholding } from '../policy/tax';
import type { Contribution, Quest, QuestKind, Reward, Tier } from '../types';
import { assertCleanCopy } from './studio';

export const QUEST_KINDS = ['MERCHANT_ONBOARDING', 'AD_VERIFICATION', 'REVIEW', 'FIELD_SUPPORT', 'CONSULTING'] as const;

/** KST 기준 날짜(YYYY-MM-DD) */
export function kstDay(iso: string): string {
  return new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 10);
}

export async function tierOf(ctx: Ctx, userId: string) {
  return computeTier(await ctx.tx.contributions.find({ userId }));
}

export const questOps = {
  'quests.list': op({
    auth: 'public',
    doc: '열린 퀘스트와 내 수행 가능 여부',
    input: z.object({}).optional(),
    async run(ctx) {
      const quests = (await ctx.tx.quests.find({ status: 'OPEN' })).sort((a, b) => TIER_ORDER.indexOf(a.minTier) - TIER_ORDER.indexOf(b.minTier) || a.rewardKrw - b.rewardKrw);
      const myTier: Tier = ctx.user ? (await tierOf(ctx, ctx.user.id)).tier : 'CONSUMER';
      const out = [];
      for (const q of quests) {
        const verified = (await ctx.tx.contributions.find({ questId: q.id, status: 'VERIFIED' })).length;
        out.push({ quest: q, remaining: Math.max(0, q.capacity - verified), eligible: tierAtLeast(myTier, q.minTier) });
      }
      return { myTier, quests: out };
    },
  }),

  'quests.submit': op({
    auth: 'verified',
    doc: '퀘스트 수행 결과 제출(본인 수행분만)',
    input: z.object({ questId: zId, evidence: z.string().trim().min(10).max(2000), merchantId: zId.optional() }),
    async run(ctx, input) {
      const user = requireAdult(ctx, 14);
      const q = await ctx.tx.quests.get(input.questId);
      if (!q || q.status !== 'OPEN') throw new DomainError('NOT_FOUND', '진행 중인 퀘스트가 아닙니다.');
      const { tier } = await tierOf(ctx, user.id);
      assert(tierAtLeast(tier, q.minTier), 'FORBIDDEN', '이 퀘스트는 더 높은 기여 등급에서 수행할 수 있습니다.');

      const verified = (await ctx.tx.contributions.find({ questId: q.id, status: 'VERIFIED' })).length;
      assert(verified < q.capacity, 'CONFLICT', '모집 정원이 찼습니다.');

      const mine = await ctx.tx.contributions.find({ questId: q.id, userId: user.id });
      const today = kstDay(ctx.now.toISOString());
      const todayCount = mine.filter((c) => kstDay(c.createdAt) === today && c.status !== 'REJECTED').length;
      assert(todayCount < q.dailyLimitPerUser, 'LIMIT_EXCEEDED', `이 퀘스트는 하루 ${q.dailyLimitPerUser}건까지 제출할 수 있습니다.`);

      let merchantId: string | null = null;
      if (q.kind === 'MERCHANT_ONBOARDING') {
        assert(input.merchantId, 'BAD_REQUEST', '온보딩한 가맹점을 선택해 주세요.');
        const m = await ctx.tx.merchants.get(input.merchantId);
        assert(m && m.onboardedBy === user.id, 'FORBIDDEN', '본인이 직접 온보딩한 가맹점만 제출할 수 있습니다.');
        assert(m.membershipPaid, 'BAD_REQUEST', '가맹점의 입점 절차(가입비 결제)가 끝난 뒤 제출할 수 있습니다.');
        const used = (await ctx.tx.contributions.find({ merchantId: m.id })).some((c) => c.status !== 'REJECTED');
        assert(!used, 'CONFLICT', '이미 제출된 가맹점입니다.');
        merchantId = m.id;
      }

      const c: Contribution = {
        id: ctx.deps.ids(),
        questId: q.id,
        userId: user.id,
        kind: q.kind,
        evidence: input.evidence,
        merchantId,
        status: 'SUBMITTED',
        reviewerId: null,
        reviewNote: null,
        anchorBatchId: null,
        createdAt: ctx.now.toISOString(),
        decidedAt: null,
      };
      await ctx.tx.contributions.insert(c);
      await audit(ctx, 'quests.submit', `contribution:${c.id}`, { questId: q.id });
      return c;
    },
  }),

  'quests.mine': op({
    auth: 'user',
    doc: '내 기여 내역과 등급 진행도',
    input: z.object({}).optional(),
    async run(ctx) {
      const user = requireUser(ctx);
      const list = (await ctx.tx.contributions.find({ userId: user.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const out = [];
      for (const c of list) {
        const q = await ctx.tx.quests.get(c.questId);
        const [reward] = await ctx.tx.rewards.find({ contributionId: c.id });
        out.push({ contribution: c, questTitle: q?.title ?? '', reward: reward ?? null });
      }
      return { progress: computeTier(list), contributions: out };
    },
  }),

  'quests.create': op({
    auth: 'user',
    roles: ['SUPER_ADMIN'],
    doc: '퀘스트 등록',
    input: z.object({
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().min(10).max(2000),
      kind: z.enum(QUEST_KINDS),
      rewardKrw: zKrw.min(100).max(5_000_000),
      incomeType: z.enum(['BUSINESS', 'OTHER']),
      minTier: z.enum(['CONSUMER', 'TS', 'CS', 'BS', 'OP', 'RP', 'HP']),
      capacity: z.number().int().min(1).max(100_000),
      dailyLimitPerUser: z.number().int().min(1).max(100),
    }),
    async run(ctx, input) {
      assertCleanCopy(input.title, input.description);
      const q: Quest = { id: ctx.deps.ids(), ...input, status: 'OPEN', createdAt: ctx.now.toISOString() };
      await ctx.tx.quests.insert(q);
      await audit(ctx, 'quests.create', `quest:${q.id}`, { rewardKrw: q.rewardKrw });
      return q;
    },
  }),

  'quests.close': op({
    auth: 'user',
    roles: ['SUPER_ADMIN'],
    doc: '퀘스트 마감',
    input: z.object({ questId: zId }),
    async run(ctx, input) {
      const q = await ctx.tx.quests.get(input.questId);
      if (!q) throw new DomainError('NOT_FOUND', '퀘스트를 찾을 수 없습니다.');
      await audit(ctx, 'quests.close', `quest:${q.id}`);
      return ctx.tx.quests.update(q.id, { status: 'CLOSED' });
    },
  }),

  'review.contributionQueue': op({
    auth: 'user',
    roles: ['REVIEWER'],
    doc: '검증 대기 기여',
    input: z.object({}).optional(),
    async run(ctx) {
      const list = (await ctx.tx.contributions.find({ status: 'SUBMITTED' })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const out = [];
      for (const c of list) {
        const q = await ctx.tx.quests.get(c.questId);
        const u = await ctx.tx.users.get(c.userId);
        const m = c.merchantId ? await ctx.tx.merchants.get(c.merchantId) : undefined;
        out.push({ contribution: c, questTitle: q?.title ?? '', rewardKrw: q?.rewardKrw ?? 0, userName: u?.name ?? '', merchantName: m?.name ?? null });
      }
      return out;
    },
  }),

  'review.decideContribution': op({
    auth: 'user',
    roles: ['REVIEWER'],
    doc: '기여 검증. 승인 시 용역비 지급(원천징수 후 적립)',
    input: z.object({ contributionId: zId, approve: z.boolean(), note: z.string().trim().max(500).default('') }),
    async run(ctx, input) {
      const reviewer = requireUser(ctx);
      const c = await ctx.tx.contributions.get(input.contributionId);
      if (!c) throw new DomainError('NOT_FOUND', '기여 내역을 찾을 수 없습니다.');
      assert(c.status === 'SUBMITTED', 'CONFLICT', '이미 처리된 기여입니다.');
      assert(c.userId !== reviewer.id, 'FORBIDDEN', '본인 기여는 검증할 수 없습니다.');
      const q = await ctx.tx.quests.get(c.questId);
      if (!q) throw new DomainError('NOT_FOUND', '퀘스트를 찾을 수 없습니다.');

      if (!input.approve) {
        const updated = await ctx.tx.contributions.update(c.id, { status: 'REJECTED', reviewerId: reviewer.id, reviewNote: input.note || null, decidedAt: ctx.now.toISOString() });
        await audit(ctx, 'review.rejectContribution', `contribution:${c.id}`);
        return { contribution: updated, reward: null };
      }

      const verified = (await ctx.tx.contributions.find({ questId: q.id, status: 'VERIFIED' })).length;
      assert(verified < q.capacity, 'CONFLICT', '모집 정원이 이미 찼습니다.');
      const updated = await ctx.tx.contributions.update(c.id, { status: 'VERIFIED', reviewerId: reviewer.id, reviewNote: input.note || null, decidedAt: ctx.now.toISOString() });

      const gross = q.rewardKrw;
      const wh = withholding(gross, q.incomeType);
      const entry = await post(ctx.tx, ctx.deps, {
        memo: `퀘스트 용역비: ${q.title}`,
        refType: 'contribution',
        refId: c.id,
        idempotencyKey: `reward:${c.id}`,
        lines: [
          { account: Accounts.questExpense, debit: gross },
          { account: Accounts.userPayable(c.userId), credit: gross - wh },
          ...(wh > 0 ? [{ account: Accounts.withholding, credit: wh }] : []),
        ],
      });
      const reward: Reward = { id: ctx.deps.ids(), contributionId: c.id, userId: c.userId, grossKrw: gross, withholdingKrw: wh, netKrw: gross - wh, incomeType: q.incomeType, journalId: entry.id, createdAt: ctx.now.toISOString() };
      await ctx.tx.rewards.insert(reward);
      if (verified + 1 >= q.capacity) await ctx.tx.quests.update(q.id, { status: 'CLOSED' });
      await audit(ctx, 'review.approveContribution', `contribution:${c.id}`, { grossKrw: gross, withholdingKrw: wh });
      return { contribution: updated, reward };
    },
  }),
};

export type { QuestKind };
