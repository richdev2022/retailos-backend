/**
 * @openapi
 * components:
 *   schemas:
 *     Purchase:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         supplierId: { type: string, format: uuid, nullable: true }
 *         reference: { type: string }
 *         status: { type: string, enum: [DRAFT, ORDERED, PARTIALLY_RECEIVED, RECEIVED, CANCELLED] }
 *         totalCostMinor: { type: string, description: "Integer minor units (kobo)" }
 *         paidAmountMinor: { type: string }
 *         notes: { type: string, nullable: true }
 *         orderDate: { type: string, format: date-time }
 *         receivedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     PurchaseItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         purchaseId: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         orderedQty: { type: integer }
 *         receivedQty: { type: integer }
 *         unitCostMinor: { type: string }
 *         totalCostMinor: { type: string }
 *         batchNo: { type: string, nullable: true }
 *         expiryDate: { type: string, format: date-time, nullable: true }
 *
 * /purchases:
 *   post:
 *     tags: [Purchases]
 *     summary: Create a purchase order (DRAFT by default)
 *     description: Creates a purchase order with line items. Inventory is NOT touched at PO creation — only when goods are received via `/purchases/{id}/receive`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               supplierId: { type: string, format: uuid }
 *               branchId: { type: string, format: uuid }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, orderedQty]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     orderedQty: { type: integer, minimum: 1 }
 *                     unitCostMinor: { type: string, description: "Integer minor units (kobo). Mutually exclusive with unitCost." }
 *                     unitCost: { type: string, description: "Decimal major units e.g. '1250.50'. Mutually exclusive with unitCostMinor." }
 *                     batchNo: { type: string }
 *                     expiryDate: { type: string, format: date-time }
 *               notes: { type: string }
 *               orderDate: { type: string, format: date-time }
 *               status: { type: string, enum: [DRAFT, ORDERED] }
 *     responses:
 *       201: { description: Purchase created }
 *   get:
 *     tags: [Purchases]
 *     summary: List purchases
 *     description: Paginated list with search by reference/supplier and filter by status/date.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Paginated list of purchases }
 *
 * /purchases/{id}:
 *   get:
 *     tags: [Purchases]
 *     summary: Get purchase with items, supplier, payments
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Purchase detail }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Purchases]
 *     summary: Update purchase (only while DRAFT or ORDERED)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated purchase }
 *       409: { description: Purchase is no longer editable }
 *
 * /purchases/{id}/receive:
 *   post:
 *     tags: [Purchases]
 *     summary: Receive goods against a purchase
 *     description: |
 *       Atomic transaction that, for each received line, increases PurchaseItem.receivedQty,
 *       creates an InventoryMovement (PURCHASE_RECEIPT), updates the InventoryBalance (adding qty
 *       and recomputing WAC), and creates a StockBatch. Marks the purchase as PARTIALLY_RECEIVED
 *       or RECEIVED (when complete=true or all items fully received).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [purchaseItemId, receivedQty]
 *                   properties:
 *                     purchaseItemId: { type: string, format: uuid }
 *                     receivedQty: { type: integer, minimum: 1 }
 *                     batchNo: { type: string }
 *                     expiryDate: { type: string, format: date-time }
 *               complete: { type: boolean, default: false }
 *     responses:
 *       200: { description: Goods received }
 *       409: { description: Cannot receive against a CANCELLED or already RECEIVED purchase }
 *
 * /purchases/{id}/cancel:
 *   post:
 *     tags: [Purchases]
 *     summary: Cancel a purchase (only if not RECEIVED)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Purchase cancelled }
 *       409: { description: Cannot cancel a RECEIVED purchase }
 *
 * /purchases/{id}/payments:
 *   get:
 *     tags: [Purchases]
 *     summary: List supplier payments linked to this purchase
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Paginated payments }
 *   post:
 *     tags: [Purchases]
 *     summary: Record a supplier payment against this purchase
 *     description: Increases Purchase.paidAmountMinor (capped at totalCostMinor).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, paymentMethod]
 *             properties:
 *               amount: { type: string, description: "Decimal major units e.g. '1250.50'" }
 *               paymentMethod: { type: string }
 *               reference: { type: string }
 *               paidAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Payment recorded }
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
import { toMinor, computeWac } from '../../utils/money.js';
import { paginate, pageMeta, PaginationSchema } from '../../utils/pagination.js';
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { purchaseRef } from '../../utils/refs.js';

// =====================================================
// Router setup
// =====================================================

export const purchaseRouter = Router();

// All purchase routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
purchaseRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

const PURCHASE_EDITABLE_STATUSES = ['DRAFT', 'ORDERED'] as const;
type PurchaseEditableStatus = (typeof PURCHASE_EDITABLE_STATUSES)[number];

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

/** Serialise a purchase record so any BigInt fields become strings. */
function serializePurchase(p: any) {
  return {
    ...p,
    totalCostMinor: p.totalCostMinor?.toString() ?? '0',
    paidAmountMinor: p.paidAmountMinor?.toString() ?? '0',
    items: (p.items ?? []).map((it: any) => ({
      ...it,
      unitCostMinor: it.unitCostMinor?.toString() ?? '0',
      totalCostMinor: it.totalCostMinor?.toString() ?? '0',
    })),
  };
}

