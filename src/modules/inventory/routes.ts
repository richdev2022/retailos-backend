/**
 * @openapi
 * components:
 *   schemas:
 *     InventoryMovement:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         productId: { type: string, format: uuid }
 *         movementType:
 *           type: string
 *           enum: [INITIAL_STOCK, PURCHASE_RECEIPT, SALE_DEDUCTION, SALE_REVERSAL, ADJUSTMENT, DAMAGED, EXPIRED, SUPPLIER_RETURN, BRANCH_TRANSFER_OUT, BRANCH_TRANSFER_IN, STOCK_OUT]
 *         quantity: { type: integer, description: "Signed: positive for in, negative for out" }
 *         referenceType: { type: string, nullable: true }
 *         referenceId: { type: string, nullable: true }
 *         batchNo: { type: string, nullable: true }
 *         expiryDate: { type: string, format: date-time, nullable: true }
 *         unitCostMinor: { type: string, description: "Per-unit cost in minor units (kobo) at time of movement" }
 *         totalCostMinor: { type: string, description: "|quantity| * unitCostMinor in minor units" }
 *         reason: { type: string, nullable: true }
 *         notes: { type: string, nullable: true }
 *         transferId: { type: string, nullable: true }
 *         syncId: { type: string, nullable: true }
 *         responsibleUserId: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     InventoryBalance:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid, nullable: true }
 *         businessId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         productId: { type: string, format: uuid }
 *         quantity: { type: integer }
 *         wacCostMinor: { type: string, description: "Weighted Average Cost per unit (minor units)" }
 *         updatedAt: { type: string, format: date-time, nullable: true }
 *
 * /inventory/stock-in:
 *   post:
 *     tags: [Inventory]
 *     summary: Receive stock into inventory
 *     description: Records a stock-in movement, recomputes WAC, optionally creates a StockBatch, and updates the product's costPriceMinor to the new WAC. Money fields arrive as decimal strings and are converted to integer minor units.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: header, name: X-Branch-Id, required: false, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity, unitCost]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               quantity: { type: integer, minimum: 1 }
 *               unitCost: { type: string, description: "Decimal major units e.g. '1250.50'. Mutually exclusive with unitCostMinor." }
 *               unitCostMinor: { type: string, description: "Integer minor units e.g. '125050'. Mutually exclusive with unitCost." }
 *               supplierId: { type: string, format: uuid }
 *               purchaseReference: { type: string }
 *               branchId: { type: string, format: uuid }
 *               date: { type: string, format: date-time }
 *               batchNo: { type: string }
 *               expiryDate: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Movement created, balance updated }
 *       404: { description: Product not found in active business }
 *
 * /inventory/stock-out:
 *   post:
 *     tags: [Inventory]
 *     summary: Remove stock from inventory
 *     description: Records a signed-negative stock-out movement. Reason determines the movementType (DAMAGED, EXPIRED, SUPPLIER_RETURN, or STOCK_OUT for general cases).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: header, name: X-Branch-Id, required: false, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, quantity, reason]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               quantity: { type: integer, minimum: 1, description: "Positive int; stored as negative movement internally." }
 *               reason:
 *                 type: string
 *                 enum: [DAMAGED, EXPIRED, INTERNAL_USE, THEFT_MISSING, SUPPLIER_RETURN, OTHER]
 *               reference: { type: string }
 *               branchId: { type: string, format: uuid }
 *               date: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Movement created }
 *       409: { description: Insufficient stock }
 *
 * /inventory/adjustments:
 *   post:
 *     tags: [Inventory]
 *     summary: Adjust inventory to a physical count
 *     description: Computes delta = physicalCount - currentQuantity and applies a signed ADJUSTMENT movement. WAC is left unchanged unless the balance is being initialised from zero.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: header, name: X-Branch-Id, required: false, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, physicalCount, reason]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               physicalCount: { type: integer, minimum: 0 }
 *               branchId: { type: string, format: uuid }
 *               reason: { type: string }
 *               notes: { type: string }
 *               reference: { type: string }
 *     responses:
 *       201: { description: Adjustment movement created }
 *
 * /inventory/movements:
 *   get:
 *     tags: [Inventory]
 *     summary: List inventory movements
 *     description: Paginated list of immutable movements with product and branch names. Requires `stock:movements` OR `stock:view` permission.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: productId, schema: { type: string, format: uuid } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: movementType, schema: { type: string } }
 *       - { in: query, name: referenceType, schema: { type: string } }
 *       - { in: query, name: referenceId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated list of movements }
 *
 * /inventory/movements/{id}:
 *   get:
 *     tags: [Inventory]
 *     summary: Get a single movement
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Movement with product and branch relations }
 *       404: { description: Not found }
 *
 * /inventory/balances:
 *   get:
 *     tags: [Inventory]
 *     summary: List inventory balances
 *     description: Paginated list of current balances with product details (name, sku, barcode). Computed stock status: in_stock / low_stock / out_of_stock based on product.minStock.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: lowStock, schema: { type: boolean, default: false } }
 *       - { in: query, name: outOfStock, schema: { type: boolean, default: false } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated list of balances }
 *
 * /inventory/valuation:
 *   get:
 *     tags: [Inventory]
 *     summary: Inventory valuation summary
 *     description: Returns total stock quantity, total inventory value (sum of qty * wacCostMinor) and a paginated per-product breakdown.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *     responses:
 *       200: { description: Inventory valuation }
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import type { MovementType } from '@prisma/client';

import { prisma, type Tx } from '../../db/index.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import { toMinor } from '../../utils/money.js';
import {
  paginate,
  pageMeta,
  PaginationSchema,
} from '../../utils/pagination.js';
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  applyMovement,
  getBalance,
  getMovements,
} from './service.js';

// =====================================================
// Router setup
// =====================================================

export const inventoryRouter = Router();

// All inventory routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
inventoryRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

/** Boolean from a query-string value. Handles "true"/"false"/"1"/"0". */
const boolQuery = z.preprocess((v: unknown) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  if (Array.isArray(v)) return v[0] === 'true' || v[0] === '1';
  return false;
}, z.boolean());

