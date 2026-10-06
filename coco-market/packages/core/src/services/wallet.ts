import { z } from 'zod';
import { DomainError, assert } from '../errors';
import { Accounts, accountBalance, post, trialBalance } from '../ledger';
import { audit, op, requireAdult, requireUser, zId, type Ctx } from '../op';
import type { Payout } from '../types';

export const MIN_PAYOUT_KRW = 1_000;
const APPROVALS_REQUIRED = 2;

/** 분쟁 중인 IP의 권리자(대표·공동)는 정산이 보류된다. */
export async function holdReason(ctx: Ctx, userId: string): Promise<string | null> {
  const open = await ctx.tx.disputes.find({ status: 'OPEN' });
  for (const d of open) {
    const ip = await ctx.tx.ips.get(d.ipId);
    if (ip && (ip.ownerId === userId || ip.coHolders.some((c) => c.userId === userId))) {
      return `권리 분쟁 처리 중인 IP(${ip.title})가 있어 출금이 보류되었습니다.`;
    }
  }
  return null;
}

export async function walletOf(ctx: Ctx, userId: string) {
  const payable = await accountBalance(ctx.tx, Accounts.userPayable(userId));
  const pending = (await ctx.tx.payouts.find({ userId, status: 'REQUESTED' })).reduce((s, p) => s + p.amountKrw, 0);
  return { payableKrw: payable, pendingKrw: pending, availableKrw: payable - pending, hold: await holdReason(ctx, userId) };
}

export const walletOps = {
  'wallet.summary': op({
    auth: 'user',
    doc: '정산 잔액(원장 기준)',
    input: z.object({}).optional(),
    async run(ctx) {
      const user = requireUser(ctx);
      return walletOf(ctx, user.id);
    },
  }),

  'wallet.history': op({
    auth: 'user',
    doc: '내 정산 계정 거래 내역',
    input: z.object({}).optional(),
    async run(ctx) {
      const user = requireUser(ctx);
      const lines = await ctx.tx.journalLines.find({ account: Accounts.userPayable(user.id) });
      const out = [];
      for (const l of lines.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
        const e = await ctx.tx.journal.get(l.entryId);
        out.push({ id: l.id, at: l.createdAt, memo: e?.memo ?? '', refType: e?.refType ?? '', amountKrw: l.credit - l.debit });
      }
      return out;
    },
  }),

  'payouts.request': op({
    auth: 'verified',
    doc: '출금 신청(재무 2인 승인 후 지급)',
    input: z.object({ amountKrw: z.number().int().min(MIN_PAYOUT_KRW) }),
    async run(ctx, input) {
      const user = requireAdult(ctx, 14);
      const w = await walletOf(ctx, user.id);
      if (w.hold) throw new DomainError('ON_HOLD', w.hold);
      if (input.amountKrw > w.availableKrw) throw new DomainError('INSUFFICIENT_FUNDS', `출금 가능 금액은 ${w.availableKrw.toLocaleString('ko-KR')}원입니다.`);
      const p: Payout = { id: ctx.deps.ids(), userId: user.id, amountKrw: input.amountKrw, status: 'REQUESTED', approvals: [], rejectedBy: null, journalId: null, createdAt: ctx.now.toISOString(), decidedAt: null };
      await ctx.tx.payouts.insert(p);
      await audit(ctx, 'payouts.request', `payout:${p.id}`, { amountKrw: p.amountKrw });
      return p;
    },
  }),

  'payouts.mine': op({
    auth: 'user',
    doc: '내 출금 신청 내역',
    input: z.object({}).optional(),
    async run(ctx) {
      const user = requireUser(ctx);
      return (await ctx.tx.payouts.find({ userId: user.id })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  }),

  'finance.payoutQueue': op({
    auth: 'user',
    roles: ['FINANCE'],
    doc: '출금 승인 대기열',
    input: z.object({}).optional(),
    async run(ctx) {
      const list = (await ctx.tx.payouts.find({ status: 'REQUESTED' })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const out = [];
      for (const p of list) {
        const u = await ctx.tx.users.get(p.userId);
        out.push({ payout: p, userName: u?.name ?? '', userEmail: u?.email ?? '', hold: await holdReason(ctx, p.userId), approvalsRequired: APPROVALS_REQUIRED });
      }
      return out;
    },
  }),

  'finance.approvePayout': op({
    auth: 'user',
    roles: ['FINANCE'],
    doc: '출금 승인(서로 다른 재무 담당자 2인이 승인하면 지급)',
    input: z.object({ payoutId: zId }),
    async run(ctx, input) {
      const approver = requireUser(ctx);
      const p = await ctx.tx.payouts.get(input.payoutId);
      if (!p) throw new DomainError('NOT_FOUND', '출금 신청을 찾을 수 없습니다.');
      assert(p.status === 'REQUESTED', 'CONFLICT', '이미 처리된 신청입니다.');
      assert(p.userId !== approver.id, 'FORBIDDEN', '본인 출금은 승인할 수 없습니다.');
      assert(!p.approvals.includes(approver.id), 'CONFLICT', '이미 승인했습니다. 다른 담당자의 승인이 필요합니다.');
      const hold = await holdReason(ctx, p.userId);
      if (hold) throw new DomainError('ON_HOLD', hold);

      const approvals = [...p.approvals, approver.id];
      if (approvals.length < APPROVALS_REQUIRED) {
        await audit(ctx, 'finance.approvePayout', `payout:${p.id}`, { step: approvals.length });
        return ctx.tx.payouts.update(p.id, { approvals });
      }
      const balance = await accountBalance(ctx.tx, Accounts.userPayable(p.userId));
      if (balance < p.amountKrw) throw new DomainError('INSUFFICIENT_FUNDS', '정산 잔액이 부족합니다.');
      const entry = await post(ctx.tx, ctx.deps, {
        memo: '출금 지급',
        refType: 'payout',
        refId: p.id,
        idempotencyKey: `payout:${p.id}`,
        lines: [
          { account: Accounts.userPayable(p.userId), debit: p.amountKrw },
          { account: Accounts.bankClearing, credit: p.amountKrw },
        ],
      });
      await audit(ctx, 'finance.payoutPaid', `payout:${p.id}`, { amountKrw: p.amountKrw });
      return ctx.tx.payouts.update(p.id, { approvals, status: 'PAID', journalId: entry.id, decidedAt: ctx.now.toISOString() });
    },
  }),

  'finance.rejectPayout': op({
    auth: 'user',
    roles: ['FINANCE'],
    doc: '출금 반려',
    input: z.object({ payoutId: zId }),
    async run(ctx, input) {
      const u = requireUser(ctx);
      const p = await ctx.tx.payouts.get(input.payoutId);
      if (!p) throw new DomainError('NOT_FOUND', '출금 신청을 찾을 수 없습니다.');
      assert(p.status === 'REQUESTED', 'CONFLICT', '이미 처리된 신청입니다.');
      await audit(ctx, 'finance.rejectPayout', `payout:${p.id}`);
      return ctx.tx.payouts.update(p.id, { status: 'REJECTED', rejectedBy: u.id, decidedAt: ctx.now.toISOString() });
    },
  }),

  'finance.trialBalance': op({
    auth: 'user',
    roles: ['FINANCE'],
    doc: '시산표(차변 합 = 대변 합 확인)',
    input: z.object({}).optional(),
    async run(ctx) {
      return trialBalance(ctx.tx);
    },
  }),
};
