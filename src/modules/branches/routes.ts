/**
 * @openapi
 * components:
 *   schemas:
 *     Branch:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         name: { type: string }
 *         phone: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         address: { type: string, nullable: true }
 *         isHQ: { type: boolean }
 *         status: { type: string, enum: [ACTIVE, INACTIVE] }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     BranchTransfer:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         fromBranchId: { type: string, format: uuid }
 *         toBranchId: { type: string, format: uuid }
 *         reference: { type: string }
 *         status: { type: string, enum: [DRAFT, IN_TRANSIT, COMPLETED, CANCELLED] }
 *         notes: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         completedAt: { type: string, format: date-time, nullable: true }
 *         createdById: { type: string, format: uuid, nullable: true }
 *     BranchTransferItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         transferId: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         quantity: { type: integer }
 *         notes: { type: string, nullable: true }
 *
 * /branches:
 *   post:
 *     tags: [Branches]
 *     summary: Create a branch
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               isHQ: { type: boolean, default: false }
 *     responses:
 *       201: { description: Branch created }
 *   get:
 *     tags: [Branches]
 *     summary: List branches with performance summary
 *     description: Returns each branch with sales count + total revenue for the current period (default: month-to-date).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: range, schema: { type: string, enum: [today, yesterday, 7d, 30d, month, last_month], default: month } }
 *     responses:
 *       200: { description: List of branches with performance summary }
 *
 * /branches/transfers:
 *   post:
 *     tags: [Branches]
 *     summary: Create a stock transfer between two branches
 *     description: |
 *       Atomic transaction. Validates both branches belong to the active business,
 *       validates sufficient stock at the source, then performs the stock-out at source
 *       and stock-in at destination in one DB transaction. The transfer is created with
 *       status=COMPLETED and completedAt=now.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromBranchId, toBranchId, items]
 *             properties:
 *               fromBranchId: { type: string, format: uuid }
 *               toBranchId: { type: string, format: uuid }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: integer, minimum: 1 }
 *                     notes: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Transfer completed }
 *       409: { description: Insufficient stock at source branch }
 *   get:
 *     tags: [Branches]
 *     summary: List transfers (paginated, filter by status)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated transfers }
 *
 * /branches/transfers/{id}:
 *   get:
 *     tags: [Branches]
 *     summary: Get a transfer with items and movements
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Transfer detail }
 *       404: { description: Not found }
 *
 * /branches/{id}:
 *   get:
 *     tags: [Branches]
 *     summary: Get branch with current inventory summary
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Branch detail with inventory summary }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Branches]
 *     summary: Update a branch
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated branch }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { prisma } from '../../db/index.js';
import type { Tx } from '../../db/index.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import { computeWac } from '../../utils/money.js';
import { paginate, pageMeta, PaginationSchema } from '../../utils/pagination.js';
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';
import { enforceEntitlement } from '../../middleware/tenant.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { transferRef } from '../../utils/refs.js';

// =====================================================
// Router setup
// =====================================================

export const branchRouter = Router();

// All branch routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
branchRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

/** Fire-and-forget audit log write. Never throws. */
function writeAudit(
  req: Request,
  opts: { action: string; resourceType: string; resourceId: string; change?: unknown },
) {
  const businessId = req.activeBusinessId;
  if (!businessId) return;
  prisma.auditLog
    .create({
      data: {
        businessId,
        actorId: req.user?.id ?? null,
        adminActorId: req.user?.scope === 'admin' ? req.user.id : null,
        action: opts.action,
        resourceType: opts.resourceType,
        resourceId: opts.resourceId,
        change: (opts.change as any) ?? null,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    })
    .catch(() => {
      /* fire and forget — never throw from audit */
    });
}

/** Serialise a branch so BigInts (none currently on Branch) pass through; helper kept for future-proofing. */
function serializeBranch(b: any) {
  return { ...b };
}

/** Compute the [start, end] window for a given range keyword. */
function rangeWindow(range: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  switch (range) {
    case 'yesterday':
      start = new Date(now);
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      return { start, end: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999) };
    case '7d':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      break;
    case 'last_month':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      break;
    case 'today':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
    default:
      start = new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return { start, end: now };
}

// =====================================================
// Schemas
// =====================================================

const CreateBranchSchema = z.object({
  name: z.string().min(2).max(200),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  isHQ: z.boolean().optional().default(false),
});

const UpdateBranchSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const ListBranchesQuerySchema = z.object({
  range: z
    .enum(['today', 'yesterday', '7d', '30d', 'month', 'last_month'])
    .optional()
    .default('month'),
  search: z.string().optional(),
});

const TransferItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().max(2000).optional().nullable(),
});

