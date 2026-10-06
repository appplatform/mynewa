import { insecureDemoHasher, mockAnchor, mockIdentity, mockPayments, type Deps } from '@coco/core';
import { randomUUID } from 'node:crypto';
import { connect } from '../src/db';
import { migrate } from '../src/migrate';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgresql://coco:coco@localhost:5432/coco_test';

export async function freshDb() {
  const conn = connect(TEST_DB);
  await conn.pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await migrate(conn.pool);
  return conn;
}

export function testDeps(): Deps {
  return {
    clock: () => new Date(),
    ids: () => randomUUID(),
    hasher: insecureDemoHasher,
    payments: mockPayments,
    identity: mockIdentity,
    anchor: mockAnchor,
    termsVersion: 'v1.0-test',
    membershipFeeKrw: 200_000,
  };
}
