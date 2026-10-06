import { seedDemo } from '@coco/core';
import { buildDeps, loadConfig } from './config';
import { connect } from './db';
import { migrate } from './migrate';

// 개발용 데모 데이터. 비어 있는 DB에서만 실행한다.
const { pool, store } = connect(loadConfig().databaseUrl);
await migrate(pool);
const existing = await pool.query('SELECT count(*)::int AS n FROM users');
if (existing.rows[0].n > 0) {
  console.log('이미 데이터가 있어 시드를 건너뜁니다.');
} else {
  await seedDemo(store, buildDeps());
  console.log('데모 데이터를 넣었습니다. 비밀번호: coco-demo-2026');
}
await pool.end();