const MovementTypeEnum = z.enum([
  'INITIAL_STOCK',
  'PURCHASE_RECEIPT',
  'SALE_DEDUCTION',
  'SALE_REVERSAL',
  'ADJUSTMENT',
  'DAMAGED',
  'EXPIRED',
  'SUPPLIER_RETURN',
  'BRANCH_TRANSFER_OUT',
  'BRANCH_TRANSFER_IN',
  'STOCK_OUT',
]);

const StockOutReasonEnum = z.enum([
  'DAMAGED',
  'EXPIRED',
  'INTERNAL_USE',
  'THEFT_MISSING',
  'SUPPLIER_RETURN',
  'OTHER',
]);

const moneyInput = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
  z.number().nonnegative().finite(),
]);
const moneyString = moneyInput.transform((v: string | number) => String(v));

const minorIntString = z
  .string()
  .regex(/^\d+$/, 'Must be a non-negative integer string of minor units');

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

/**
 * Permission middleware that succeeds if the user has ANY of the listed
 * permission codes. Mirrors the logic of `requirePermission` but with OR
 * semantics. Used for endpoints that accept multiple permission codes
 * (e.g. `stock:movements` OR `stock:view`).
 */
function requireAnyPermission(...codes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(Errors.unauthorized());
      const biz = req.activeBusinessId;
      if (!biz) {
        return next(
          Errors.badRequest(
            'No active business. Set X-Business-Id header.',
            'NO_ACTIVE_BUSINESS',
          ),
        );
      }

      const member = await prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId: biz, userId: req.user.id } },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!member || member.status !== 'ACTIVE') {
        return next(Errors.forbidden('Not a member of this business', 'NOT_A_MEMBER'));
      }

      const userCodes: string[] = member.role.permissions.map(
        (rp: { permission: { code: string } }) => rp.permission.code,
      );
      const hasAdmin = userCodes.includes('admin:*');
      const hasAny =
        hasAdmin ||
        codes.some((c) => userCodes.includes(c)) ||
        codes.some((c) =>
          userCodes.some(
            (uc: string) => uc.endsWith(':*') && c.startsWith(uc.slice(0, -1)),
          ),
        );

      if (!hasAny) {
        return next(
          Errors.forbidden(
            `Missing permission: ${codes.join(' OR ')}`,
            'MISSING_PERMISSION',
          ),
        );
      }

      if (req.activeBranchId && member.branchId && member.branchId !== req.activeBranchId) {
        return next(Errors.forbidden('Not assigned to this branch', 'BRANCH_NOT_ALLOWED'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Serialise a movement so BigInt fields become strings (JSON-safe). */
function serializeMovement(m: any) {
  return {
    ...m,
    unitCostMinor: m.unitCostMinor?.toString() ?? '0',
    totalCostMinor: m.totalCostMinor?.toString() ?? '0',
  };
}

/** Serialise a balance (or zero-init stub) so BigInt fields become strings. */
function serializeBalance(b: any) {
  return {
    ...b,
    wacCostMinor: b.wacCostMinor != null ? b.wacCostMinor.toString() : '0',
  };
}

/** Resolve the effective branchId: body first, then header. */
function resolveBranchId(
  bodyBranchId: string | null | undefined,
  req: Request,
): string | null {
  if (bodyBranchId) return bodyBranchId;
  return req.activeBranchId ?? null;
}

// =====================================================
// POST /inventory/stock-in
// =====================================================
const StockInSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(1_000_000_000),
    unitCost: moneyString.optional(),
    unitCostMinor: minorIntString.optional(),
    supplierId: z.string().uuid().optional().nullable(),
    purchaseReference: z.string().max(200).optional().nullable(),
    branchId: z.string().uuid().optional().nullable(),
    date: z.string().datetime().optional(),
    batchNo: z.string().max(200).optional().nullable(),
    expiryDate: z.string().datetime().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
  })
  .refine((d) => !!d.unitCost || !!d.unitCostMinor, {
    message: 'Either unitCost or unitCostMinor is required',
    path: ['unitCost'],
  })
  .refine((d) => !(d.unitCost && d.unitCostMinor), {
    message: 'Provide either unitCost OR unitCostMinor, not both',
    path: ['unitCost'],
  });

inventoryRouter.post(
  '/stock-in',
  requirePermission('stock:in'),
  validateBody(StockInSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof StockInSchema>;
    const branchId = resolveBranchId(body.branchId, req);

    // Convert unit cost to minor units.
    const unitCostMinor = body.unitCostMinor
      ? BigInt(body.unitCostMinor)
      : toMinor(body.unitCost!);

    // Validate product belongs to business.
    const product = await prisma.product.findFirst({
      where: { id: body.productId, businessId: bizId },
      select: { id: true, name: true, sku: true },
    });
    if (!product) return sendError(res, Errors.notFound('Product not found'));

    const movementType: MovementType = body.purchaseReference
      ? 'PURCHASE_RECEIPT'
      : 'INITIAL_STOCK';

    const result = await prisma.$transaction(async (tx: Tx) => {
      const { movement, balance } = await applyMovement(tx, {
        businessId: bizId,
        branchId,
        productId: body.productId,
        movementType,
        quantity: body.quantity,
        unitCostMinor,
        referenceType: body.purchaseReference ? 'PURCHASE' : null,
        referenceId: null,
        batchNo: body.batchNo ?? null,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
        reason: body.purchaseReference ? `Receipt: ${body.purchaseReference}` : 'Initial stock',
        notes: body.notes ?? null,
        responsibleUserId: req.user?.id ?? null,
      });

      // Optionally create a StockBatch when batch info is provided.
      if (body.batchNo || body.expiryDate) {
        await tx.stockBatch.create({
          data: {
            businessId: bizId,
            productId: body.productId,
            batchNo: body.batchNo ?? null,
            expiryDate: body.expiryDate ? new Date(body.expiryDate) : null,
            initialQty: body.quantity,
            remainingQty: body.quantity,
            unitCostMinor,
          },
        });
      }

      // Update product's costPriceMinor to the new WAC so price labels reflect latest cost.
      await tx.product.update({
        where: { id: body.productId },
        data: { costPriceMinor: balance.wacCostMinor },
      });

      return { movement, balance };
    });

    writeAudit(req, {
      action: 'inventory.stock_in',
      resourceType: 'inventory_movement',
      resourceId: result.movement.id,
      change: {
        productId: body.productId,
        quantity: body.quantity,
        unitCostMinor: unitCostMinor.toString(),
        movementType,
        branchId,
        batchNo: body.batchNo ?? null,
      },
    });

    return sendSuccess(
      res,
      {
        movement: serializeMovement(result.movement),
        balance: serializeBalance(result.balance),
      },
      'Stock received',
      201,
    );
  }),
);

