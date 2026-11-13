import { createApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './db/index.js';
import { seedRbac } from './utils/rbac.js';
import { seedPlans } from './modules/subscriptions/seed.js';
import { seedAdminUser } from './modules/admin/seed.js';

async function bootstrap() {
  // Catch unhandled rejections / errors so they actually surface
  process.on('unhandledRejection', (err) => {
    console.error('[fatal] unhandledRejection:', err);
    process.exit(1);
  });
  process.on('uncaughtException', (err) => {
    console.error('[fatal] uncaughtException:', err);
    process.exit(1);
  });

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
  console.log('[seed] starting RBAC seed...');
  await seedRbac().catch((e) => console.warn('[seed] rbac skipped:', (e as Error).message));
  console.log('[seed] starting plans seed...');
  await seedPlans().catch((e) => console.warn('[seed] plans skipped:', (e as Error).message));
  console.log('[seed] starting admin seed...');
  await seedAdminUser().catch((e) => console.warn('[seed] admin skipped:', (e as Error).message));
  console.log('[seed] complete');

  const app = createApp();
  const server = app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[${config.appName}] API listening on http://localhost:${config.port}${config.apiPrefix}`);
    // eslint-disable-next-line no-console
    console.log(`[docs] Swagger UI: http://localhost:${config.port}/docs and http://localhost:${config.port}/api-docs`);
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
