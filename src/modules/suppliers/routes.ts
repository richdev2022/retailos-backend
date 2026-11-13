/**
 * @openapi
 * components:
 *   schemas:
 *     Supplier:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         name: { type: string }
 *         contactPerson: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         address: { type: string, nullable: true }
 *         notes: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         outstandingPayablesMinor: { type: string, description: "Σ purchases.totalCostMinor − Σ supplier_payments.amountMinor" }
 *     SupplierPayment:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         supplierId: { type: string, format: uuid }
 *         purchaseId: { type: string, format: uuid, nullable: true }
 *         amountMinor: { type: string }
 *         paymentMethod: { type: string }
 *         reference: { type: string, nullable: true }
 *         paidAt: { type: string, format: date-time }
 *         createdAt: { type: string, format: date-time }
 *
 * /suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Create a supplier
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
 *               contactPerson: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Supplier created }
 *   get:
 *     tags: [Suppliers]
 *     summary: List suppliers
 *     description: Paginated list with search; includes outstanding payables (Σ purchases.totalCostMinor − Σ supplier_payments.amountMinor).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated list of suppliers }
 *
 * /suppliers/{id}:
 *   get:
 *     tags: [Suppliers]
 *     summary: Get supplier with linked purchases summary
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Supplier detail with purchases summary }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Suppliers]
 *     summary: Update a supplier
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated supplier }
 *   delete:
 *     tags: [Suppliers]
 *     summary: Delete a supplier
 *     description: Removes a supplier. Blocked if the supplier has payments on file (cascade would lose financial history). Linked purchases are SetNull'd automatically.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Supplier removed }
 *       409: { description: Supplier has financial records and cannot be removed }
 *
 * /suppliers/{id}/purchases:
 *   get:
 *     tags: [Suppliers]
 *     summary: Paginated purchase history for a supplier
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Paginated purchases }
 *
 * /suppliers/{id}/payments:
 *   get:
 *     tags: [Suppliers]
 *     summary: Supplier payment history
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *     responses:
 *       200: { description: Paginated payments }
 *   post:
 *     tags: [Suppliers]
 *     summary: Record a supplier payment
 *     description: Records a payment to a supplier. If a purchaseId is supplied, the linked Purchase.paidAmountMinor is increased (and the supplier's outstanding payables reduced) accordingly.
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
 *               amount: { type: string, description: "Decimal major units, e.g. '1250.50'" }
 *               paymentMethod: { type: string }
 *               reference: { type: string }
 *               purchaseId: { type: string, format: uuid }
 *               paidAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Payment recorded }
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
import { toMinor } from '../../utils/money.js';
import { paginate, pageMeta, PaginationSchema } from '../../utils/pagination.js';
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';

// =====================================================
// Router setup
// =====================================================

export const supplierRouter = Router();

// All supplier routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
supplierRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

const PaymentMethodSchema = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'CARD_POS',
  'CUSTOMER_CREDIT',
  'OTHER',
]);

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
 * Compute outstanding payables per supplier for the given supplier ids.
 *
 * Outstanding payables = Σ(purchases.totalCostMinor) − Σ(supplier_payments.amountMinor)
 * for that supplier.
 */
async function payablesBySupplier(
  businessId: string,
  supplierIds: string[],
): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  if (supplierIds.length === 0) return out;

  const [purchases, payments] = await Promise.all([
    prisma.purchase.groupBy({
      by: ['supplierId'],
      where: {
        businessId,
        supplierId: { in: supplierIds },
        status: { not: 'CANCELLED' },
      },
      _sum: { totalCostMinor: true },
    }),
    prisma.supplierPayment.groupBy({
      by: ['supplierId'],
      where: { businessId, supplierId: { in: supplierIds } },
      _sum: { amountMinor: true },
    }),
  ]);

  for (const p of purchases) {
    if (!p.supplierId) continue;
    out.set(p.supplierId, BigInt(p._sum.totalCostMinor ?? 0n));
  }
  for (const p of payments) {
    if (!p.supplierId) continue;
    const cur = out.get(p.supplierId) ?? 0n;
    const paid = BigInt(p._sum.amountMinor ?? 0n);
    const diff = cur - paid;
    out.set(p.supplierId, diff < 0n ? 0n : diff);
  }
  return out;
}

/** Serialise a supplier record so any BigInt fields become strings. */
function serializeSupplier(s: any, outstandingMinor?: bigint) {
  return {
    ...s,
    outstandingPayablesMinor:
      outstandingMinor != null ? outstandingMinor.toString() : '0',
  };
}

// =====================================================
// Schemas
// =====================================================

const CreateSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  contactPerson: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateSupplierSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contactPerson: z.string().max(200).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const ListSuppliersQuerySchema = PaginationSchema.extend({});

const SupplierPurchasesQuerySchema = PaginationSchema.extend({
  status: z.string().max(40).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const moneyInput = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
  z.number().nonnegative().finite(),
]);

const RecordSupplierPaymentSchema = z.object({
  amount: moneyInput.transform((v: string | number) => String(v)),
  paymentMethod: PaymentMethodSchema,
  reference: z.string().max(200).optional().nullable(),
  purchaseId: z.string().uuid().optional().nullable(),
  paidAt: z.string().datetime().optional(),
});