// =====================================================
// Schemas
// =====================================================

const moneyInput = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
  z.number().nonnegative().finite(),
]);

const minorInput = z
  .string()
  .regex(/^\d+$/, 'Must be a non-negative integer string of minor units');

const CreatePurchaseItemSchema = z
  .object({
    productId: z.string().uuid(),
    orderedQty: z.number().int().positive(),
    unitCostMinor: minorInput.optional(),
    unitCost: moneyInput.optional(),
    batchNo: z.string().max(200).optional(),
    expiryDate: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.unitCostMinor === undefined && data.unitCost === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'Either unitCostMinor or unitCost is required',
        path: ['unitCost'],
      });
    }
  });

const CreatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  items: z.array(CreatePurchaseItemSchema).min(1),
  notes: z.string().max(5000).optional().nullable(),
  orderDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'ORDERED']).optional(),
});

const UpdatePurchaseSchema = z.object({
  supplierId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  orderDate: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'ORDERED']).optional(),
});

const ListPurchasesQuerySchema = PaginationSchema.extend({
  status: z.string().max(40).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const ReceiveItemSchema = z.object({
  purchaseItemId: z.string().uuid(),
  receivedQty: z.number().int().positive(),
  batchNo: z.string().max(200).optional(),
  expiryDate: z.string().datetime().optional(),
});

const ReceiveSchema = z.object({
  items: z.array(ReceiveItemSchema).min(1),
  complete: z.boolean().optional().default(false),
});

const RecordPaymentSchema = z.object({
  amount: moneyInput.transform((v: string | number) => String(v)),
  paymentMethod: z.string().min(1).max(80),
  reference: z.string().max(200).optional().nullable(),
  paidAt: z.string().datetime().optional(),
});

// =====================================================
// POST /purchases — create purchase order
// =====================================================
purchaseRouter.post(
  '/',
  requirePermission('purchase:manage'),
  validateBody(CreatePurchaseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreatePurchaseSchema>;

    // Resolve branchId: explicit body value, else the request's active branch.
    const branchId = body.branchId ?? req.activeBranchId ?? null;

    // Validate supplier (if given) belongs to this business.
    if (body.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplierId, businessId: bizId },
        select: { id: true },
      });
      if (!supplier) {
        return sendError(res, Errors.badRequest('Supplier not found', 'SUPPLIER_NOT_FOUND'));
      }
    }
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, businessId: bizId },
        select: { id: true },
      });
      if (!branch) {
        return sendError(res, Errors.badRequest('Branch not found', 'BRANCH_NOT_FOUND'));
      }
    }

    // Validate all products belong to this business.
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

    // Compute line costs and total.
    const lineItems = body.items.map((i) => {
      const unitCostMinor =
        i.unitCostMinor !== undefined ? BigInt(i.unitCostMinor) : toMinor(i.unitCost!);
      const totalCostMinor = BigInt(i.orderedQty) * unitCostMinor;
      return {
        productId: i.productId,
        orderedQty: i.orderedQty,
        unitCostMinor,
        totalCostMinor,
        batchNo: i.batchNo ?? null,
        expiryDate: i.expiryDate ? new Date(i.expiryDate) : null,
      };
    });

    const totalCostMinor = lineItems.reduce((acc, it) => acc + it.totalCostMinor, 0n);
    const reference = purchaseRef();
    const orderDate = body.orderDate ? new Date(body.orderDate) : new Date();

    const purchase = await prisma.$transaction(async (tx: Tx) => {
      const created = await tx.purchase.create({
        data: {
          businessId: bizId,
          branchId,
          supplierId: body.supplierId ?? null,
          reference,
          status: body.status ?? 'DRAFT',
          totalCostMinor,
          notes: body.notes ?? null,
          orderDate,
        },
      });

      await tx.purchaseItem.createMany({
        data: lineItems.map((it) => ({
          purchaseId: created.id,
          productId: it.productId,
          orderedQty: it.orderedQty,
          receivedQty: 0,
          unitCostMinor: it.unitCostMinor,
          totalCostMinor: it.totalCostMinor,
          batchNo: it.batchNo,
          expiryDate: it.expiryDate,
        })),
      });

      return created;
    });

    const full = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      include: { items: true, supplier: true },
    });

    writeAudit(req, {
      action: 'purchase.create',
      resourceType: 'purchase',
      resourceId: purchase.id,
      change: {
        reference: purchase.reference,
        supplierId: body.supplierId ?? null,
        branchId,
        totalCostMinor: totalCostMinor.toString(),
        items: body.items.length,
        status: purchase.status,
      },
    });

    return sendSuccess(res, serializePurchase(full), 'Purchase created', 201);
  }),
);

