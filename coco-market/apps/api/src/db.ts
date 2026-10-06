import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { PgStore } from './pg-store';

export function connect(databaseUrl: string) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 10 });
  const db = drizzle(pool);
  return { pool, db, store: new PgStore(db) };
}
