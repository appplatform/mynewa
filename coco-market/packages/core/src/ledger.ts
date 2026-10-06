import { DomainError } from './errors';
import type { Collections } from './store';
import type { JournalEntry, JournalLine } from './types';
import type { Deps } from './deps';

// 복식부기 원장. 잔액은 언제나 분개 라인에서 계산한다.
// 계정 이름 규칙:
//   clearing:pg                 PG로 들어온 고객 결제 대금(자산)
//   clearing:bank               정산 지급으로 나간 은행 이체(자산 감소)
//   payable:user:{userId}       사용자에게 지급할 금액(부채)
//   tax:withholding             원천징수 예수금(부채)
//   revenue:platform            플랫폼 수수료 수익
//   revenue:membership          가맹점 가입비 수익
//   expense:quest_rewards       퀘스트 용역비(비용)
//   expense:onboarding_commission  영업대행 수수료(비용)

export const Accounts = {
  pgClearing: 'clearing:pg',
  bankClearing: 'clearing:bank',
  userPayable: (userId: string) => `payable:user:${userId}`,
  withholding: 'tax:withholding',
  platformRevenue: 'revenue:platform',
  membershipRevenue: 'revenue:membership',
  questExpense: 'expense:quest_rewards',
  commissionExpense: 'expense:onboarding_commission',
} as const;

export interface PostingLine { account: string; debit?: number; credit?: number }

export interface PostingInput {
  memo: string;
  refType: string;
  refId: string;
  idempotencyKey: string;
  lines: PostingLine[];
}

export async function post(tx: Collections, deps: Deps, input: PostingInput): Promise<JournalEntry> {
  const existing = await tx.journal.find({ idempotencyKey: input.idempotencyKey });
  if (existing[0]) return existing[0];

  let dr = 0;
  let cr = 0;
  for (const l of input.lines) {
    const d = l.debit ?? 0;
    const c = l.credit ?? 0;
    if (!Number.isInteger(d) || !Number.isInteger(c) || d < 0 || c < 0) {
      throw new DomainError('BAD_REQUEST', '분개 금액은 0 이상의 정수여야 합니다.');
    }
    if ((d > 0) === (c > 0)) throw new DomainError('BAD_REQUEST', '분개 라인은 차변 또는 대변 중 하나만 가집니다.');
    dr += d;
    cr += c;
  }
  if (dr !== cr || dr === 0) throw new DomainError('BAD_REQUEST', `분개 불균형: 차변 ${dr} / 대변 ${cr}`);

  const now = deps.clock().toISOString();
  const entry: JournalEntry = {
    id: deps.ids(),
    memo: input.memo,
    refType: input.refType,
    refId: input.refId,
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
  };
  await tx.journal.insert(entry);
  for (const l of input.lines) {
    const line: JournalLine = {
      id: deps.ids(),
      entryId: entry.id,
      account: l.account,
      debit: l.debit ?? 0,
      credit: l.credit ?? 0,
      createdAt: now,
    };
    await tx.journalLines.insert(line);
  }
  return entry;
}

/** 부채·수익 계정은 대변 - 차변, 자산·비용 계정은 차변 - 대변 */
export function normalBalance(account: string, lines: Pick<JournalLine, 'debit' | 'credit'>[]): number {
  const creditNormal = /^(payable|tax|revenue):/.test(account);
  return lines.reduce((s, l) => s + (creditNormal ? l.credit - l.debit : l.debit - l.credit), 0);
}

export async function accountBalance(tx: Collections, account: string): Promise<number> {
  return normalBalance(account, await tx.journalLines.find({ account }));
}

export async function trialBalance(tx: Collections) {
  const lines = await tx.journalLines.find();
  const byAccount = new Map<string, { debit: number; credit: number }>();
  for (const l of lines) {
    const a = byAccount.get(l.account) ?? { debit: 0, credit: 0 };
    a.debit += l.debit;
    a.credit += l.credit;
    byAccount.set(l.account, a);
  }
  const rows = [...byAccount.entries()]
    .map(([account, t]) => ({ account, ...t, balance: normalBalance(account, [t]) }))
    .sort((a, b) => a.account.localeCompare(b.account));
  const totals = rows.reduce((s, r) => ({ debit: s.debit + r.debit, credit: s.credit + r.credit }), { debit: 0, credit: 0 });
  return { rows, totals, balanced: totals.debit === totals.credit };
}

/** 금액을 지분(bps)대로 나눈다. 나머지 원은 첫 번째 몫(대표 권리자)에 붙인다. */
export function splitByBps(amount: number, shares: { key: string; bps: number }[]): { key: string; amount: number }[] {
  const total = shares.reduce((s, x) => s + x.bps, 0);
  if (total !== 10_000) throw new DomainError('BAD_REQUEST', '지분 합계는 100%여야 합니다.');
  const parts = shares.map((s) => ({ key: s.key, amount: Math.floor((amount * s.bps) / 10_000) }));
  const rest = amount - parts.reduce((s, p) => s + p.amount, 0);
  if (parts[0]) parts[0].amount += rest;
  return parts;
}
