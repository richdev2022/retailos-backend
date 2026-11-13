import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';
import { Errors, asyncHandler, sendSuccess, sendError } from '../../utils/errors.js';
import { validateBody } from '../../middleware/validate.js';
import { requirePermission } from '../../middleware/auth.js';
import { BUSINESS_ROLE_TEMPLATES, seedRbac } from '../../utils/rbac.js';
import { audit } from '../../middleware/audit.js';

export const businessRouter = Router();

// =====================================================
// POST /businesses — create new business for the current user (owner)
// =====================================================
const CreateBusinessSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().max(80).optional().nullable(),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional().nullable(),
  country: z.string().max(2).default('NG'),
  currency: z.string().max(3).default('NGN'),
  address: z.string().max(500).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  taxIdentifier: z.string().max(80).optional().nullable(),
  taxRateBps: z.number().int().min(0).max(10000).default(0),
});

businessRouter.post(
  '/',
  validateBody(CreateBusinessSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const body = req.body as z.infer<typeof CreateBusinessSchema>;

    // Entitlement: how many businesses can a user OWN?
    // For MVP: a user can own unlimited businesses (until plan limit on a per-business basis kicks in).
    // The plan limits apply to products/staff/branches within a single business.

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create business
      const business = await tx.business.create({
        data: {
          ownerId: req.user!.id,
          name: body.name,
          category: body.category ?? null,
          phone: body.phone,
          email: body.email ?? null,
          country: body.country,
          currency: body.currency,
          address: body.address ?? null,
          logoUrl: body.logoUrl ?? null,
          taxIdentifier: body.taxIdentifier ?? null,
          taxRateBps: body.taxRateBps,
        },
      });

      // 2. Create HQ branch
      const hq = await tx.branch.create({
        data: {
          businessId: business.id,
          name: `${body.name} (HQ)`,
          phone: body.phone,
          email: body.email ?? null,
          address: body.address ?? null,
          isHQ: true,
        },
      });

      // 3. Assign OWNER role to the user
      const ownerRole = await tx.role.findFirst({
        where: { name: BUSINESS_ROLE_TEMPLATES.BUSINESS_OWNER.name, scope: 'BUSINESS' },
      });
      if (!ownerRole) {
        // ensure RBAC seeded
        await seedRbac(tx);
      }
      const role = ownerRole ?? await tx.role.findFirst({
        where: { name: BUSINESS_ROLE_TEMPLATES.BUSINESS_OWNER.name, scope: 'BUSINESS' },
      });
      if (!role) throw Errors.internal('OWNER role not found');

      await tx.businessMember.create({
        data: {
          businessId: business.id,
          userId: req.user!.id,
          roleId: role.id,
          branchId: hq.id,
          status: 'ACTIVE',
        },
      });

      // 4. Default subscription: free plan
      const freePlan = await tx.subscriptionPlan.findUnique({ where: { code: 'free' } });
      if (freePlan) {
        const trialEndsAt = freePlan.trialDays
          ? new Date(Date.now() + freePlan.trialDays * 24 * 60 * 60 * 1000)
          : null;
        await tx.subscription.create({
          data: {
            businessId: business.id,
            planId: freePlan.id,
            status: trialEndsAt ? 'TRIAL' : 'ACTIVE',
            startDate: new Date(),
            endDate: null,
            trialEndsAt,
            graceEndsAt: null,
          },
        });
      }

      // 5. Default expense categories
      const defaultCats = ['Rent', 'Electricity', 'Transportation', 'Staff Salaries', 'Logistics', 'Repairs', 'Packaging', 'Miscellaneous'];
      for (const name of defaultCats) {
        await tx.expenseCategory.create({
          data: { businessId: business.id, name },
        }).catch(() => {/* skip dup */});
      }

      // 6. Default units of measure
      const defaultUoms = [
        { name: 'Piece', shortName: 'pc' },
        { name: 'Box', shortName: 'box' },
        { name: 'Carton', shortName: 'ctn' },
        { name: 'Kilogram', shortName: 'kg' },
        { name: 'Litre', shortName: 'L' },
        { name: 'Pack', shortName: 'pk' },
      ];
      for (const u of defaultUoms) {
        await tx.unitOfMeasure.create({
          data: { businessId: business.id, name: u.name, shortName: u.shortName },
        }).catch(() => {});
      }

      // 7. Audit
      await tx.auditLog.create({
        data: {
          businessId: business.id,
          actorId: req.user!.id,
          action: 'business.create',
          resourceType: 'business',
          resourceId: business.id,
          change: { name: business.name },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] ?? null,
        },
      });

      return { business, hq };
    });

    return sendSuccess(res, {
      business: result.business,
      branch: result.hq,
      activeBusinessId: result.business.id,
      activeBranchId: result.hq.id,
    }, 'Business created', 201);
  }),
);

// =====================================================
// GET /businesses — list businesses the current user belongs to
// =====================================================
businessRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const memberships = await prisma.businessMember.findMany({
      where: { userId: req.user.id, status: 'ACTIVE' },
      include: {
        business: {
          include: {
            branches: { where: { status: 'ACTIVE' } },
            subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
            _count: { select: { products: true, members: true } },
          },
        },
        role: true,
        branch: true,
      },
    });
    return sendSuccess(res, memberships, 'OK');
  }),
);

// =====================================================
// GET /businesses/:id
// =====================================================
businessRouter.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const business = await prisma.business.findUnique({
      where: { id: req.params.id },
      include: {
        branches: { where: { status: 'ACTIVE' } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { plan: true } },
        _count: { select: { products: true, members: true, sales: true } },
      },
    });
    if (!business) return sendError(res, Errors.notFound('Business not found'));

    // Verify membership
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: business.id, userId: req.user.id } },
    });
    if (!member) return sendError(res, Errors.forbidden('Not a member', 'NOT_A_MEMBER'));

    return sendSuccess(res, business, 'OK');
  }),
);