const CreateTransferSchema = z.object({
  fromBranchId: z.string().uuid(),
  toBranchId: z.string().uuid(),
  items: z.array(TransferItemSchema).min(1),
  notes: z.string().max(5000).optional().nullable(),
});

const ListTransfersQuerySchema = PaginationSchema.extend({
  status: z.string().max(40).optional(),
  fromBranchId: z.string().uuid().optional(),
  toBranchId: z.string().uuid().optional(),
});

// =====================================================
// POST /branches — create branch
// =====================================================
branchRouter.post(
  '/',
  requirePermission('branch:manage'),
  enforceEntitlement('branch'),
  validateBody(CreateBranchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateBranchSchema>;

    // De-dupe name within business.
    const existing = await prisma.branch.findFirst({
      where: { businessId: bizId, name: body.name },
      select: { id: true },
    });
    if (existing) {
      return sendError(
        res,
        Errors.conflict('A branch with this name already exists', 'BRANCH_NAME_DUPLICATE'),
      );
    }

    const branch = await prisma.branch.create({
      data: {
        businessId: bizId,
        name: body.name,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        isHQ: body.isHQ,
      },
    });

    writeAudit(req, {
      action: 'branch.create',
      resourceType: 'branch',
      resourceId: branch.id,
      change: { name: branch.name, isHQ: branch.isHQ },
    });

    return sendSuccess(res, serializeBranch(branch), 'Branch created', 201);
  }),
);

// =====================================================
// GET /branches — list with performance summary
// =====================================================
branchRouter.get(
  '/',
  validateQuery(ListBranchesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as z.infer<typeof ListBranchesQuerySchema>;

    const where: Record<string, unknown> = { businessId: bizId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
        { email: { contains: query.search } },
        { address: { contains: query.search } },
      ];
    }

    const branches = await prisma.branch.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const { start, end } = rangeWindow(query.range);

    // Sales aggregates per branch in the window.
    const salesAgg = await prisma.sale.groupBy({
      by: ['branchId'],
      where: {
        businessId: bizId,
        saleDate: { gte: start, lte: end },
        status: { notIn: ['CANCELLED', 'DRAFT'] },
      },
      _count: { _all: true },
      _sum: { totalMinor: true },
    });

    const salesByBranch = new Map<string, { count: number; revenueMinor: bigint }>();
    for (const s of salesAgg) {
      if (!s.branchId) continue;
      salesByBranch.set(s.branchId, {
        count: s._count._all,
        revenueMinor: BigInt(s._sum.totalMinor ?? 0n),
      });
    }

    const items = branches.map((b: any) => {
      const perf = salesByBranch.get(b.id);
      return {
        ...serializeBranch(b),
        performance: {
          salesCount: perf?.count ?? 0,
          totalRevenueMinor: (perf?.revenueMinor ?? 0n).toString(),
          rangeStart: start,
          rangeEnd: end,
        },
      };
    });

    return sendSuccess(res, { items }, 'OK');
  }),
);

