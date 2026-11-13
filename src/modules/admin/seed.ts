/**
 * Admin seed — idempotently ensures a default super-admin exists if
 * `PlatformConfig.admin_users` is empty.
 *
 * Behaviour:
 * - Default email: `admin@retailos.local` (overridable via `ADMIN_EMAIL` env).
 * - Default password: `ChangeMe!2025` (overridable via `ADMIN_PASSWORD` env).
 * - If `PlatformConfig.admin_users` already contains one or more user ids,
 *   this function returns immediately (idempotent).
 * - Otherwise it creates the default admin User (if missing), adds the user
 *   id to `PlatformConfig.admin_users`, and records the SUPER_ADMIN role
 *   membership in `PlatformConfig.admin_user_roles` (a JSON map of
 *   `userId -> [AdminRoleCode]`).
 *
 * Why `PlatformConfig` for role memberships?
 *   The `BusinessMember` table requires a non-null `businessId`, so it cannot
 *   represent platform-scoped admin memberships. We therefore store admin
 *   role memberships in `PlatformConfig` as a JSON document — this keeps the
 *   bootstrap atomic, avoids schema changes, and is consumed by the
 *   `/admin/auth/me` endpoint to surface admin role info.
 *
 * Safe to call on every boot.
 */
import { prisma } from '../../db/index.js';
import { hashPassword } from '../../utils/password.js';

const DEFAULT_ADMIN_EMAIL = 'admin@retailos.local';
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe!2025';
const DEFAULT_ADMIN_FULL_NAME = 'Platform Super Admin';

const ADMIN_USERS_KEY = 'admin_users';
const ADMIN_USER_ROLES_KEY = 'admin_user_roles';

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Idempotently ensure a default super-admin user exists.
 *
 * @returns the user id of the ensured admin (existing or newly created).
 */
export async function seedAdminUser(): Promise<string> {
  const adminEmail = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const adminFullName = process.env.ADMIN_FULL_NAME || DEFAULT_ADMIN_FULL_NAME;

  // 1. Check existing admin_users list — idempotent
  const adminConfig = await prisma.platformConfig.findUnique({
    where: { key: ADMIN_USERS_KEY },
  });
  const adminUserIds: string[] = adminConfig
    ? safeJsonParse<string[]>(adminConfig.value, [])
    : [];

  if (adminUserIds.length > 0) {
    // Already has admins — nothing to seed.
    return adminUserIds[0];
  }

  // 2. Find or create the default admin user
  let user = await prisma.user.findFirst({
    where: { OR: [{ email: adminEmail }, { phone: adminEmail }] },
  });

  if (!user) {
    const passwordHash = await hashPassword(adminPassword);
    user = await prisma.user.create({
      data: {
        fullName: adminFullName,
        email: adminEmail,
        phone: null,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      },
    });
  } else if (user.status !== 'ACTIVE') {
    // Ensure existing user is active.
    user = await prisma.user.update({
      where: { id: user.id },
      data: { status: 'ACTIVE' },
    });
  }

  // 3. Add user.id to PlatformConfig.admin_users JSON list
  if (!adminConfig) {
    await prisma.platformConfig.create({
      data: { key: ADMIN_USERS_KEY, value: JSON.stringify([user.id]) },
    });
  } else {
    await prisma.platformConfig.update({
      where: { key: ADMIN_USERS_KEY },
      data: { value: JSON.stringify([user.id]) },
    });
  }

  // 4. Record admin role membership (SUPER_ADMIN for the default user)
  const rolesConfig = await prisma.platformConfig.findUnique({
    where: { key: ADMIN_USER_ROLES_KEY },
  });
  const memberships: Record<string, string[]> = rolesConfig
    ? safeJsonParse<Record<string, string[]>>(rolesConfig.value, {})
    : {};

  const existingRoles = new Set(memberships[user.id] ?? []);
  if (!existingRoles.has('SUPER_ADMIN')) {
    existingRoles.add('SUPER_ADMIN');
    memberships[user.id] = Array.from(existingRoles);

    if (!rolesConfig) {
      await prisma.platformConfig.create({
        data: { key: ADMIN_USER_ROLES_KEY, value: JSON.stringify(memberships) },
      });
    } else {
      await prisma.platformConfig.update({
        where: { key: ADMIN_USER_ROLES_KEY },
        data: { value: JSON.stringify(memberships) },
      });
    }
  }

  return user.id;
}
