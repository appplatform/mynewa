import type { z } from 'zod';
import type { Deps } from './deps';
import { DomainError } from './errors';
import { hasRole, type Ctx, type OpDef } from './op';
import type { Store } from './store';
import { authOps } from './services/auth';
import { catalogOps } from './services/catalog';
import { complianceOps } from './services/compliance';
import { licenseOps } from './services/license';
import { merchantOps } from './services/merchant';
import { questOps } from './services/quests';
import { studioOps } from './services/studio';
import { walletOps } from './services/wallet';

export const operations = {
  ...authOps,
  ...catalogOps,
  ...studioOps,
  ...licenseOps,
  ...questOps,
  ...merchantOps,
  ...walletOps,
  ...complianceOps,
};

export type Operations = typeof operations;
export type OpName = keyof Operations;
type AnyOp = OpDef<z.ZodTypeAny, unknown>;
export type OpInput<N extends OpName> = z.input<Operations[N]['input']>;
export type OpOutput<N extends OpName> = Awaited<ReturnType<Operations[N]['run']>>;

export interface ExecuteOptions {
  sessionToken?: string | null;
}

/**
 * 단일 진입점. HTTP 서버와 브라우저 데모가 같은 함수를 호출한다.
 * 입력 검증 → 트랜잭션 시작 → 세션 확인 → 권한 확인 → 실행.
 */
export async function execute<N extends OpName>(
  store: Store,
  deps: Deps,
  name: N,
  rawInput: unknown,
  opts: ExecuteOptions = {},
): Promise<OpOutput<N>> {
  const def = (operations as Record<string, AnyOp>)[name as string];
  if (!def) throw new DomainError('NOT_FOUND', `알 수 없는 작업: ${String(name)}`);
  const parsed = def.input.safeParse(rawInput ?? undefined);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || '입력'}: ${i.message}`).join(' / ');
    throw new DomainError('BAD_REQUEST', msg);
  }
  const result = await store.transaction(async (tx): Promise<unknown> => {
    const now = deps.clock();
    let user = null;
    let sessionId: string | null = null;
    if (opts.sessionToken) {
      const s = await tx.sessions.get(opts.sessionToken);
      if (s && s.expiresAt > now.toISOString()) {
        user = (await tx.users.get(s.userId)) ?? null;
        sessionId = s.id;
      }
    }
    const ctx: Ctx = { tx, deps, user, sessionId, now };
    if (def.auth !== 'public' && !user) throw new DomainError('UNAUTHENTICATED', '로그인이 필요합니다.');
    if (def.auth === 'verified' && !user?.identityVerified) {
      throw new DomainError('IDENTITY_REQUIRED', '본인확인 후 이용할 수 있습니다.');
    }
    if (def.roles && !hasRole(user, ...def.roles)) throw new DomainError('FORBIDDEN', '권한이 없습니다.');
    return def.run(ctx, parsed.data);
  });
  return result as OpOutput<N>;
}

export function describeOperations() {
  return Object.entries(operations as Record<string, AnyOp>).map(([name, d]) => ({ name, auth: d.auth, roles: d.roles ?? [], doc: d.doc }));
}