// =====================================================
// POST /inventory/stock-out
// =====================================================
const StockOutSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1_000_000_000),
  reason: StockOutReasonEnum,
  reference: z.string().max(200).optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  date: z.string().datetime().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

/** Map a stock-out reason to the canonical MovementType. */
function reasonToMovementType(reason: z.infer<typeof StockOutReasonEnum>): MovementType {
  switch (reason) {
    case 'DAMAGED':
      return 'DAMAGED';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'SUPPLIER_RETURN':
      return 'SUPPLIER_RETURN';
    case 'INTERNAL_USE':
    case 'THEFT_MISSING':
    case 'OTHER':
    default:
      return 'STOCK_OUT';
  }
}

inventoryRouter.post(
  '/stock-out',
  requirePermission('stock:out'),
  validateBody(StockOutSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof StockOutSchema>;
    const branchId = resolveBranchId(body.branchId, req);

    // Validate product belongs to business.
    const product = await prisma.product.findFirst({
      where: { id: body.productId, businessId: bizId },
      select: { id: true, name: true, sku: true },
    });
    if (!product) return sendError(res, Errors.notFound('Product not found'));

    const movementType = reasonToMovementType(body.reason);
    // quantity in body is POSITIVE; movement is signed NEGATIVE.
    const signedQty = -Math.abs(body.quantity);

    const result = await prisma.$transaction(async (tx: Tx) => {
      const { movement, balance } = await applyMovement(tx, {
        businessId: bizId,
        branchId,
        productId: body.productId,
        movementType,
        quantity: signedQty,
        referenceType: body.reference ? 'MANUAL' : null,
        referenceId: null,
        reason: body.reason,
        notes: body.notes ?? null,
        responsibleUserId: req.user?.id ?? null,
      });

      // If supplier return, decrement the corresponding StockBatch remainingQty
      // if one exists for this product. Best-effort — not strictly required.
      if (movementType === 'SUPPLIER_RETURN') {
        const batch = await tx.stockBatch.findFirst({
          where: { businessId: bizId, productId: body.productId },
          orderBy: { receivedAt: 'desc' },
        });
        if (batch) {
          const newRemaining = Math.max(0, batch.remainingQty - body.quantity);
          await tx.stockBatch.update({
            where: { id: batch.id },
            data: { remainingQty: newRemaining },
          });
        }
      }

      return { movement, balance };
    });

    writeAudit(req, {
      action: 'inventory.stock_out',
      resourceType: 'inventory_movement',
      resourceId: result.movement.id,
      change: {
        productId: body.productId,
        quantity: signedQty,
        reason: body.reason,
        movementType,
        branchId,
      },
    });

    return sendSuccess(
      res,
      {
        movement: serializeMovement(result.movement),
        balance: serializeBalance(result.balance),
      },
      'Stock removed',
      201,
    );
  }),
);

