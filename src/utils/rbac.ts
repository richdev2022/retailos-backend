import { prisma } from '../db/index.js';
import type { Tx } from '../db/index.js';

/**
 * Permission codes. Each business role can be granted a subset.
 * Format: module:action
 */
export const PERM = {
  // dashboard
  DASHBOARD_VIEW: 'dashboard:view',
  // products
  PRODUCT_VIEW: 'product:view',
  PRODUCT_CREATE: 'product:create',
  PRODUCT_EDIT: 'product:edit',
  PRODUCT_ARCHIVE: 'product:archive',
  PRICE_EDIT: 'product:edit_price',
  // inventory
  STOCK_VIEW: 'stock:view',
  STOCK_IN: 'stock:in',
  STOCK_OUT: 'stock:out',
  STOCK_ADJUST: 'stock:adjust',
  MOVEMENT_VIEW: 'stock:movements',
  // pos / sales
  SALE_VIEW: 'sale:view',
  SALE_PROCESS: 'sale:process',
  SALE_CANCEL: 'sale:cancel',
  SALE_REFUND: 'sale:refund',
  // expenses
  EXPENSE_VIEW: 'expense:view',
  EXPENSE_MANAGE: 'expense:manage',
  // reports / finance
  REPORT_VIEW: 'report:view',
  PROFIT_VIEW: 'profit:view',
  // customers / suppliers
  CUSTOMER_VIEW: 'customer:view',
  CUSTOMER_MANAGE: 'customer:manage',
  SUPPLIER_VIEW: 'supplier:view',
  SUPPLIER_MANAGE: 'supplier:manage',
  // purchases
  PURCHASE_VIEW: 'purchase:view',
  PURCHASE_MANAGE: 'purchase:manage',
  // staff
  STAFF_VIEW: 'staff:view',
  STAFF_MANAGE: 'staff:manage',
  // branches
  BRANCH_VIEW: 'branch:view',
  BRANCH_MANAGE: 'branch:manage',
  TRANSFER_MANAGE: 'transfer:manage',
  // subscription
  SUBSCRIPTION_MANAGE: 'subscription:manage',
  // settings
  SETTINGS_MANAGE: 'settings:manage',
} as const;

export type PermCode = keyof typeof PERM;

/** Pre-defined role templates for a business. */
export const BUSINESS_ROLE_TEMPLATES = {
  BUSINESS_OWNER: {
    name: 'Business Owner',
    description: 'Full control of the business',
    permissions: Object.values(PERM) as string[],
  },
  BUSINESS_ADMIN: {
    name: 'Business Admin',
    description: 'Day-to-day business operations',
    permissions: Object.values(PERM).filter((p) => p !== PERM.SUBSCRIPTION_MANAGE),
  },
  MANAGER: {
    name: 'Manager',
    description: 'Manages products, inventory, sales and staff',
    permissions: [
      PERM.DASHBOARD_VIEW,
      PERM.PRODUCT_VIEW, PERM.PRODUCT_CREATE, PERM.PRODUCT_EDIT, PERM.PRICE_EDIT,
      PERM.STOCK_VIEW, PERM.STOCK_IN, PERM.STOCK_OUT, PERM.STOCK_ADJUST, PERM.MOVEMENT_VIEW,
      PERM.SALE_VIEW, PERM.SALE_PROCESS, PERM.SALE_CANCEL, PERM.SALE_REFUND,
      PERM.EXPENSE_VIEW, PERM.EXPENSE_MANAGE,
      PERM.REPORT_VIEW, PERM.PROFIT_VIEW,
      PERM.CUSTOMER_VIEW, PERM.CUSTOMER_MANAGE,
      PERM.SUPPLIER_VIEW, PERM.SUPPLIER_MANAGE,
      PERM.PURCHASE_VIEW, PERM.PURCHASE_MANAGE,
      PERM.STAFF_VIEW, PERM.STAFF_MANAGE,
      PERM.BRANCH_VIEW, PERM.BRANCH_MANAGE, PERM.TRANSFER_MANAGE,
    ],
  },
  CASHIER: {
    name: 'Cashier',
    description: 'Processes sales and issues receipts',
    permissions: [
      PERM.DASHBOARD_VIEW,
      PERM.PRODUCT_VIEW,
      PERM.STOCK_VIEW,
      PERM.SALE_VIEW, PERM.SALE_PROCESS,
      PERM.CUSTOMER_VIEW,
      PERM.BRANCH_VIEW,
    ],
  },
  INVENTORY_OFFICER: {
    name: 'Inventory Officer',
    description: 'Registers products and handles stock operations',
    permissions: [
      PERM.DASHBOARD_VIEW,
      PERM.PRODUCT_VIEW, PERM.PRODUCT_CREATE,
      PERM.STOCK_VIEW, PERM.STOCK_IN, PERM.STOCK_OUT, PERM.MOVEMENT_VIEW,
      PERM.SUPPLIER_VIEW,
      PERM.PURCHASE_VIEW,
      PERM.BRANCH_VIEW,
    ],
  },
  ACCOUNTANT: {
    name: 'Accountant',
    description: 'Views financial records, expenses and reports',
    permissions: [
      PERM.DASHBOARD_VIEW,
      PERM.PRODUCT_VIEW,
      PERM.STOCK_VIEW, PERM.MOVEMENT_VIEW,
      PERM.SALE_VIEW,
      PERM.EXPENSE_VIEW, PERM.EXPENSE_MANAGE,
      PERM.REPORT_VIEW, PERM.PROFIT_VIEW,
      PERM.CUSTOMER_VIEW, PERM.SUPPLIER_VIEW,
      PERM.PURCHASE_VIEW,
      PERM.BRANCH_VIEW,
    ],
  },
} as const;