// =====================================================
// GET /purchases — list with search + filters
// =====================================================
purchaseRouter.get(
  '/',
  validateQuery(ListPurchasesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as z.infer<typeof ListPurchasesQuerySchema>;

    const where: Record<string, unknown> = { businessId: bizId };

    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.orderDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    if (query.search) {
      const term = query.search;
      where.OR = [
        { reference: { contains: term } },
        { supplier: { name: { contains: term } } },
        { notes: { contains: term } },
      ];
    }

    const total = await prisma.purchase.count({ where });
    const purchases = await prisma.purchase.findMany({
      ...paginate(
        {
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            supplier: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true } },
            _count: { select: { items: true, payments: true } },
          },
        } as any,
        query,
      ),
    } as any);

    const items = purchases.map((p: any) => ({
      ...p,
      totalCostMinor: p.totalCostMinor.toString(),
      paidAmountMinor: p.paidAmountMinor.toString(),
    }));

    return sendSuccess(res, { items, meta: pageMeta(total, query) }, 'OK');
  }),
);

// =====================================================
// GET /purchases/:id — get with items + supplier + payments
// =====================================================
purchaseRouter.get(
  '/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId: bizId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
        supplier: true,
        branch: { select: { id: true, name: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
    if (!purchase) return sendError(res, Errors.notFound('Purchase not found'));

    const serialized = {
      ...purchase,
      totalCostMinor: purchase.totalCostMinor.toString(),
      paidAmountMinor: purchase.paidAmountMinor.toString(),
      items: purchase.items.map((it: any) => ({
        ...it,
        unitCostMinor: it.unitCostMinor.toString(),
        totalCostMinor: it.totalCostMinor.toString(),
      })),
      payments: purchase.payments.map((pmt: any) => ({
        ...pmt,
        amountMinor: pmt.amountMinor.toString(),
      })),
    };

    return sendSuccess(res, serialized, 'OK');
  }),
);