// =====================================================
// POST /inventory/adjustments
// =====================================================
const AdjustmentSchema = z.object({
  productId: z.string().uuid(),
  physicalCount: z.number().int().min(0).max(1_000_000_000),
  branchId: z.string().uuid().optional().nullable(),
  reason: z.string().min(1).max(200),
  notes: z.string().max(2000).optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
});

inventoryRouter.post(
  '/adjustments',
  requirePermission('stock:adjust'),
  validateBody(AdjustmentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof AdjustmentSchema>;
    const branchId = resolveBranchId(body.branchId, req);

    // Validate product belongs to business.
    const product = await prisma.product.findFirst({
      where: { id: body.productId, businessId: bizId },
      select: { id: true, name: true, sku: true },
    });
    if (!product) return sendError(res, Errors.notFound('Product not found'));

    const result = await prisma.$transaction(async (tx: Tx) => {
      // Fetch current balance inside the transaction for an accurate delta.
      const current = await getBalance(bizId, branchId, body.productId, tx);
      const currentQty = (current as any).quantity ?? 0;
      const delta = body.physicalCount - currentQty;

      if (delta === 0) {
        // No-op adjustment — still record an immutable movement for audit trail.
        // Quantity 0 is rejected by applyMovement, so handle inline.
        const movement = await tx.inventoryMovement.create({
          data: {
            businessId: bizId,
            branchId,
            productId: body.productId,
            movementType: 'ADJUSTMENT',
            quantity: 0,
            unitCostMinor: (current as any).wacCostMinor ?? 0n,
            totalCostMinor: 0n,
            reason: body.reason,
            notes: body.notes ?? null,
            responsibleUserId: req.user?.id ?? null,
          },
        });
        return { movement, balance: current };
      }

      const { movement, balance } = await applyMovement(tx, {
        businessId: bizId,
        branchId,
        productId: body.productId,
        movementType: 'ADJUSTMENT',
        quantity: delta,
        // No unitCostMinor → WAC is preserved on the existing balance (per service contract).
        reason: body.reason,
        notes: body.notes ?? null,
        referenceType: body.reference ? 'MANUAL' : null,
        referenceId: null,
        responsibleUserId: req.user?.id ?? null,
      });

      return { movement, balance };
    });

    writeAudit(req, {
      action: 'inventory.adjust',
      resourceType: 'inventory_movement',
      resourceId: result.movement.id,
      change: {
        productId: body.productId,
        movementType: 'ADJUSTMENT',
        quantity: result.movement.quantity,
        reason: body.reason,
        branchId,
      },
    });

    return sendSuccess(
      res,
      {
        movement: serializeMovement(result.movement),
        balance: serializeBalance(result.balance),
      },
      'Inventory adjusted',
      201,
    );
  }),
);

