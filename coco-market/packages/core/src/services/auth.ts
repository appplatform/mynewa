import { z } from 'zod';
import { sha256Hex } from '../crypto';
import { DomainError } from '../errors';
import { audit, op, publicUser, requireUser, type Ctx } from '../op';
import type { User } from '../types';
import { ageOn } from '../validation';

const SESSION_DAYS = 14;

function randomToken(ctx: Ctx): string {
  return sha256Hex(`${ctx.deps.ids()}|${ctx.deps.ids()}|${ctx.now.getTime()}`);
}

async function newSession(ctx: Ctx, userId: string) {
  const token = randomToken(ctx);
  const expiresAt = new Date(ctx.now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
  await ctx.tx.sessions.insert({ id: token, userId, expiresAt, createdAt: ctx.now.toISOString() });
  return { token, expiresAt };
}

async function uniqueOnboardingCode(ctx: Ctx): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = sha256Hex(`${ctx.deps.ids()}`).slice(0, 8).toUpperCase();
    const taken = await ctx.tx.users.find({ onboardingCode: code });
    if (!taken.length) return code;
  }
  throw new DomainError('CONFLICT', '온보딩 코드 생성 실패. 다시 시도해 주세요.');
}

export const authOps = {
  'auth.register': op({
    auth: 'public',
    doc: '이메일 회원가입 후 세션 발급',
    input: z.object({
      email: z.string().email().max(200).transform((s) => s.trim().toLowerCase()),
      password: z.string().min(10, '비밀번호는 10자 이상').max(200),
      name: z.string().trim().min(1).max(50),
      referralSource: z.string().max(100).optional(),
    }),
    async run(ctx, input) {
      if ((await ctx.tx.users.find({ email: input.email })).length) {
        throw new DomainError('CONFLICT', '이미 가입된 이메일입니다.');
      }
      const user: User = {
        id: ctx.deps.ids(),
        email: input.email,
        name: input.name,
        passwordHash: await ctx.deps.hasher.hash(input.password),
        roles: ['USER'],
        identityVerified: false,
        ciHash: null,
        birthDate: null,
        referralSource: input.referralSource ?? null,
        onboardingCode: await uniqueOnboardingCode(ctx),
        createdAt: ctx.now.toISOString(),
      };
      await ctx.tx.users.insert(user);
      // 이 이메일이 공동권리자로 초대된 IP가 있으면 계정을 연결한다.
      for (const ip of await ctx.tx.ips.find()) {
        if (ip.coHolders.some((c) => c.email === user.email && !c.userId)) {
          await ctx.tx.ips.update(ip.id, {
            coHolders: ip.coHolders.map((c) => (c.email === user.email ? { ...c, userId: user.id } : c)),
          });
        }
      }
      const s = await newSession(ctx, user.id);
      await audit({ ...ctx, user }, 'auth.register', `user:${user.id}`);
      return { user: publicUser(user), ...s };
    },
  }),

  'auth.login': op({
    auth: 'public',
    doc: '이메일·비밀번호 로그인',
    input: z.object({ email: z.string().transform((s) => s.trim().toLowerCase()), password: z.string() }),
    async run(ctx, input) {
      const [user] = await ctx.tx.users.find({ email: input.email });
      const ok = user ? await ctx.deps.hasher.verify(input.password, user.passwordHash) : false;
      if (!user || !ok) throw new DomainError('UNAUTHENTICATED', '이메일 또는 비밀번호가 올바르지 않습니다.');
      const s = await newSession(ctx, user.id);
      return { user: publicUser(user), ...s };
    },
  }),

  'auth.logout': op({
    auth: 'user',
    doc: '현재 세션 종료',
    input: z.object({}).optional(),
    async run(ctx) {
      if (ctx.sessionId) await ctx.tx.sessions.delete(ctx.sessionId);
      return { ok: true };
    },
  }),

  'auth.me': op({
    auth: 'public',
    doc: '현재 로그인 사용자',
    input: z.object({}).optional(),
    async run(ctx) {
      return { user: ctx.user ? publicUser(ctx.user) : null };
    },
  }),

  'identity.verify': op({
    auth: 'user',
    doc: '휴대폰 본인확인(모의 PASS). 1인 1계정, 만 14세 미만 불가',
    input: z.object({
      name: z.string().trim().min(1).max(50),
      birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
      phone: z.string().regex(/^[\d-]{10,13}$/, '휴대폰 번호 형식'),
    }),
    async run(ctx, input) {
      const user = requireUser(ctx);
      if (user.identityVerified) throw new DomainError('CONFLICT', '이미 본인확인을 마쳤습니다.');
      const res = await ctx.deps.identity.verify(input);
      if (!res.verified) throw new DomainError('BAD_REQUEST', '본인확인에 실패했습니다. 정보를 다시 확인해 주세요.');
      if (ageOn(res.birthDate, ctx.now) < 14) {
        throw new DomainError('AGE_RESTRICTED', '만 14세 미만은 가입할 수 없습니다.');
      }
      const ciHash = sha256Hex(`ci|${res.ci}`);
      const dup = await ctx.tx.users.find({ ciHash });
      if (dup.length) throw new DomainError('CONFLICT', '이미 본인확인된 다른 계정이 있습니다. 1인 1계정만 허용됩니다.');
      const updated = await ctx.tx.users.update(user.id, {
        identityVerified: true,
        ciHash,
        birthDate: res.birthDate,
        name: res.name,
      });
      await audit(ctx, 'identity.verify', `user:${user.id}`);
      return { user: publicUser(updated), adult: ageOn(res.birthDate, ctx.now) >= 19 };
    },
  }),
};