// =====================================================
// PATCH /businesses/:id — update business profile
// =====================================================
const UpdateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().max(80).optional().nullable(),
  phone: z.string().min(6).max(20).optional(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  country: z.string().max(2).optional(),
  currency: z.string().max(3).optional(),
  taxIdentifier: z.string().max(80).optional().nullable(),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  receiptConfig: z.record(z.any()).optional(),
});

businessRouter.patch(
  '/:id',
  requirePermission('settings:manage'),
  validateBody(UpdateSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.params.id;
    if (req.activeBusinessId !== bizId) {
      return sendError(res, Errors.badRequest('Business id mismatch with active business', 'BIZ_MISMATCH'));
    }
    const updated = await prisma.business.update({
      where: { id: bizId },
      data: req.body as any,
    });
    await prisma.auditLog.create({
      data: {
        businessId: bizId,
        actorId: req.user!.id,
        action: 'business.update',
        resourceType: 'business',
        resourceId: bizId,
        change: req.body as any,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
    return sendSuccess(res, updated, 'Business updated');
  }),
);

// =====================================================
// GET /businesses/:id/dashboard — dashboard metrics
// =====================================================
businessRouter.get(
  '/:id/dashboard',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.params.id;
    if (req.activeBusinessId !== bizId) {
      return sendError(res, Errors.badRequest('Business id mismatch', 'BIZ_MISMATCH'));
    }

    // Parse date filter
    const range = (req.query.range as string) || 'today';
    const now = new Date();
    let start: Date;
    switch (range) {
      case 'yesterday':
        start = new Date(now); start.setDate(now.getDate() - 1); start.setHours(0, 0, 0, 0);
        break;
      case '7d':
        start = new Date(now); start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start = new Date(now); start.setDate(now.getDate() - 30);
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        break;
      case 'today':
      default:
        start = new Date(now); start.setHours(0, 0, 0, 0);
    }
    const end = now;

    const branchId = (req.query.branchId as string) || req.activeBranchId || undefined;

    const where = {
      businessId: bizId,
      saleDate: { gte: start, lte: end },
      status: { notIn: ['CANCELLED', 'DRAFT'] },
      ...(branchId ? { branchId } : {}),
    };

    const [sales, products, lowStock, outOfStock, expenses, customerCredits, invValuation] = await Promise.all([
      prisma.sale.findMany({
        where: where as any,
        include: { items: true, payments: true },
      } as any),
      prisma.product.count({ where: { businessId: bizId, status: 'ACTIVE' } }),
      prisma.inventoryBalance.count({
        where: { businessId: bizId, ...(branchId ? { branchId } : {}), quantity: { lte: 0 } },
      }),
      prisma.inventoryBalance.count({
        where: { businessId: bizId, ...(branchId ? { branchId } : {}), quantity: { equals: 0 } },
      }),
      prisma.expense.aggregate({
        _sum: { amountMinor: true },
        where: { businessId: bizId, expenseDate: { gte: start, lte: end }, ...(branchId ? { branchId } : {}) },
      }),
      prisma.customerCredit.aggregate({
        _sum: { amountMinor: true },
        where: { businessId: bizId, status: { in: ['OPEN', 'PARTIALLY_SETTLED'] } },
      }),
      prisma.inventoryBalance.findMany({
        where: { businessId: bizId, ...(branchId ? { branchId } : {}) },
        select: { quantity: true, wacCostMinor: true },
      }),
    ]);

    const totalSalesMinor = sales.reduce((acc, s) => acc + s.totalMinor, 0n);
    const totalDiscountMinor = sales.reduce((acc, s) => acc + s.discountMinor, 0n);
    const totalTaxMinor = sales.reduce((acc, s) => acc + s.taxMinor, 0n);
    const totalPaidMinor = sales.reduce((acc, s) => acc + s.amountPaidMinor, 0n);
    const outstandingMinor = sales.reduce((acc, s) => acc + s.outstandingMinor, 0n);
    const cogsMinor = sales.reduce(
      (acc, s: any) => acc + s.items.reduce((a: bigint, i: any) => a + i.totalCostMinor, 0n),
      0n,
    );
    const grossProfitMinor = totalSalesMinor - cogsMinor - totalDiscountMinor;
    const operatingProfitMinor = grossProfitMinor - (expenses._sum.amountMinor || 0n);
    const totalStockQty = invValuation.reduce((a, b) => a + b.quantity, 0);
    const inventoryValueMinor = invValuation.reduce((a, b) => a + BigInt(b.quantity) * b.wacCostMinor, 0n);

    return sendSuccess(res, {
      range,
      start,
      end,
      metrics: {
        todaySalesMinor: totalSalesMinor.toString(),
        todayGrossProfitMinor: grossProfitMinor.toString(),
        operatingProfitMinor: operatingProfitMinor.toString(),
        totalProducts: products,
        totalStockQty: totalStockQty,
        inventoryValueMinor: inventoryValueMinor.toString(),
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        outstandingCreditMinor: outstandingMinor.toString(),
        expensesMinor: (expenses._sum.amountMinor || 0n).toString(),
        amountPaidMinor: totalPaidMinor.toString(),
        discountMinor: totalDiscountMinor.toString(),
        taxMinor: totalTaxMinor.toString(),
        cogsMinor: cogsMinor.toString(),
      },
      recentTransactions: sales.slice(0, 10).map((s) => ({
        id: s.id,
        receiptNo: s.receiptNo,
        totalMinor: s.totalMinor.toString(),
        status: s.status,
        saleDate: s.saleDate,
      })),
    }, 'OK');
  }),
);