// =====================================================
// GET /inventory/movements
// =====================================================
const ListMovementsQuerySchema = PaginationSchema.extend({
  productId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  movementType: MovementTypeEnum.optional(),
  referenceType: z.string().max(60).optional(),
  referenceId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

inventoryRouter.get(
  '/movements',
  requireAnyPermission('stock:movements', 'stock:view'),
  validateQuery(ListMovementsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ListMovementsQuerySchema>;

    const { items, meta } = await getMovements({
      businessId: bizId,
      branchId: q.branchId,
      productId: q.productId,
      movementType: q.movementType,
      referenceType: q.referenceType,
      referenceId: q.referenceId,
      from: q.from ? new Date(q.from) : undefined,
      to: q.to ? new Date(q.to) : undefined,
      search: q.search,
      page: q.page,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    });

    return sendSuccess(
      res,
      { items: items.map(serializeMovement), meta },
      'OK',
    );
  }),
);

// =====================================================
// GET /inventory/movements/:id
// =====================================================
inventoryRouter.get(
  '/movements/:id',
  requireAnyPermission('stock:movements', 'stock:view'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const movement = await prisma.inventoryMovement.findFirst({
      where: { id, businessId: bizId },
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!movement) return sendError(res, Errors.notFound('Movement not found'));

    return sendSuccess(res, serializeMovement(movement), 'OK');
  }),
);

// =====================================================
// GET /inventory/balances
// =====================================================
const ListBalancesQuerySchema = PaginationSchema.extend({
  branchId: z.string().uuid().optional(),
  lowStock: boolQuery.default(false),
  outOfStock: boolQuery.default(false),
});

inventoryRouter.get(
  '/balances',
  requireAnyPermission('stock:movements', 'stock:view'),
  validateQuery(ListBalancesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ListBalancesQuerySchema>;

    // Build base where clause.
    const where: Record<string, unknown> = { businessId: bizId };
    if (q.branchId) where.branchId = q.branchId;

    // low_stock and out_of_stock are product-relative. SQLite doesn't easily
    // express `quantity <= product.minStock` in a where clause via Prisma, so
    // we fetch and filter in memory. Pagination is applied post-filter; for
    // typical businesses (hundreds–thousands of products) this is fine.
    // If both flags are false, no filtering is applied and normal pagination is used.
    const baseQuery = {
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
            minStock: true,
            status: true,
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    };

    let items: any[];
    let total: number;

    if (q.lowStock || q.outOfStock) {
      // Filter in memory.
      const all = await prisma.inventoryBalance.findMany({
        ...baseQuery,
        where: { ...where },
      } as any);
      const filtered = all.filter((b: any) => {
        const minStock = b.product?.minStock ?? 0;
        const isOutOfStock = b.quantity === 0;
        const isLowStock = b.quantity <= minStock;
        if (q.outOfStock && q.lowStock) return isOutOfStock || isLowStock;
        if (q.outOfStock) return isOutOfStock;
        if (q.lowStock) return isLowStock && !isOutOfStock;
        return true;
      });
      total = filtered.length;
      const skip = (q.page - 1) * q.limit;
      items = filtered.slice(skip, skip + q.limit);
    } else {
      total = await prisma.inventoryBalance.count({ where });
      items = await prisma.inventoryBalance.findMany({
        ...paginate({ where, orderBy: { updatedAt: 'desc' } } as any, q),
        include: baseQuery.include,
      } as any);
    }

    // Compute stock status per row.
    const serialized = items.map((b: any) => {
      const minStock = b.product?.minStock ?? 0;
      const status =
        b.quantity === 0
          ? 'out_of_stock'
          : b.quantity <= minStock
            ? 'low_stock'
            : 'in_stock';
      return {
        ...serializeBalance(b),
        product: b.product,
        branch: b.branch ?? null,
        stockStatus: status,
      };
    });

    return sendSuccess(
      res,
      { items: serialized, meta: pageMeta(total, q) },
      'OK',
    );
  }),
);

