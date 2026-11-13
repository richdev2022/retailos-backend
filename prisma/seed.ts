/**
 * Idempotent seed script for RetailOS.
 * Run with `npm run seed` (configured as prisma.seed in package.json).
 *
 * Seeds:
 *   - RBAC: system permissions + role templates (BUSINESS_OWNER, BUSINESS_ADMIN, MANAGER,
 *     CASHIER, INVENTORY_OFFICER, ACCOUNTANT, SUPER_ADMIN, OPS_ADMIN, SUPPORT_ADMIN,
 *     FINANCE_ADMIN)
 *   - Subscription plans: free, pro, business, enterprise (PRD section 9)
 *   - Default super-admin user (admin@retailos.local / ChangeMe!2025)
 */
import { PrismaClient } from '@prisma/client';
import { seedRbac } from '../src/utils/rbac.js';
import { seedPlans } from '../src/modules/subscriptions/seed.js';
import { seedAdminUser } from '../src/modules/admin/seed.js';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Seeding RetailOS ===');
  console.log('[1/3] RBAC (permissions + role templates)...');
  await seedRbac();
  console.log('[2/3] Subscription plans...');
  await seedPlans();
  console.log('[3/3] Default admin user...');
  await seedAdminUser();
  console.log('=== Seed complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