// =====================================================
// PATCH /purchases/:id — update (only DRAFT/ORDERED)
// =====================================================
purchaseRouter.patch(
  '/:id',
  requirePermission('purchase:manage'),
  validateParams(IdParamsSchema),
  validateBody(UpdatePurchaseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof UpdatePurchaseSchema>;

    const existing = await prisma.purchase.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, status: true, supplierId: true, branchId: true },
    });
    if (!existing) return sendError(res, Errors.notFound('Purchase not found'));

    if (!PURCHASE_EDITABLE_STATUSES.includes(existing.status as PurchaseEditableStatus)) {
      return sendError(
        res,
        Errors.conflict(
          `Purchase cannot be edited in status ${existing.status}`,
          'PURCHASE_NOT_EDITABLE',
        ),
      );
    }

    // Validate new supplier/branch if provided.
    if (body.supplierId !== undefined && body.supplierId !== null) {
      const supplier = await prisma.supplier.findFirst({
        where: { id: body.supplierId, businessId: bizId },
        select: { id: true },
      });
      if (!supplier) {
        return sendError(res, Errors.badRequest('Supplier not found', 'SUPPLIER_NOT_FOUND'));
      }
    }
    const branchId = body.branchId !== undefined ? body.branchId : null;
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, businessId: bizId },
        select: { id: true },
      });
      if (!branch) {
        return sendError(res, Errors.badRequest('Branch not found', 'BRANCH_NOT_FOUND'));
      }
    }

    const updated = await prisma.purchase.update({
      where: { id },
      data: {
        ...(body.supplierId !== undefined ? { supplierId: body.supplierId } : {}),
        ...(body.branchId !== undefined ? { branchId: body.branchId } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.orderDate !== undefined ? { orderDate: new Date(body.orderDate) } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      },
    });

    writeAudit(req, {
      action: 'purchase.update',
      resourceType: 'purchase',
      resourceId: id,
      change: body,
    });

    return sendSuccess(res, serializePurchase(updated), 'Purchase updated');
  }),
);