export type BusinessRoleCode = keyof typeof BUSINESS_ROLE_TEMPLATES;

/** Admin portal roles (separate scope). */
export const ADMIN_ROLE_TEMPLATES = {
  SUPER_ADMIN: {
    name: 'Super Administrator',
    description: 'Full platform control',
    permissions: ['admin:*'],
  },
  OPS_ADMIN: {
    name: 'Operations Administrator',
    description: 'Manage businesses, users and platform operations',
    permissions: ['admin:business', 'admin:user', 'admin:config', 'admin:support'],
  },
  SUPPORT_ADMIN: {
    name: 'Customer Support Administrator',
    description: 'Handle support tickets and basic user assistance',
    permissions: ['admin:support', 'admin:user:read'],
  },
  FINANCE_ADMIN: {
    name: 'Finance / Subscription Administrator',
    description: 'Review and approve subscription payments',
    permissions: ['admin:subscription', 'admin:payment:review'],
  },
} as const;

export type AdminRoleCode = keyof typeof ADMIN_ROLE_TEMPLATES;

// ---------- DB helpers ----------

/** Seed system roles & permissions (idempotent). Called on first boot. */
export async function seedRbac(tx?: Tx) {
  const db = tx ?? prisma;
  // 1. Permissions
  const moduleOf = (code: string) => code.split(':')[0];
  for (const code of Object.values(PERM)) {
    await db.permission.upsert({
      where: { code },
      update: {},
      create: { code, module: moduleOf(code), description: code },
    });
  }

  // 2. Business role templates
  for (const [code, tpl] of Object.entries(BUSINESS_ROLE_TEMPLATES)) {
    const role =
      (await db.role.findFirst({ where: { name: tpl.name, businessId: null } })) ??
      (await db.role.create({
        data: {
          id: `tpl_${code}`,
          name: tpl.name,
          description: tpl.description,
          scope: 'BUSINESS',
          isSystem: true,
        },
      }));
    // sync permissions
    const perms = await db.permission.findMany({ where: { code: { in: [...tpl.permissions] as string[] } } });
    for (const p of perms) {
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      }).catch(() => {/* ignore dup */});
    }
  }

  // 3. Admin role templates
  for (const [code, tpl] of Object.entries(ADMIN_ROLE_TEMPLATES)) {
    const existing = await db.role.findFirst({ where: { name: tpl.name, scope: 'ADMIN' } });
    const role = existing ?? await db.role.create({
      data: {
        id: `tpl_admin_${code}`,
        name: tpl.name,
        description: tpl.description,
        scope: 'ADMIN',
        isSystem: true,
      },
    });
    // admin perms aren't in the permission table; use a synthetic entry
    for (const code2 of tpl.permissions) {
      const p = await db.permission.upsert({
        where: { code: code2 },
        update: {},
        create: { code: code2, module: 'admin', description: code2 },
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
        update: {},
        create: { roleId: role.id, permissionId: p.id },
      }).catch(() => {});
    }
  }
}

/** Get all permission codes for a role (including via role_permissions join). */
export async function getRolePermissions(roleId: string, tx?: Tx): Promise<Set<string>> {
  const db = tx ?? prisma;
  const rows = await db.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return new Set(rows.map((r) => r.permission.code));
}

/** Check user has permission in the active business context. */
export async function userHasPermission(
  userId: string,
  businessId: string,
  permCode: string,
  tx?: Tx,
): Promise<boolean> {
  const db = tx ?? prisma;
  const member = await db.businessMember.findUnique({
    where: { businessId_userId: { businessId, userId } },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!member) return false;
  const codes = member.role.permissions.map((rp) => rp.permission.code);
  // owner role gets all
  return codes.includes(permCode) || codes.includes('admin:*') || codes.some((c) => c.endsWith(':*') && permCode.startsWith(c.slice(0, -1)));
}
