/**
 * @openapi
 * components:
 *   schemas:
 *     BusinessSettings:
 *       type: object
 *       properties:
 *         profile:
 *           type: object
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *             category: { type: string, nullable: true }
 *             phone: { type: string, nullable: true }
 *             email: { type: string, nullable: true }
 *             address: { type: string, nullable: true }
 *             logoUrl: { type: string, nullable: true }
 *             country: { type: string }
 *             status: { type: string, enum: [ACTIVE, SUSPENDED] }
 *         currency: { type: string, description: "ISO 4217 e.g. NGN" }
 *         tax:
 *           type: object
 *           properties:
 *             taxRateBps: { type: integer, description: "Basis points (0–10000)" }
 *             taxIdentifier: { type: string, nullable: true }
 *         receipt: { type: object, nullable: true, description: "Arbitrary receipt-config JSON" }
 *         units:
 *           type: array
 *           items: { $ref: '#/components/schemas/UnitOfMeasure' }
 *         categories:
 *           type: array
 *           items: { $ref: '#/components/schemas/Category' }
 *         stockAlerts:
 *           type: object
 *           properties:
 *             totalProducts: { type: integer }
 *             withMinStock: { type: integer }
 *             currentlyLow: { type: integer }
 *     ReceiptConfig:
 *       type: object
 *       properties:
 *         businessName: { type: string }
 *         logoUrl: { type: string }
 *         phone: { type: string }
 *         email: { type: string }
 *         address: { type: string }
 *         footer: { type: string }
 *         showTax: { type: boolean }
 *         taxIdentifier: { type: string }
 *     StockAlertSummary:
 *       type: object
 *       properties:
 *         totalProducts: { type: integer }
 *         lowStockCount: { type: integer }
 *         outOfStockCount: { type: integer }
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               productId: { type: string, format: uuid }
 *               name: { type: string }
 *               sku: { type: string }
 *               minStock: { type: integer }
 *               quantity: { type: integer }
 *     SecurityInfo:
 *       type: object
 *       properties:
 *         mfaEnabled: { type: boolean }
 *         activeSessionsCount: { type: integer }
 *         lastPasswordChange: { type: string, format: date-time, nullable: true }
 *
 * /settings:
 *   get:
 *     tags: [Settings]
 *     summary: Get all business settings (profile, currency, tax, receipt, units, categories, stock alerts)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Business settings bundle }
 *
 * /settings/profile:
 *   patch:
 *     tags: [Settings]
 *     summary: Update the business profile (delegates to business update)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               category: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               logoUrl: { type: string, format: uri }
 *     responses:
 *       200: { description: Profile updated }
 *
 * /settings/currency:
 *   patch:
 *     tags: [Settings]
 *     summary: Update the business currency
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currency]
 *             properties:
 *               currency: { type: string, description: "ISO 4217 e.g. NGN" }
 *     responses:
 *       200: { description: Currency updated }
 *
 * /settings/tax:
 *   patch:
 *     tags: [Settings]
 *     summary: Update tax rate (basis points) and tax identifier
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taxRateBps: { type: integer, minimum: 0, maximum: 10000 }
 *               taxIdentifier: { type: string }
 *     responses:
 *       200: { description: Tax settings updated }
 *
 * /settings/receipt:
 *   get:
 *     tags: [Settings]
 *     summary: Get receipt config (business name, logo, contact, footer, tax info)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Receipt config }
 *   patch:
 *     tags: [Settings]
 *     summary: Update receipt config JSON
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReceiptConfig' }
 *     responses:
 *       200: { description: Receipt config updated }
 *
 * /settings/stock-alerts:
 *   get:
 *     tags: [Settings]
 *     summary: Get low-stock thresholds (summary using product.minStock)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Stock-alert summary }
 *   patch:
 *     tags: [Settings]
 *     summary: Bulk update minStock for products
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [updates]
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, minStock]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     minStock: { type: integer, minimum: 0 }
 *     responses:
 *       200: { description: Bulk update result }
 *
 * /settings/security:
 *   get:
 *     tags: [Settings]
 *     summary: Get security info (MFA status, active sessions, last password change)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Security info }
 *
 * /settings/data-export:
 *   post:
 *     tags: [Settings]
 *     summary: Trigger a JSON data export of all business data
 *     description: Returns a JSON dump of products, sales, customers, suppliers, expenses and inventory. Money fields are stringified (BigInt cannot be JSON-serialised natively).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: JSON dump of business data }
 *
 * /settings/account:
 *   delete:
 *     tags: [Settings]
 *     summary: Request account (business) closure
 *     description: Marks the business as SUSPENDED with a closure note. Actual deletion is deferred until the retention period elapses. Audit logged.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Account closure requested }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { prisma } from '../../db/index.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import {
  validateBody,
  validateQuery,
} from '../../middleware/validate.js';
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';

// =====================================================
// Router setup
// =====================================================

export const settingsRouter = Router();

// All settings routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
settingsRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

/** Fire-and-forget audit log write. Never throws. */
function writeAudit(
  req: Request,
  opts: {
    action: string;
    resourceType: string;
    resourceId?: string;
    change?: unknown;
  },
) {
  const businessId = req.activeBusinessId;
  prisma.auditLog
    .create({
      data: {
        businessId: businessId ?? null,
        actorId: req.user?.id ?? null,
        adminActorId: req.user?.scope === 'admin' ? req.user.id : null,
        action: opts.action,
        resourceType: opts.resourceType,
        resourceId: opts.resourceId ?? null,
        change: (opts.change as any) ?? null,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    })
    .catch(() => {
      /* fire and forget — never throw from audit */
    });
}

/** Convert any BigInt fields in an object (or array of objects) to strings. */
function stringifyBigInts<T>(value: T): T {
  if (typeof value === 'bigint') return String(value) as unknown as T;
  if (Array.isArray(value)) return value.map(stringifyBigInts) as unknown as T;
  if (value && typeof value === 'object') {
    if (value instanceof Date) return value as unknown as T;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = stringifyBigInts(v);
    }
    return out as unknown as T;
  }
  return value;
}

