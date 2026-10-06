import { z } from 'zod';
import { sha256Hex, canonicalJson } from './crypto';
import type { Deps } from './deps';
import { DomainError } from './errors';
import type { Collections } from './store';
import type { Role, User } from './types';
import { ageOn } from './validation';

export interface Ctx {
  tx: Collections;
  deps: Deps;
  user: User | null;
  sessionId: string | null;
  now: Date;
}

/** public: 누구나 / user: 로그인 / verified: 로그인 + 본인확인 */
export type AuthLevel = 'public' | 'user' | 'verified';

export interface OpDef<I extends z.ZodTypeAny, O> {
  auth: AuthLevel;
  roles?: Role[];
  input: I;
  /** 문서화용 한 줄 설명 */
  doc: string;
  run(ctx: Ctx, input: z.infer<I>): Promise<O>;
}

export function op<I extends z.ZodTypeAny, O>(def: OpDef<I, O>): OpDef<I, O> {
  return def;
}

export function requireUser(ctx: Ctx): User {
  if (!ctx.user) throw new DomainError('UNAUTHENTICATED', '로그인이 필요합니다.');
  return ctx.user;
}

export function hasRole(user: User | null, ...roles: Role[]): boolean {
  return !!user && (user.roles.includes('SUPER_ADMIN') || roles.some((r) => user.roles.includes(r)));
}

export function requireAdult(ctx: Ctx, minAge = 19): User {
  const user = requireUser(ctx);
  if (!user.identityVerified || !user.birthDate) {
    throw new DomainError('IDENTITY_REQUIRED', '본인확인 후 이용할 수 있습니다.');
  }
  if (ageOn(user.birthDate, ctx.now) < minAge) {
    throw new DomainError('AGE_RESTRICTED', `만 ${minAge}세 이상만 이용할 수 있습니다.`);
  }
  return user;
}

export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    roles: u.roles,
    identityVerified: u.identityVerified,
    onboardingCode: u.onboardingCode,
    createdAt: u.createdAt,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

/** 감사 로그. 앞 항목의 해시를 이어 붙이는 해시 체인이라 중간 삭제·수정이 드러난다. */
export async function audit(ctx: Ctx, action: string, target: string, detail: Record<string, unknown> = {}) {
  const all = await ctx.tx.audit.find();
  const last = all.reduce<(typeof all)[number] | undefined>((m, a) => (!m || a.seq > m.seq ? a : m), undefined);
  const seq = (last?.seq ?? 0) + 1;
  const prevHash = last?.hash ?? '0'.repeat(64);
  const createdAt = ctx.now.toISOString();
  const actorId = ctx.user?.id ?? null;
  const detailJson = canonicalJson(detail);
  const hash = sha256Hex(canonicalJson({ seq, prevHash, actorId, action, target, detail: detailJson, createdAt }));
  await ctx.tx.audit.insert({ id: ctx.deps.ids(), seq, actorId, action, target, detail: detailJson, prevHash, hash, createdAt });
}

export async function verifyAuditChain(tx: Collections): Promise<{ ok: boolean; count: number; brokenAt: number | null }> {
  const rows = (await tx.audit.find()).sort((a, b) => a.seq - b.seq);
  let prev = '0'.repeat(64);
  for (const r of rows) {
    const expect = sha256Hex(
      canonicalJson({ seq: r.seq, prevHash: prev, actorId: r.actorId, action: r.action, target: r.target, detail: r.detail, createdAt: r.createdAt }),
    );
    if (r.prevHash !== prev || r.hash !== expect) return { ok: false, count: rows.length, brokenAt: r.seq };
    prev = r.hash;
  }
  return { ok: true, count: rows.length, brokenAt: null };
}

export const zId = z.string().min(1).max(64);
export const zKrw = z.number().int().nonnegative().max(1_000_000_000);
