import { z } from 'zod';
import { DomainError, assert } from '../errors';
import { Accounts, post, type PostingLine } from '../ledger';
import { audit, op, requireAdult, requireUser, zId } from '../op';
import { withholding } from '../policy/tax';
import type { Merchant } from '../types';
import { isValidBusinessNumber, normalizeBusinessNumber } from '../validation';
import { activeFlag } from './compliance';

export const merchantOps = {
  'merchant.register': op({
    auth: 'verified',
    doc: '가맹점 입점 신청(사업자번호 검증). 온보딩 코드로 기여자 1인과 연결',
    input: z.object({
      name: z.string().trim().min(2).max(80),
      businessNumber: z.string().trim(),
      region: z.string().trim().min(2).max(60),
      onboardingCode: z.string().trim().toUpperCase().max(16).optional(),
    }),
    async run(ctx, input) {
      const owner = requireAdult(ctx);
      assert(isValidBusinessNumber(input.businessNumber), 'BAD_REQUEST', '사업자등록번호가 올바르지 않습니다.');
      const bn = normalizeBusinessNumber(input.businessNumber);
      let onboardedBy: string | null = null;
      if (input.onboardingCode) {
        const [u] = await ctx.tx.users.find({ onboardingCode: input.onboardingCode });
        assert(u, 'BAD_REQUEST', '온보딩 코드를 찾을 수 없습니다.');
        assert(u.id !== owner.id, 'BAD_REQUEST', '본인 코드로는 입점할 수 없습니다.');
        onboardedBy = u.id;
      }
      const m: Merchant = {
        id: ctx.deps.ids(),
        name: input.name,
        businessNumber: bn,
        ownerUserId: owner.id,
        region: input.region,
        onboardedBy,
        membershipPaid: false,
        membershipFeeKrw: ctx.deps.membershipFeeKrw,
        createdAt: ctx.now.toISOString(),
      };
      await ctx.tx.merchants.insert(m);
      await audit(ctx, 'merchant.register', `merchant:${m.id}`, { onboardedBy });
      return m;
    },
  }),

  'merchant.payMembership': op({
    auth: 'verified',
    doc: '가맹점 가입비 결제. 영업대행 수수료는 AMBER flag가 유효할 때만 온보딩 수행자 1인에게 지급',
    input: z.object({ merchantId: zId }),
    async run(ctx, input) {
      const user = requireUser(ctx);
      const m = await ctx.tx.merchants.get(input.merchantId);
      if (!m) throw new DomainError('NOT_FOUND', '가맹점을 찾을 수 없습니다.');
      assert(m.ownerUserId === user.id, 'FORBIDDEN', '가맹점 대표만 결제할 수 있습니다.');
      assert(!m.membershipPaid, 'CONFLICT', '이미 가입비를 결제했습니다.');
      const pay = await ctx.deps.payments.charge({ orderId: `membership:${m.id}`, amountKrw: m.membershipFeeKrw, description: '가맹점 가입비', payerId: user.id });
      if (!pay.approved) throw new DomainError('BAD_REQUEST', `결제가 승인되지 않았습니다: ${pay.failureReason ?? ''}`);

      const fee = m.membershipFeeKrw;
      const lines: PostingLine[] = [
        { account: Accounts.pgClearing, debit: fee },
        { account: Accounts.membershipRevenue, credit: fee },
      ];
      let commission = 0;
      const flag = await activeFlag(ctx.tx, 'merchant.onboarding_commission', ctx.now);
      if (flag && m.onboardedBy) {
        commission = Math.floor((fee * (flag.params.commissionBps ?? 0)) / 10_000);
        if (commission > 0) {
          const wh = withholding(commission, 'BUSINESS');
          lines.push(
            { account: Accounts.commissionExpense, debit: commission },
            { account: Accounts.userPayable(m.onboardedBy), credit: commission - wh },
            ...(wh > 0 ? [{ account: Accounts.withholding, credit: wh }] : []),
          );
        }
      }
      await post(ctx.tx, ctx.deps, { memo: `가맹점 가입비: ${m.name}`, refType: 'merchant', refId: m.id, idempotencyKey: `membership:${m.id}`, lines });
      const updated = await ctx.tx.merchants.update(m.id, { membershipPaid: true });
      await audit(ctx, 'merchant.payMembership', `merchant:${m.id}`, { fee, commission, paymentRef: pay.paymentRef });
      return { merchant: updated, commissionKrw: commission };
    },
  }),

  'merchant.mine': op({
    auth: 'user',
    doc: '내가 대표인 가맹점과 내가 온보딩한 가맹점',
    input: z.object({}).optional(),
    async run(ctx) {
      const user = requireUser(ctx);
      const owned = await ctx.tx.merchants.find({ ownerUserId: user.id });
      const onboarded = await ctx.tx.merchants.find({ onboardedBy: user.id });
      const used = new Set(
        (await ctx.tx.contributions.find({ userId: user.id })).filter((c) => c.status !== 'REJECTED' && c.merchantId).map((c) => c.merchantId),
      );
      return {
        owned,
        onboarded: onboarded.map((m) => ({ ...m, claimed: used.has(m.id) })),
      };
    },
  }),
};