// =====================================================
// Schemas
// =====================================================

const UpdateProfileSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().max(80).optional().nullable(),
  phone: z.string().min(6).max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

const UpdateCurrencySchema = z.object({
  currency: z.string().min(3).max(3),
});

const UpdateTaxSchema = z.object({
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  taxIdentifier: z.string().max(80).optional().nullable(),
});

const UpdateReceiptSchema = z
  .object({
    businessName: z.string().max(120).optional(),
    logoUrl: z.string().url().optional().nullable(),
    phone: z.string().max(40).optional().nullable(),
    email: z.string().email().optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    footer: z.string().max(500).optional().nullable(),
    showTax: z.boolean().optional(),
    taxIdentifier: z.string().max(80).optional().nullable(),
  })
  .passthrough(); // allow arbitrary additional keys

const StockAlertsQuerySchema = z.object({
  branchId: z.string().uuid().optional(),
});

const UpdateStockAlertsSchema = z.object({
  updates: z
    .array(
      z.object({
        productId: z.string().uuid(),
        minStock: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(1000),
});

const AccountClosureSchema = z.object({
  reason: z.string().min(3).max(1000),
});

// =====================================================
// 1. GET /settings — get all business settings
// =====================================================
settingsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;

    const [business, units, categories, lowStockCount, outOfStockCount, totalProducts] =
      await Promise.all([
        prisma.business.findUnique({
          where: { id: bizId },
          select: {
            id: true,
            name: true,
            category: true,
            phone: true,
            email: true,
            address: true,
            logoUrl: true,
            country: true,
            currency: true,
            taxIdentifier: true,
            taxRateBps: true,
            receiptConfig: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.unitOfMeasure.findMany({ where: { businessId: bizId } }),
        prisma.category.findMany({ where: { businessId: bizId } }),
        prisma.product.count({ where: { businessId: bizId, minStock: { gt: 0 } } }),
        prisma.product.count({ where: { businessId: bizId, minStock: 0 } }),
        prisma.product.count({ where: { businessId: bizId, status: 'ACTIVE' } }),
      ]);

    if (!business) return sendError(res, Errors.notFound('Business not found'));

    return sendSuccess(
      res,
      {
        profile: {
          id: business.id,
          name: business.name,
          category: business.category,
          phone: business.phone,
          email: business.email,
          address: business.address,
          logoUrl: business.logoUrl,
          country: business.country,
          status: business.status,
          createdAt: business.createdAt,
          updatedAt: business.updatedAt,
        },
        currency: business.currency,
        tax: {
          taxRateBps: business.taxRateBps,
          taxIdentifier: business.taxIdentifier,
        },
        receipt: business.receiptConfig,
        units,
        categories,
        stockAlerts: {
          totalProducts,
          withMinStock: lowStockCount,
          outOfStockCount,
          currentlyLow: outOfStockCount,
        },
      },
      'OK',
    );
  }),
);

// =====================================================
// 2. PATCH /settings/profile — update business profile
// =====================================================
settingsRouter.patch(
  '/profile',
  requirePermission('settings:manage'),
  validateBody(UpdateProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof UpdateProfileSchema>;

    const updated = await prisma.business.update({
      where: { id: bizId },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      },
    });

    writeAudit(req, {
      action: 'settings.profile.update',
      resourceType: 'business',
      resourceId: bizId,
      change: body,
    });

    return sendSuccess(res, updated, 'Profile updated');
  }),
);

// =====================================================
// 3. PATCH /settings/currency — update currency
// =====================================================
settingsRouter.patch(
  '/currency',
  requirePermission('settings:manage'),
  validateBody(UpdateCurrencySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { currency } = req.body as z.infer<typeof UpdateCurrencySchema>;

    const updated = await prisma.business.update({
      where: { id: bizId },
      data: { currency },
      select: { id: true, currency: true },
    });

    writeAudit(req, {
      action: 'settings.currency.update',
      resourceType: 'business',
      resourceId: bizId,
      change: { currency },
    });

    return sendSuccess(res, updated, 'Currency updated');
  }),
);