// =====================================================
// POST /suppliers — create
// =====================================================
supplierRouter.post(
  '/',
  requirePermission('supplier:manage'),
  validateBody(CreateSupplierSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateSupplierSchema>;

    const supplier = await prisma.supplier.create({
      data: {
        businessId: bizId,
        name: body.name,
        contactPerson: body.contactPerson ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        notes: body.notes ?? null,
      },
    });

    writeAudit(req, {
      action: 'supplier.create',
      resourceType: 'supplier',
      resourceId: supplier.id,
      change: { name: supplier.name },
    });

    return sendSuccess(
      res,
      serializeSupplier(supplier, 0n),
      'Supplier created',
      201,
    );
  }),
);

// =====================================================
// GET /suppliers — list with search and outstanding payables
// =====================================================
supplierRouter.get(
  '/',
  validateQuery(ListSuppliersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as z.infer<typeof ListSuppliersQuerySchema>;

    const where: Record<string, unknown> = { businessId: bizId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { contactPerson: { contains: query.search } },
        { phone: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    const total = await prisma.supplier.count({ where });
    const suppliers = await prisma.supplier.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' } } as any, query),
    } as any);

    const payables = await payablesBySupplier(
      bizId,
      suppliers.map((s: any) => s.id),
    );

    const items = suppliers.map((s: any) =>
      serializeSupplier(s, payables.get(s.id) ?? 0n),
    );

    return sendSuccess(res, { items, meta: pageMeta(total, query) }, 'OK');
  }),
);

// =====================================================
// GET /suppliers/:id — get with linked purchases summary
// =====================================================
supplierRouter.get(
  '/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const supplier = await prisma.supplier.findFirst({
      where: { id, businessId: bizId },
    });
    if (!supplier) return sendError(res, Errors.notFound('Supplier not found'));

    const [purchasesAgg, paymentsAgg, purchasesCount, lastPurchase] =
      await Promise.all([
        prisma.purchase.aggregate({
          _sum: { totalCostMinor: true, paidAmountMinor: true },
          where: { supplierId: id, businessId: bizId, status: { not: 'CANCELLED' } },
        }),
        prisma.supplierPayment.aggregate({
          _sum: { amountMinor: true },
          where: { supplierId: id, businessId: bizId },
        }),
        prisma.purchase.count({
          where: { supplierId: id, businessId: bizId, status: { not: 'CANCELLED' } },
        }),
        prisma.purchase.findFirst({
          where: { supplierId: id, businessId: bizId },
          orderBy: { orderDate: 'desc' },
          select: { id: true, reference: true, orderDate: true, totalCostMinor: true, status: true },
        }),
      ]);

    const totalCost = BigInt(purchasesAgg._sum.totalCostMinor ?? 0n);
    const totalPaid = BigInt(paymentsAgg._sum.amountMinor ?? 0n);
    const outstanding = totalCost - totalPaid;

    const summary = {
      totalPurchases: purchasesCount,
      totalCostMinor: totalCost.toString(),
      totalPaidMinor: totalPaid.toString(),
      outstandingPayablesMinor: (outstanding < 0n ? 0n : outstanding).toString(),
      lastPurchase: lastPurchase
        ? {
            ...lastPurchase,
            totalCostMinor: lastPurchase.totalCostMinor.toString(),
          }
        : null,
    };

    return sendSuccess(
      res,
      { ...serializeSupplier(supplier, outstanding < 0n ? 0n : outstanding), summary },
      'OK',
    );
  }),
);

// =====================================================
// PATCH /suppliers/:id — update
// =====================================================
supplierRouter.patch(
  '/:id',
  requirePermission('supplier:manage'),
  validateParams(IdParamsSchema),
  validateBody(UpdateSupplierSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof UpdateSupplierSchema>;

    const existing = await prisma.supplier.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!existing) return sendError(res, Errors.notFound('Supplier not found'));

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.contactPerson !== undefined ? { contactPerson: body.contactPerson } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    writeAudit(req, {
      action: 'supplier.update',
      resourceType: 'supplier',
      resourceId: id,
      change: body,
    });

    return sendSuccess(res, serializeSupplier(updated, 0n), 'Supplier updated');
  }),
);

// =====================================================
// DELETE /suppliers/:id — archive (hard delete with safeguards)
// =====================================================
// The Supplier model has no archivedAt field; we implement "archive" as a
// hard delete. To preserve financial audit data we BLOCK deletion if the
// supplier has payments on file (those would be cascade-deleted).
// Linked purchases are SetNull'd by the optional relation default.
supplierRouter.delete(
  '/:id',
  requirePermission('supplier:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const supplier = await prisma.supplier.findFirst({
      where: { id, businessId: bizId },
      include: {
        _count: { select: { payments: true, purchases: true } },
      },
    });
    if (!supplier) return sendError(res, Errors.notFound('Supplier not found'));

    if (supplier._count.payments > 0) {
      return sendError(
        res,
        Errors.conflict(
          `Cannot archive supplier with ${supplier._count.payments} payment(s) on file. Settle or reassign those first.`,
          'SUPPLIER_HAS_FINANCIAL_RECORDS',
        ),
      );
    }

    await prisma.supplier.delete({ where: { id } });

    writeAudit(req, {
      action: 'supplier.archive',
      resourceType: 'supplier',
      resourceId: id,
      change: {
        name: supplier.name,
        phone: supplier.phone,
        email: supplier.email,
        purchasesLinked: supplier._count.purchases,
      },
    });

    return sendSuccess(res, { id, archived: true }, 'Supplier archived');
  }),
);

