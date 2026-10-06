import { seedDemo } from '@coco/core';
import { afterAll, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';
import { buildServer } from '../src/server';
import { freshDb, testDeps } from './setup';

const conn = await freshDb();
const deps = testDeps();
await seedDemo(conn.store, deps);
const app = buildServer(conn.store, deps, { ...loadConfig({}), allowedOrigins: ['http://localhost:5173'] });
afterAll(async () => { await app.close(); await conn.pool.end(); });

const rpc = (name: string, body: unknown, headers: Record<string, string> = {}) =>
  app.inject({ method: 'POST', url: `/api/rpc/${name}`, payload: body as object, headers: { 'x-coco-csrf': '1', ...headers } });

describe('HTTP API', () => {
  it('로그인은 HttpOnly 쿠키를 주고, 응답 본문에 토큰을 싣지 않는다', async () => {
    const res = await rpc('auth.login', { email: 'buyer@coco.demo', password: 'coco-demo-2026' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.token).toBeUndefined();
    const set = String(res.headers['set-cookie']);
    expect(set).toMatch(/coco_session=/);
    expect(set).toMatch(/HttpOnly/i);
    const cookie = set.split(';')[0]!;
    const me = await rpc('auth.me', {}, { cookie });
    expect(me.json().data.user.email).toBe('buyer@coco.demo');
  });

  it('CSRF 헤더나 허용된 Origin이 없으면 거절', async () => {
    const noHeader = await app.inject({ method: 'POST', url: '/api/rpc/auth.me', payload: {} });
    expect(noHeader.statusCode).toBe(403);
    const badOrigin = await rpc('auth.me', {}, { origin: 'https://evil.example' });
    expect(badOrigin.statusCode).toBe(403);
  });

  it('도메인 오류는 코드와 상태값으로 매핑된다', async () => {
    const res = await rpc('license.mine', {});
    expect(res.statusCode).toBe(401);
    expect(res.json().code).toBe('UNAUTHENTICATED');
    const bad = await rpc('catalog.getIp', { ipId: '' });
    expect(bad.statusCode).toBe(400);
  });

  it('공개 목록은 로그인 없이 볼 수 있다', async () => {
    const res = await rpc('catalog.listIps', {});
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThanOrEqual(3);
  });

  it('알 수 없는 작업은 404', async () => {
    const res = await rpc('lu.trade', {});
    expect(res.statusCode).toBe(404);
  });
});