// =====================================================
// 4. PATCH /settings/tax — update taxRateBps + taxIdentifier
// =====================================================
settingsRouter.patch(
  '/tax',
  requirePermission('settings:manage'),
  validateBody(UpdateTaxSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof UpdateTaxSchema>;

    const updated = await prisma.business.update({
      where: { id: bizId },
      data: {
        ...(body.taxRateBps !== undefined ? { taxRateBps: body.taxRateBps } : {}),
        ...(body.taxIdentifier !== undefined ? { taxIdentifier: body.taxIdentifier } : {}),
      },
      select: { id: true, taxRateBps: true, taxIdentifier: true },
    });

    writeAudit(req, {
      action: 'settings.tax.update',
      resourceType: 'business',
      resourceId: bizId,
      change: body,
    });

    return sendSuccess(res, updated, 'Tax settings updated');
  }),
);

// =====================================================
// 5. GET /settings/receipt — get receipt config
// =====================================================
settingsRouter.get(
  '/receipt',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const biz = await prisma.business.findUnique({
      where: { id: bizId },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        phone: true,
        email: true,
        address: true,
        taxIdentifier: true,
        receiptConfig: true,
      },
    });
    if (!biz) return sendError(res, Errors.notFound('Business not found'));

    // Merge stored receiptConfig (if any) with the canonical fields so the
    // client always gets a complete payload.
    const stored = (biz.receiptConfig as Record<string, unknown> | null) ?? {};
    return sendSuccess(
      res,
      {
        businessName: stored.businessName ?? biz.name,
        logoUrl: stored.logoUrl ?? biz.logoUrl,
        phone: stored.phone ?? biz.phone,
        email: stored.email ?? biz.email,
        address: stored.address ?? biz.address,
        footer: stored.footer ?? null,
        showTax: stored.showTax ?? false,
        taxIdentifier: stored.taxIdentifier ?? biz.taxIdentifier,
      },
      'OK',
    );
  }),
);

// =====================================================
// 6. PATCH /settings/receipt — update receipt config JSON
// =====================================================
settingsRouter.patch(
  '/receipt',
  requirePermission('settings:manage'),
  validateBody(UpdateReceiptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof UpdateReceiptSchema>;

    // Merge into existing config (don't blow away keys the client didn't send).
    const existing = await prisma.business.findUnique({
      where: { id: bizId },
      select: { receiptConfig: true },
    });
    const current = (existing?.receiptConfig as Record<string, unknown> | null) ?? {};
    const next = { ...current, ...body };

    const updated = await prisma.business.update({
      where: { id: bizId },
      data: { receiptConfig: next as any },
      select: { id: true, receiptConfig: true },
    });

    writeAudit(req, {
      action: 'settings.receipt.update',
      resourceType: 'business',
      resourceId: bizId,
      change: body,
    });

    return sendSuccess(res, updated, 'Receipt config updated');
  }),
);

// =====================================================
// 7. GET /settings/stock-alerts — get low-stock thresholds summary
// =====================================================
settingsRouter.get(
  '/stock-alerts',
  validateQuery(StockAlertsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { branchId } = req.query as z.infer<typeof StockAlertsQuerySchema>;

    // Active products + their minStock threshold + current balance (by branch).
    const products = await prisma.product.findMany({
      where: { businessId: bizId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        sku: true,
        minStock: true,
        balances: {
          where: branchId ? { branchId } : undefined,
          select: { quantity: true },
        },
      },
    });

    const items = products.map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      minStock: p.minStock,
      quantity: p.balances.reduce((acc, b) => acc + b.quantity, 0),
    }));

    const lowStockCount = items.filter((i) => i.minStock > 0 && i.quantity <= i.minStock).length;
    const outOfStockCount = items.filter((i) => i.quantity === 0).length;

    return sendSuccess(
      res,
      {
        totalProducts: products.length,
        lowStockCount,
        outOfStockCount,
        items,
      },
      'OK',
    );
  }),
);