// =====================================================
// GET /suppliers/:id/purchases — paginated purchase history
// =====================================================
supplierRouter.get(
  '/:id/purchases',
  validateParams(IdParamsSchema),
  validateQuery(SupplierPurchasesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const query = req.query as unknown as z.infer<typeof SupplierPurchasesQuerySchema>;

    const supplier = await prisma.supplier.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!supplier) return sendError(res, Errors.notFound('Supplier not found'));

    const where: Record<string, unknown> = {
      supplierId: id,
      businessId: bizId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            orderDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const total = await prisma.purchase.count({ where });
    const purchases = await prisma.purchase.findMany({
      ...paginate({ where, orderBy: { orderDate: 'desc' } } as any, query),
      select: {
        id: true,
        reference: true,
        status: true,
        orderDate: true,
        receivedAt: true,
        totalCostMinor: true,
        paidAmountMinor: true,
        branchId: true,
        _count: { select: { items: true } },
      },
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
// GET /suppliers/:id/payments — supplier payment history
// =====================================================
supplierRouter.get(
  '/:id/payments',
  validateParams(IdParamsSchema),
  validateQuery(PaginationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const query = req.query as unknown as z.infer<typeof PaginationSchema>;

    const supplier = await prisma.supplier.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!supplier) return sendError(res, Errors.notFound('Supplier not found'));

    const where = { supplierId: id, businessId: bizId };
    const total = await prisma.supplierPayment.count({ where });
    const payments = await prisma.supplierPayment.findMany({
      ...paginate({ where, orderBy: { paidAt: 'desc' } } as any, query),
      include: {
        purchase: {
          select: { id: true, reference: true, orderDate: true, totalCostMinor: true },
        },
      },
    } as any);

    const items = payments.map((p: any) => ({
      ...p,
      amountMinor: p.amountMinor.toString(),
      purchase: p.purchase
        ? { ...p.purchase, totalCostMinor: p.purchase.totalCostMinor.toString() }
        : null,
    }));

    return sendSuccess(res, { items, meta: pageMeta(total, query) }, 'OK');
  }),
);

// =====================================================
// POST /suppliers/:id/payments — record a supplier payment
// =====================================================
supplierRouter.post(
  '/:id/payments',
  requirePermission('purchase:manage'),
  validateParams(IdParamsSchema),
  validateBody(RecordSupplierPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof RecordSupplierPaymentSchema>;

    const amountMinor = toMinor(body.amount);
    if (amountMinor <= 0n) {
      return sendError(res, Errors.badRequest('Payment amount must be positive', 'INVALID_AMOUNT'));
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!supplier) return sendError(res, Errors.notFound('Supplier not found'));

    if (body.purchaseId) {
      const purchase = await prisma.purchase.findFirst({
        where: { id: body.purchaseId, businessId: bizId, supplierId: id },
        select: { id: true },
      });
      if (!purchase) {
        return sendError(
          res,
          Errors.badRequest('Purchase not found for this supplier', 'PURCHASE_NOT_FOUND'),
        );
      }
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    const payment = await prisma.$transaction(async (tx: any) => {
      const created = await tx.supplierPayment.create({
        data: {
          businessId: bizId,
          supplierId: id,
          purchaseId: body.purchaseId ?? null,
          amountMinor,
          paymentMethod: body.paymentMethod,
          reference: body.reference ?? null,
          paidAt,
        },
      });

      // If linked to a purchase, increase paidAmountMinor (capped at totalCostMinor).
      if (body.purchaseId) {
        const purchase = await tx.purchase.findUnique({
          where: { id: body.purchaseId },
          select: { totalCostMinor: true, paidAmountMinor: true },
        });
        if (purchase) {
          const newPaid = BigInt(purchase.paidAmountMinor) + amountMinor;
          const total = BigInt(purchase.totalCostMinor);
          const capped = newPaid > total ? total : newPaid;
          await tx.purchase.update({
            where: { id: body.purchaseId },
            data: { paidAmountMinor: capped },
          });
        }
      }

      return created;
    });

    writeAudit(req, {
      action: 'supplier.payment',
      resourceType: 'supplier_payment',
      resourceId: payment.id,
      change: {
        supplierId: id,
        amountMinor: amountMinor.toString(),
        paymentMethod: body.paymentMethod,
        purchaseId: body.purchaseId ?? null,
      },
    });

    return sendSuccess(
      res,
      { ...payment, amountMinor: payment.amountMinor.toString() },
      'Payment recorded',
      201,
    );
  }),
);
