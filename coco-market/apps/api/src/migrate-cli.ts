import { loadConfig } from './config';
import { connect } from './db';
import { migrate } from './migrate';

const { pool } = connect(loadConfig().databaseUrl);
await migrate(pool, console.log);
await pool.end();