// =====================================================
// 8. PATCH /settings/stock-alerts — bulk update minStock
// =====================================================
settingsRouter.patch(
  '/stock-alerts',
  requirePermission('settings:manage'),
  validateBody(UpdateStockAlertsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof UpdateStockAlertsSchema>;

    // Validate all products belong to this business.
    const productIds = Array.from(new Set(body.updates.map((u) => u.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId: bizId },
      select: { id: true, minStock: true, name: true },
    });
    const foundIds = new Set(products.map((p) => p.id));
    const missing = productIds.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      return sendError(
        res,
        Errors.badRequest(
          `Products not found in this business: ${missing.join(', ')}`,
          'PRODUCT_NOT_FOUND',
        ),
      );
    }

    const results = await Promise.all(
      body.updates.map((u) =>
        prisma.product
          .update({
            where: { id: u.productId },
            data: { minStock: u.minStock },
            select: { id: true, name: true, minStock: true },
          })
          .then((p) => ({ success: true as const, ...p }))
          .catch((err) => ({
            success: false as const,
            productId: u.productId,
            error: err instanceof Error ? err.message : String(err),
          })),
      ),
    );

    const updated = results.filter((r) => r.success).length;
    const failed = results.length - updated;

    writeAudit(req, {
      action: 'settings.stock_alerts.update',
      resourceType: 'product',
      resourceId: bizId,
      change: { count: body.updates.length, updated, failed },
    });

    return sendSuccess(res, { updated, failed, results }, 'Stock alerts updated');
  }),
);

// =====================================================
// 9. GET /settings/security — security info
// =====================================================
settingsRouter.get(
  '/security',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { mfaSecret: true, updatedAt: true },
    });
    if (!user) return sendError(res, Errors.notFound('User not found'));

    const [activeSessions, lastPwAudit] = await Promise.all([
      prisma.session.count({
        where: { userId: req.user.id, revokedAt: null },
      }),
      prisma.auditLog.findFirst({
        where: {
          actorId: req.user.id,
          action: { in: ['auth.password_change', 'user.password_change'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    return sendSuccess(
      res,
      {
        mfaEnabled: !!user.mfaSecret,
        activeSessionsCount: activeSessions,
        lastPasswordChange: lastPwAudit?.createdAt ?? null,
      },
      'OK',
    );
  }),
);

// =====================================================
// 10. POST /settings/data-export — JSON dump of business data
// =====================================================
settingsRouter.post(
  '/data-export',
  requirePermission('settings:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;

    const [products, sales, customers, suppliers, expenses, inventory] = await Promise.all([
      prisma.product.findMany({
        where: { businessId: bizId },
        include: { category: true, unit: true },
      }),
      prisma.sale.findMany({
        where: { businessId: bizId },
        include: { items: true, payments: true },
        take: 5000,
      }),
      prisma.customer.findMany({ where: { businessId: bizId } }),
      prisma.supplier.findMany({ where: { businessId: bizId } }),
      prisma.expense.findMany({ where: { businessId: bizId } }),
      prisma.inventoryBalance.findMany({ where: { businessId: bizId } }),
    ]);

    writeAudit(req, {
      action: 'settings.data_export',
      resourceType: 'business',
      resourceId: bizId,
      change: {
        products: products.length,
        sales: sales.length,
        customers: customers.length,
        suppliers: suppliers.length,
        expenses: expenses.length,
        inventory: inventory.length,
      },
    });

    // BigInt fields cannot be JSON-serialised natively — stringify them.
    return sendSuccess(
      res,
      stringifyBigInts({
        exportedAt: new Date(),
        businessId: bizId,
        products,
        sales,
        customers,
        suppliers,
        expenses,
        inventory,
      }),
      'OK',
    );
  }),
);

// =====================================================
// 11. DELETE /settings/account — request account closure
// =====================================================
settingsRouter.delete(
  '/account',
  requirePermission('settings:manage'),
  validateBody(AccountClosureSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { reason } = req.body as z.infer<typeof AccountClosureSchema>;

    // Suspend the business with a closure note. Actual deletion is deferred
    // until the retention period elapses (handled by a separate cleanup job).
    const updated = await prisma.business.update({
      where: { id: bizId },
      data: {
        status: 'SUSPENDED',
        suspendedAt: new Date(),
      },
      select: { id: true, status: true, suspendedAt: true },
    });

    // Revoke all sessions for every member of this business, forcing re-login
    // (they will be unable to log back in until reactivation).
    const members = await prisma.businessMember.findMany({
      where: { businessId: bizId },
      select: { userId: true },
    });
    if (members.length > 0) {
      await prisma.session.updateMany({
        where: { userId: { in: members.map((m) => m.userId) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await prisma.refreshToken.updateMany({
        where: { userId: { in: members.map((m) => m.userId) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    writeAudit(req, {
      action: 'settings.account.close',
      resourceType: 'business',
      resourceId: bizId,
      change: { reason },
    });

    return sendSuccess(
      res,
      {
        ...updated,
        closureReason: reason,
        message:
          'Account closure requested. The business is now suspended. Data will be permanently deleted after the retention period.',
      },
      'Account closure requested',
    );
  }),
);