// =====================================================
// GET /inventory/valuation
// =====================================================
const ValuationQuerySchema = PaginationSchema.extend({
  branchId: z.string().uuid().optional(),
}).extend({ limit: z.coerce.number().int().min(1).max(500).default(50) });

inventoryRouter.get(
  '/valuation',
  requireAnyPermission('stock:movements', 'stock:view'),
  validateQuery(ValuationQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ValuationQuerySchema>;

    const where: Record<string, unknown> = { businessId: bizId };
    if (q.branchId) where.branchId = q.branchId;

    // Pull all balances + product names for valuation. For businesses with
    // huge SKU counts this can be split into a paginated query + an aggregate
    // (count/_sum) — keeping it simple here.
    const balances = await prisma.inventoryBalance.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, minStock: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const totalStockQty = balances.reduce((acc: number, b: any) => acc + b.quantity, 0);
    const totalValueMinor = balances.reduce(
      (acc: bigint, b: any) => acc + BigInt(b.quantity) * b.wacCostMinor,
      0n,
    );

    // Paginated per-product breakdown.
    const skip = (q.page - 1) * q.limit;
    const pageItems = balances.slice(skip, skip + q.limit).map((b: any) => ({
      ...serializeBalance(b),
      productId: b.productId,
      productName: b.product?.name ?? null,
      sku: b.product?.sku ?? null,
      barcode: b.product?.barcode ?? null,
      valueMinor: (BigInt(b.quantity) * b.wacCostMinor).toString(),
    }));

    return sendSuccess(
      res,
      {
        totalStockQty,
        totalValueMinor: totalValueMinor.toString(),
        meta: pageMeta(balances.length, q),
        items: pageItems,
      },
      'OK',
    );
  }),
);