// =====================================================
// POST /purchases/:id/receive — receive goods (atomic)
// =====================================================
purchaseRouter.post(
  '/:id/receive',
  requirePermission('purchase:manage'),
  validateParams(IdParamsSchema),
  validateBody(ReceiveSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof ReceiveSchema>;

    // Load purchase + items.
    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId: bizId },
      include: { items: true },
    });
    if (!purchase) return sendError(res, Errors.notFound('Purchase not found'));

    if (purchase.status === 'CANCELLED') {
      return sendError(res, Errors.conflict('Cannot receive against a cancelled purchase', 'PURCHASE_CANCELLED'));
    }
    if (purchase.status === 'RECEIVED') {
      return sendError(
        res,
        Errors.conflict('Purchase is already fully received', 'PURCHASE_ALREADY_RECEIVED'),
      );
    }

    // The destination branch for inventory: purchase's branchId, else active branch, else null.
    const destBranchId = purchase.branchId ?? req.activeBranchId ?? null;

    // Build a lookup of PurchaseItems by id.
    const itemById = new Map<string, any>(
      (purchase.items as any[]).map((it: any) => [it.id, it] as [string, any]),
    );
    const requestedIds = body.items.map((i) => i.purchaseItemId);
    const missing = requestedIds.filter((iid) => !itemById.has(iid));
    if (missing.length > 0) {
      return sendError(
        res,
        Errors.badRequest(
          `Unknown purchaseItemId(s): ${missing.join(', ')}`,
          'PURCHASE_ITEM_NOT_FOUND',
        ),
      );
    }

    const result = await prisma.$transaction(async (tx: Tx) => {
      const movements: Array<{
        productId: string;
        receivedQty: number;
        unitCostMinor: bigint;
        batchNo: string | null;
        expiryDate: Date | null;
      }> = [];

      for (const line of body.items) {
        const item = itemById.get(line.purchaseItemId)!;
        const newReceivedQty = item.receivedQty + line.receivedQty;
        if (newReceivedQty > item.orderedQty) {
          throw Errors.badRequest(
            `Cannot receive ${line.receivedQty} for item ${item.id}; would exceed ordered qty ${item.orderedQty}`,
            'RECEIVE_QTY_EXCEEDED',
          );
        }

        const batchNo = line.batchNo ?? item.batchNo ?? null;
        const expiryDate = line.expiryDate
          ? new Date(line.expiryDate)
          : item.expiryDate ?? null;

        const receivedQty = line.receivedQty;
        const unitCostMinor = item.unitCostMinor;
        const totalCostMinor = BigInt(receivedQty) * unitCostMinor;

        // 1. Update PurchaseItem.receivedQty
        await tx.purchaseItem.update({
          where: { id: item.id },
          data: { receivedQty: newReceivedQty },
        });

        // 2. Create InventoryMovement (PURCHASE_RECEIPT)
        await tx.inventoryMovement.create({
          data: {
            businessId: bizId,
            branchId: destBranchId,
            productId: item.productId,
            movementType: 'PURCHASE_RECEIPT',
            quantity: receivedQty,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            batchNo,
            expiryDate,
            unitCostMinor,
            totalCostMinor,
            reason: `Receipt for ${purchase.reference}`,
            responsibleUserId: req.user?.id ?? null,
          },
        });

        // 3. Update or create InventoryBalance; recompute WAC.
        const existingBalance = await tx.inventoryBalance.findFirst({
          where: { businessId: bizId, branchId: destBranchId, productId: item.productId },
          select: { id: true, quantity: true, wacCostMinor: true },
        });

        if (existingBalance) {
          const newQty = existingBalance.quantity + receivedQty;
          const newWac = computeWac(
            existingBalance.quantity,
            existingBalance.wacCostMinor,
            receivedQty,
            unitCostMinor,
          );
          await tx.inventoryBalance.update({
            where: { id: existingBalance.id },
            data: { quantity: newQty, wacCostMinor: newWac },
          });
        } else {
          // No existing balance — WAC is the incoming unit cost.
          await tx.inventoryBalance.create({
            data: {
              businessId: bizId,
              branchId: destBranchId,
              productId: item.productId,
              quantity: receivedQty,
              wacCostMinor: unitCostMinor,
            },
          });
        }

        // 4. Create StockBatch
        await tx.stockBatch.create({
          data: {
            businessId: bizId,
            productId: item.productId,
            batchNo,
            expiryDate,
            initialQty: receivedQty,
            remainingQty: receivedQty,
            unitCostMinor,
          },
        });

        movements.push({
          productId: item.productId,
          receivedQty,
          unitCostMinor,
          batchNo,
          expiryDate,
        });
      }

      // 5. Update Purchase.status + receivedAt.
      const refreshedItems = (await tx.purchaseItem.findMany({
        where: { purchaseId: purchase.id },
        select: { orderedQty: true, receivedQty: true },
      })) as any[];
      const allFullyReceived = refreshedItems.every(
        (it: any) => it.receivedQty >= it.orderedQty,
      );
      const anyReceived = refreshedItems.some((it: any) => it.receivedQty > 0);

      let newStatus: 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'RECEIVED';
      if (body.complete || allFullyReceived) {
        newStatus = 'RECEIVED';
      } else if (anyReceived) {
        newStatus = 'PARTIALLY_RECEIVED';
      } else {
        newStatus = purchase.status === 'ORDERED' ? 'ORDERED' : 'DRAFT';
      }

      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          status: newStatus,
          receivedAt: newStatus === 'RECEIVED' ? new Date() : purchase.receivedAt,
        },
      });

      return { updatedPurchase, movements };
    });

    writeAudit(req, {
      action: 'purchase.receive',
      resourceType: 'purchase',
      resourceId: purchase.id,
      change: {
        lines: body.items.map((l) => ({
          purchaseItemId: l.purchaseItemId,
          receivedQty: l.receivedQty,
        })),
        complete: body.complete,
        newStatus: result.updatedPurchase.status,
      },
    });

    const refreshed = await prisma.purchase.findUnique({
      where: { id: purchase.id },
      include: { items: true },
    });

    return sendSuccess(res, serializePurchase(refreshed), 'Goods received');
  }),
);

