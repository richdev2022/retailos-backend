import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './db/index.js';
import { seedRbac } from './utils/rbac.js';
import { seedPlans } from './modules/subscriptions/seed.js';
import { seedAdminUser } from './modules/admin/seed.js';

async function bootstrap() {
  // Verify DB connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    // eslint-disable-next-line no-console
    console.log('[db] connected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[db] connection failed:', (err as Error).message);
    process.exit(1);
  }

  // Seed RBAC + plans + first admin (idempotent)
  await seedRbac().catch((e) => console.warn('[seed] rbac skipped:', (e as Error).message));
  await seedPlans().catch((e) => console.warn('[seed] plans skipped:', (e as Error).message));
  await seedAdminUser().catch((e) => console.warn('[seed] admin skipped:', (e as Error).message));

  const app = createApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[${config.appName}] API listening on http://localhost:${config.port}${config.apiPrefix}`);
    // eslint-disable-next-line no-console
    console.log(`[docs] http://localhost:${config.port}/docs`);
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n[${signal}] shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