// =====================================================
// POST /branches/transfers — create stock transfer (atomic)
// =====================================================
// NOTE: This route MUST be registered BEFORE /:id routes so that
// Express does not treat "transfers" as an :id path param.
branchRouter.post(
  '/transfers',
  requirePermission('transfer:manage'),
  validateBody(CreateTransferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateTransferSchema>;

    if (body.fromBranchId === body.toBranchId) {
      return sendError(
        res,
        Errors.badRequest(
          'fromBranchId and toBranchId must differ',
          'SAME_BRANCH_TRANSFER',
        ),
      );
    }

    // Validate both branches belong to active business.
    const [fromBranch, toBranch] = await Promise.all([
      prisma.branch.findFirst({
        where: { id: body.fromBranchId, businessId: bizId },
        select: { id: true, status: true, name: true },
      }),
      prisma.branch.findFirst({
        where: { id: body.toBranchId, businessId: bizId },
        select: { id: true, status: true, name: true },
      }),
    ]);
    if (!fromBranch) {
      return sendError(res, Errors.notFound('Source branch not found'));
    }
    if (!toBranch) {
      return sendError(res, Errors.notFound('Destination branch not found'));
    }
    if (fromBranch.status !== 'ACTIVE' || toBranch.status !== 'ACTIVE') {
      return sendError(
        res,
        Errors.badRequest('Both branches must be ACTIVE', 'BRANCH_NOT_ACTIVE'),
      );
    }

    // Validate products belong to this business.
    const productIds = Array.from(new Set(body.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId: bizId },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      return sendError(
        res,
        Errors.badRequest('One or more products not found in this business', 'PRODUCT_NOT_FOUND'),
      );
    }

    // Pre-flight: check sufficient stock at fromBranch for each product.
    const sourceBalances = (await prisma.inventoryBalance.findMany({
      where: {
        businessId: bizId,
        branchId: body.fromBranchId,
        productId: { in: productIds },
      },
      select: { id: true, productId: true, quantity: true, wacCostMinor: true },
    })) as any[];
    const sourceByProduct = new Map<string, any>(
      sourceBalances.map((b: any) => [b.productId, b] as [string, any]),
    );

    for (const item of body.items) {
      const bal = sourceByProduct.get(item.productId);
      const onHand = bal?.quantity ?? 0;
      if (onHand < item.quantity) {
        return sendError(
          res,
          Errors.insufficientStock(
            `Insufficient stock at ${fromBranch.name} for product ${item.productId} (on hand: ${onHand}, requested: ${item.quantity})`,
          ),
        );
      }
    }

    const reference = transferRef();
    const now = new Date();

    const transfer = await prisma.$transaction(async (tx: Tx) => {
      // 1. Create the transfer record (COMPLETED).
      const created = await tx.branchTransfer.create({
        data: {
          businessId: bizId,
          fromBranchId: body.fromBranchId,
          toBranchId: body.toBranchId,
          reference,
          status: 'COMPLETED',
          completedAt: now,
          notes: body.notes ?? null,
          createdById: req.user?.id ?? null,
        },
      });

      // 2. Create transfer items.
      await tx.branchTransferItem.createMany({
        data: body.items.map((it) => ({
          transferId: created.id,
          productId: it.productId,
          quantity: it.quantity,
          notes: it.notes ?? null,
        })),
      });

      // 3. For each item: stock-out at source + stock-in at destination.
      for (const item of body.items) {
        const sourceBal = sourceByProduct.get(item.productId)!;
        const unitCostMinor = sourceBal.wacCostMinor; // WAC at source = transfer unit cost
        const totalCostMinor = BigInt(item.quantity) * unitCostMinor;

        // 3a. InventoryMovement OUT at source.
        await tx.inventoryMovement.create({
          data: {
            businessId: bizId,
            branchId: body.fromBranchId,
            productId: item.productId,
            movementType: 'BRANCH_TRANSFER_OUT',
            quantity: -item.quantity,
            referenceType: 'BRANCH_TRANSFER',
            referenceId: created.id,
            transferId: created.id,
            unitCostMinor,
            totalCostMinor,
            reason: `Transfer out to ${toBranch.name} (${reference})`,
            notes: item.notes ?? null,
            responsibleUserId: req.user?.id ?? null,
          },
        });

        // 3b. Decrement InventoryBalance at source.
        const newSourceQty = sourceBal.quantity - item.quantity;
        // Keep WAC at source unchanged on stock-out (cost basis preserved).
        // If qty hits zero, reset WAC to 0 for cleanliness.
        await tx.inventoryBalance.update({
          where: { id: sourceBal.id },
          data: {
            quantity: newSourceQty,
            wacCostMinor: newSourceQty === 0 ? 0n : sourceBal.wacCostMinor,
          },
        });

        // 3c. InventoryMovement IN at destination.
        await tx.inventoryMovement.create({
          data: {
            businessId: bizId,
            branchId: body.toBranchId,
            productId: item.productId,
            movementType: 'BRANCH_TRANSFER_IN',
            quantity: item.quantity,
            referenceType: 'BRANCH_TRANSFER',
            referenceId: created.id,
            transferId: created.id,
            unitCostMinor,
            totalCostMinor,
            reason: `Transfer in from ${fromBranch.name} (${reference})`,
            notes: item.notes ?? null,
            responsibleUserId: req.user?.id ?? null,
          },
        });

        // 3d. Increment InventoryBalance at destination; recompute WAC.
        const destBal = await tx.inventoryBalance.findFirst({
          where: {
            businessId: bizId,
            branchId: body.toBranchId,
            productId: item.productId,
          },
          select: { id: true, quantity: true, wacCostMinor: true },
        });

        if (destBal) {
          const newDestQty = destBal.quantity + item.quantity;
          const newWac = computeWac(
            destBal.quantity,
            destBal.wacCostMinor,
            item.quantity,
            unitCostMinor,
          );
          await tx.inventoryBalance.update({
            where: { id: destBal.id },
            data: { quantity: newDestQty, wacCostMinor: newWac },
          });
        } else {
          // No existing balance at destination — WAC = incoming unit cost.
          await tx.inventoryBalance.create({
            data: {
              businessId: bizId,
              branchId: body.toBranchId,
              productId: item.productId,
              quantity: item.quantity,
              wacCostMinor: unitCostMinor,
            },
          });
        }
      }

      return created;
    });

    writeAudit(req, {
      action: 'branch.transfer.create',
      resourceType: 'branch_transfer',
      resourceId: transfer.id,
      change: {
        reference: transfer.reference,
        fromBranchId: body.fromBranchId,
        toBranchId: body.toBranchId,
        itemCount: body.items.length,
        totalQty: body.items.reduce((acc, it) => acc + it.quantity, 0),
      },
    });

    const full = await prisma.branchTransfer.findUnique({
      where: { id: transfer.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        movements: { orderBy: { createdAt: 'asc' } },
      },
    });

    return sendSuccess(
      res,
      {
        ...full,
        movements: (full?.movements ?? []).map((m: any) => ({
          ...m,
          unitCostMinor: m.unitCostMinor.toString(),
          totalCostMinor: m.totalCostMinor.toString(),
        })),
      },
      'Transfer completed',
      201,
    );
  }),
);