// =====================================================
// POST /purchases/:id/cancel — cancel purchase
// =====================================================
purchaseRouter.post(
  '/:id/cancel',
  requirePermission('purchase:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, status: true, reference: true },
    });
    if (!purchase) return sendError(res, Errors.notFound('Purchase not found'));

    if (purchase.status === 'RECEIVED') {
      return sendError(
        res,
        Errors.conflict('Cannot cancel a fully received purchase', 'PURCHASE_RECEIVED'),
      );
    }
    if (purchase.status === 'CANCELLED') {
      return sendSuccess(res, { id, status: 'CANCELLED' }, 'Already cancelled');
    }

    const updated = await prisma.purchase.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    writeAudit(req, {
      action: 'purchase.cancel',
      resourceType: 'purchase',
      resourceId: id,
      change: { reference: purchase.reference, previousStatus: purchase.status },
    });

    return sendSuccess(res, serializePurchase(updated), 'Purchase cancelled');
  }),
);

// =====================================================
// GET /purchases/:id/payments — list payments
// =====================================================
purchaseRouter.get(
  '/:id/payments',
  validateParams(IdParamsSchema),
  validateQuery(PaginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const query = req.query as unknown as z.infer<typeof PaginationSchema>;

    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, supplierId: true },
    });
    if (!purchase) return sendError(res, Errors.notFound('Purchase not found'));

    const where = { purchaseId: id, businessId: bizId };
    const total = await prisma.supplierPayment.count({ where });
    const payments = await prisma.supplierPayment.findMany({
      ...paginate({ where, orderBy: { paidAt: 'desc' } } as any, query),
      include: {
        supplier: { select: { id: true, name: true } },
      },
    } as any);

    const items = payments.map((p: any) => ({
      ...p,
      amountMinor: p.amountMinor.toString(),
    }));

    return sendSuccess(res, { items, meta: pageMeta(total, query) }, 'OK');
  }),
);

// =====================================================
// POST /purchases/:id/payments — record supplier payment
// =====================================================
purchaseRouter.post(
  '/:id/payments',
  requirePermission('purchase:manage'),
  validateParams(IdParamsSchema),
  validateBody(RecordPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof RecordPaymentSchema>;

    const amountMinor = toMinor(body.amount);
    if (amountMinor <= 0n) {
      return sendError(
        res,
        Errors.badRequest('Payment amount must be positive', 'INVALID_AMOUNT'),
      );
    }

    const purchase = await prisma.purchase.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, supplierId: true, totalCostMinor: true, paidAmountMinor: true, status: true },
    });
    if (!purchase) return sendError(res, Errors.notFound('Purchase not found'));

    if (!purchase.supplierId) {
      return sendError(
        res,
        Errors.badRequest(
          'Purchase has no supplier; cannot record a supplier payment',
          'NO_SUPPLIER_ON_PURCHASE',
        ),
      );
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    const payment = await prisma.$transaction(async (tx: Tx) => {
      const created = await tx.supplierPayment.create({
        data: {
          businessId: bizId,
          supplierId: purchase.supplierId!,
          purchaseId: purchase.id,
          amountMinor,
          paymentMethod: body.paymentMethod,
          reference: body.reference ?? null,
          paidAt,
        },
      });

      // Cap paidAmountMinor at totalCostMinor.
      const newPaid = BigInt(purchase.paidAmountMinor) + amountMinor;
      const total = BigInt(purchase.totalCostMinor);
      const capped = newPaid > total ? total : newPaid;
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { paidAmountMinor: capped },
      });

      return { created, newPaid, capped, total };
    });

    writeAudit(req, {
      action: 'purchase.payment',
      resourceType: 'supplier_payment',
      resourceId: payment.created.id,
      change: {
        purchaseId: purchase.id,
        supplierId: purchase.supplierId,
        amountMinor: amountMinor.toString(),
        paymentMethod: body.paymentMethod,
        newPaidAmountMinor: payment.capped.toString(),
        totalCostMinor: payment.total.toString(),
      },
    });

    return sendSuccess(
      res,
      {
        ...payment.created,
        amountMinor: payment.created.amountMinor.toString(),
        purchasePaidAmountMinor: payment.capped.toString(),
        purchaseTotalCostMinor: payment.total.toString(),
      },
      'Payment recorded',
      201,
    );
  }),
);
