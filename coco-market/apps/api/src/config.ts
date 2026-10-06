import { mockAnchor, mockIdentity, mockPayments, type Deps } from '@coco/core';
import { randomUUID } from 'node:crypto';
import { scryptHasher } from './hasher';

export interface Config {
  databaseUrl: string;
  port: number;
  host: string;
  production: boolean;
  cookieSecure: boolean;
  allowedOrigins: string[];
  webDist: string | null;
}

export function loadConfig(env = process.env): Config {
  const production = env.NODE_ENV === 'production';
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgresql://coco:coco@localhost:5432/coco_dev',
    port: Number(env.PORT ?? 4000),
    host: env.HOST ?? '127.0.0.1',
    production,
    cookieSecure: production || env.COOKIE_SECURE === 'true',
    allowedOrigins: (env.ALLOWED_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
    webDist: env.WEB_DIST ?? null,
  };
}

/**
 * 외부 연동 어댑터 조립. 실제 PG·본인확인·체인 계약 전에는 Mock만 있다.
 * 운영 환경에서 Mock으로 뜨는 사고를 막기 위해 ALLOW_MOCK_ADAPTERS=true 없이는 시작을 거부한다.
 */
export function buildDeps(env = process.env): Deps {
  if (env.NODE_ENV === 'production' && env.ALLOW_MOCK_ADAPTERS !== 'true') {
    throw new Error('운영 환경에서 Mock 어댑터(PG·본인확인·체인)로 시작할 수 없습니다. 실제 어댑터를 연결하거나 ALLOW_MOCK_ADAPTERS=true를 명시하세요.');
  }
  return {
    clock: () => new Date(),
    ids: () => randomUUID(),
    hasher: scryptHasher,
    payments: mockPayments,
    identity: mockIdentity,
    anchor: mockAnchor,
    termsVersion: env.TERMS_VERSION ?? 'v1.0-draft',
    membershipFeeKrw: Number(env.MEMBERSHIP_FEE_KRW ?? 200_000),
  };
}