// =====================================================
// GET /branches/transfers — list transfers (paginated)
// =====================================================
branchRouter.get(
  '/transfers',
  validateQuery(ListTransfersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as z.infer<typeof ListTransfersQuerySchema>;

    const where: Record<string, unknown> = { businessId: bizId };
    if (query.status) where.status = query.status;
    if (query.fromBranchId) where.fromBranchId = query.fromBranchId;
    if (query.toBranchId) where.toBranchId = query.toBranchId;

    const total = await prisma.branchTransfer.count({ where });
    const transfers = await prisma.branchTransfer.findMany({
      ...paginate(
        {
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            fromBranch: { select: { id: true, name: true } },
            toBranch: { select: { id: true, name: true } },
            _count: { select: { items: true } },
          },
        } as any,
        query,
      ),
    } as any);

    return sendSuccess(res, { items: transfers, meta: pageMeta(total, query) }, 'OK');
  }),
);

// =====================================================
// GET /branches/transfers/:id — get transfer detail
// =====================================================
branchRouter.get(
  '/transfers/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const transfer = await prisma.branchTransfer.findFirst({
      where: { id, businessId: bizId },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        movements: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!transfer) return sendError(res, Errors.notFound('Transfer not found'));

    const serialized = {
      ...transfer,
      movements: transfer.movements.map((m: any) => ({
        ...m,
        unitCostMinor: m.unitCostMinor.toString(),
        totalCostMinor: m.totalCostMinor.toString(),
      })),
    };

    return sendSuccess(res, serialized, 'OK');
  }),
);

// =====================================================
// GET /branches/:id — get with current inventory summary
// =====================================================
// NOTE: This MUST come AFTER /transfers routes so that
// "transfers" is not interpreted as an :id.
branchRouter.get(
  '/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const branch = await prisma.branch.findFirst({
      where: { id, businessId: bizId },
    });
    if (!branch) return sendError(res, Errors.notFound('Branch not found'));

    const balances = (await prisma.inventoryBalance.findMany({
      where: { businessId: bizId, branchId: id },
      select: { id: true, productId: true, quantity: true, wacCostMinor: true, updatedAt: true },
    })) as any[];

    const totalSkus = new Set(balances.map((b: any) => b.productId)).size;
    const totalStockQty = balances.reduce((acc: number, b: any) => acc + b.quantity, 0);
    const inventoryValueMinor = balances.reduce(
      (acc: bigint, b: any) => acc + BigInt(b.quantity) * b.wacCostMinor,
      0n,
    );

    return sendSuccess(
      res,
      {
        ...serializeBranch(branch),
        inventory: {
          totalSkus,
          totalStockQty,
          inventoryValueMinor: inventoryValueMinor.toString(),
          balances: balances.map((b: any) => ({
            ...b,
            wacCostMinor: b.wacCostMinor.toString(),
          })),
        },
      },
      'OK',
    );
  }),
);

// =====================================================
// PATCH /branches/:id — update
// =====================================================
branchRouter.patch(
  '/:id',
  requirePermission('branch:manage'),
  validateParams(IdParamsSchema),
  validateBody(UpdateBranchSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof UpdateBranchSchema>;

    const existing = await prisma.branch.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, name: true },
    });
    if (!existing) return sendError(res, Errors.notFound('Branch not found'));

    // Enforce name uniqueness within business if name is changing.
    if (body.name !== undefined && body.name !== existing.name) {
      const dupe = await prisma.branch.findFirst({
        where: { businessId: bizId, name: body.name, NOT: { id } },
        select: { id: true },
      });
      if (dupe) {
        return sendError(
          res,
          Errors.conflict('A branch with this name already exists', 'BRANCH_NAME_DUPLICATE'),
        );
      }
    }

    const updated = await prisma.branch.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    writeAudit(req, {
      action: 'branch.update',
      resourceType: 'branch',
      resourceId: id,
      change: body,
    });

    return sendSuccess(res, serializeBranch(updated), 'Branch updated');
  }),
);
