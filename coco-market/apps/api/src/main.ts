import { buildDeps, loadConfig } from './config';
import { connect } from './db';
import { migrate } from './migrate';
import { buildServer } from './server';

const config = loadConfig();
const deps = buildDeps();
const { pool, store } = connect(config.databaseUrl);
await migrate(pool, (m) => console.log(`[migrate] ${m}`));

const app = buildServer(store, deps, config);
if (config.webDist) {
  const { default: fastifyStatic } = await import('@fastify/static');
  await app.register(fastifyStatic, { root: config.webDist });
}
await app.listen({ port: config.port, host: config.host });
console.log(`CO-CO Market API on http://${config.host}:${config.port}`);

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
