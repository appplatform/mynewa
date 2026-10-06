import cookie from '@fastify/cookie';
import { describeOperations, DomainError, execute, HTTP_STATUS, operations, type Deps, type Store } from '@coco/core';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Config } from './config';

const COOKIE = 'coco_session';
const AUTH_OPS = new Set(['auth.login', 'auth.register', 'identity.verify']);

/** 간단한 고정 창 레이트 리밋(인증 계열). 다중 인스턴스 배포 시 Redis로 옮긴다. */
function rateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.reset < now) {
      hits.set(key, { n: 1, reset: now + windowMs });
      return true;
    }
    h.n += 1;
    return h.n <= limit;
  };
}

export function buildServer(store: Store, deps: Deps, config: Config): FastifyInstance {
  const app = Fastify({
    logger: config.production ? { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization'] } : false,
    bodyLimit: 256 * 1024,
    trustProxy: config.production,
  });
  const authLimit = rateLimiter(20, 60_000);

  void app.register(cookie);

  app.addHook('onSend', async (_req, reply) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('referrer-policy', 'strict-origin-when-cross-origin');
    reply.header('x-frame-options', 'DENY');
    reply.header('cache-control', 'no-store');
  });

  app.get('/api/health', async () => ({ ok: true }));
  app.get('/api/ops', async () => describeOperations());

  app.post<{ Params: { name: string }; Body: unknown }>('/api/rpc/:name', async (req, reply) => {
    const { name } = req.params;
    if (!Object.hasOwn(operations, name)) {
      return reply.code(404).send({ code: 'NOT_FOUND', message: `알 수 없는 작업: ${name}` });
    }
    // CSRF: 사용자 지정 헤더는 교차 출처에서 사전 요청 없이 보낼 수 없다. Origin도 허용 목록과 대조한다.
    if (req.headers['x-coco-csrf'] !== '1') {
      return reply.code(403).send({ code: 'FORBIDDEN', message: 'CSRF 헤더가 없습니다.' });
    }
    const origin = req.headers.origin;
    if (origin && !config.allowedOrigins.includes(origin)) {
      return reply.code(403).send({ code: 'FORBIDDEN', message: '허용되지 않은 출처입니다.' });
    }
    if (AUTH_OPS.has(name) && !authLimit(`${req.ip}:${name}`)) {
      return reply.code(429).send({ code: 'LIMIT_EXCEEDED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const sessionToken = req.cookies[COOKIE] ?? null;
    try {
      const data = (await execute(store, deps, name as keyof typeof operations, req.body ?? {}, { sessionToken })) as Record<string, unknown>;
      if (name === 'auth.login' || name === 'auth.register') {
        const { token, expiresAt, ...rest } = data as { token: string; expiresAt: string };
        reply.setCookie(COOKIE, token, {
          httpOnly: true,
          secure: config.cookieSecure,
          sameSite: 'lax',
          path: '/',
          expires: new Date(expiresAt),
        });
        return { data: rest };
      }
      if (name === 'auth.logout') reply.clearCookie(COOKIE, { path: '/' });
      return { data };
    } catch (err) {
      if (err instanceof DomainError) {
        return reply.code(HTTP_STATUS[err.code]).send({ code: err.code, message: err.message });
      }
      req.log.error(err);
      return reply.code(500).send({ code: 'INTERNAL', message: '일시적인 오류가 발생했습니다.' });
    }
  });

  return app;
}
