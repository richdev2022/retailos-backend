/**
 * @openapi
 * components:
 *   schemas:
 *     Customer:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         name: { type: string }
 *         phone: { type: string, nullable: true }
 *         email: { type: string, nullable: true }
 *         address: { type: string, nullable: true }
 *         type: { type: string, nullable: true, description: "Free-form classification, e.g. INDIVIDUAL, RETAILER, WHOLESALE" }
 *         notes: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         outstandingBalanceMinor: { type: string, description: "Integer minor units (kobo) — computed: OPEN/PARTIALLY_SETTLED credits − payments" }
 *     CustomerCredit:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         customerId: { type: string, format: uuid }
 *         saleId: { type: string, format: uuid, nullable: true }
 *         amountMinor: { type: string, description: "Original outstanding credit, integer minor units" }
 *         dueDate: { type: string, format: date-time, nullable: true }
 *         status: { type: string, enum: [OPEN, PARTIALLY_SETTLED, SETTLED, WRITTEN_OFF] }
 *         createdAt: { type: string, format: date-time }
 *         settledAt: { type: string, format: date-time, nullable: true }
 *     CustomerPayment:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         customerId: { type: string, format: uuid }
 *         saleId: { type: string, format: uuid, nullable: true }
 *         amountMinor: { type: string }
 *         paymentMethod: { type: string }
 *         reference: { type: string, nullable: true }
 *         paidAt: { type: string, format: date-time }
 *         createdAt: { type: string, format: date-time }
 *
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a customer
 *     description: Creates a new customer in the active business. Tenant-scoped via X-Business-Id header.
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
 *               type: { type: string }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Customer created }
 *   get:
 *     tags: [Customers]
 *     summary: List customers
 *     description: Paginated list with search and type filter; includes the customer's outstanding balance (OPEN/PARTIALLY_SETTLED credits − payments).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: type, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated list of customers }
 *
 * /customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get customer with purchase history summary
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Customer detail with sales summary metrics }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Customers]
 *     summary: Update a customer
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated customer }
 *   delete:
 *     tags: [Customers]
 *     summary: Delete a customer
 *     description: Removes a customer. Blocked if the customer has credits or payments on file (those would be cascade-deleted and lose financial history). Reassign or settle those first.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Customer removed }
 *       409: { description: Customer has financial records and cannot be removed }
 *
 * /customers/{id}/sales:
 *   get:
 *     tags: [Customers]
 *     summary: Customer sale history (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Paginated sale history }
 *
 * /customers/{id}/credits:
 *   get:
 *     tags: [Customers]
 *     summary: Outstanding credit records for a customer
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [OPEN, PARTIALLY_SETTLED, SETTLED, WRITTEN_OFF] } }
 *       - { in: query, name: includeSettled, schema: { type: boolean, default: false } }
 *     responses:
 *       200: { description: List of credit records }
 *
 * /customers/{id}/payments:
 *   post:
 *     tags: [Customers]
 *     summary: Record a customer payment
 *     description: Records a payment against a customer. The payment is allocated FIFO to the customer's OPEN/PARTIALLY_SETTLED credits. Credits fully covered by cumulative payments are marked SETTLED; partially covered ones become PARTIALLY_SETTLED. If a saleId is supplied, the linked Sale's amountPaidMinor/outstandingMinor are updated accordingly.
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
 *               saleId: { type: string, format: uuid }
 *               paidAt: { type: string, format: date-time }
 *     responses:
 *       201: { description: Payment recorded with allocation breakdown }
 *
 * /customers/{id}/statement:
 *   get:
 *     tags: [Customers]
 *     summary: Customer statement over a date range
 *     description: Returns opening balance, sales (credits taken) and payments in the range, and closing balance. All money fields are returned as integer-minor-unit strings.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Customer statement }
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

export const customerRouter = Router();

// All customer routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
customerRouter.use(tenantContext);

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

const CreditStatusSchema = z.enum([
  'OPEN',
  'PARTIALLY_SETTLED',
  'SETTLED',
  'WRITTEN_OFF',
]);

/** Boolean from a query-string value. Handles "true"/"false"/"1"/"0". */
const boolQuery = z.preprocess((v: unknown) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  if (Array.isArray(v)) return v[0] === 'true' || v[0] === '1';
  return false;
}, z.boolean());

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
 * Compute outstanding balance per customer for the given customer ids.
 *
 * Outstanding = Σ(credit.amountMinor where status ∈ {OPEN, PARTIALLY_SETTLED})
 *              − Σ(payment.amountMinor for the same customer)
 *
 * Result is keyed by customerId; absent → 0n.
 */
async function outstandingByCustomer(
  businessId: string,
  customerIds: string[],
): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  if (customerIds.length === 0) return out;

  const [credits, payments] = await Promise.all([
    prisma.customerCredit.groupBy({
      by: ['customerId'],
      where: {
        businessId,
        customerId: { in: customerIds },
        status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
      },
      _sum: { amountMinor: true },
    }),
    prisma.customerPayment.groupBy({
      by: ['customerId'],
      where: { businessId, customerId: { in: customerIds } },
      _sum: { amountMinor: true },
    }),
  ]);

  for (const c of credits) {
    out.set(c.customerId, BigInt(c._sum.amountMinor ?? 0n));
  }
  for (const p of payments) {
    const cur = out.get(p.customerId) ?? 0n;
    const settled = BigInt(p._sum.amountMinor ?? 0n);
    const diff = cur - settled;
    out.set(p.customerId, diff < 0n ? 0n : diff);
  }
  return out;
}

/** Serialise a customer record so any BigInt fields become strings. */
function serializeCustomer(c: any, outstandingMinor?: bigint) {
  return {
    ...c,
    outstandingBalanceMinor:
      outstandingMinor != null ? outstandingMinor.toString() : '0',
  };
}

// =====================================================
// Schemas
// =====================================================

const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  type: z.string().max(80).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const UpdateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  type: z.string().max(80).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const ListCustomersQuerySchema = PaginationSchema.extend({
  type: z.string().max(80).optional(),
});

const CustomerSalesQuerySchema = PaginationSchema.extend({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
  status: z.string().max(40).optional(),
});

const CustomerCreditsQuerySchema = z.object({
  status: CreditStatusSchema.optional(),
  includeSettled: boolQuery.default(false),
});

const CustomerStatementQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const moneyInput = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
  z.number().nonnegative().finite(),
]);

const RecordPaymentSchema = z.object({
  amount: moneyInput.transform((v: string | number) => String(v)),
  paymentMethod: PaymentMethodSchema,
  reference: z.string().max(200).optional().nullable(),
  saleId: z.string().uuid().optional().nullable(),
  paidAt: z.string().datetime().optional(),
});

// =====================================================
// POST /customers — create
// =====================================================
customerRouter.post(
  '/',
  requirePermission('customer:manage'),
  validateBody(CreateCustomerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateCustomerSchema>;

    const customer = await prisma.customer.create({
      data: {
        businessId: bizId,
        name: body.name,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
        type: body.type ?? null,
        notes: body.notes ?? null,
      },
    });

    writeAudit(req, {
      action: 'customer.create',
      resourceType: 'customer',
      resourceId: customer.id,
      change: { name: customer.name, type: customer.type },
    });

    return sendSuccess(
      res,
      serializeCustomer(customer, 0n),
      'Customer created',
      201,
    );
  }),
);

// =====================================================
// GET /customers — list with search, type filter, outstanding balance
// =====================================================
customerRouter.get(
  '/',
  validateQuery(ListCustomersQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as z.infer<typeof ListCustomersQuerySchema>;

    const where: Record<string, unknown> = { businessId: bizId };
    if (query.type) where.type = query.type;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { phone: { contains: query.search } },
        { email: { contains: query.search } },
      ];
    }

    const total = await prisma.customer.count({ where });
    const customers = await prisma.customer.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' } } as any, query),
    } as any);

    const outstanding = await outstandingByCustomer(
      bizId,
      customers.map((c: any) => c.id),
    );

    const items = customers.map((c: any) =>
      serializeCustomer(c, outstanding.get(c.id) ?? 0n),
    );

    return sendSuccess(res, { items, meta: pageMeta(total, query) }, 'OK');
  }),
);

// =====================================================
// GET /customers/:id — get with purchase history summary
// =====================================================
customerRouter.get(
  '/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: bizId },
    });
    if (!customer) return sendError(res, Errors.notFound('Customer not found'));

    const [salesAgg, lastSale, creditsAgg, paymentsAgg, salesCount] =
      await Promise.all([
        prisma.sale.aggregate({
          _sum: { totalMinor: true, outstandingMinor: true },
          _count: true,
          where: { customerId: id, status: { notIn: ['CANCELLED', 'DRAFT'] } },
        }),
        prisma.sale.findFirst({
          where: { customerId: id },
          orderBy: { saleDate: 'desc' },
          select: { id: true, receiptNo: true, saleDate: true, totalMinor: true, status: true },
        }),
        prisma.customerCredit.aggregate({
          _sum: { amountMinor: true },
          where: { customerId: id, status: { in: ['OPEN', 'PARTIALLY_SETTLED'] } },
        }),
        prisma.customerPayment.aggregate({
          _sum: { amountMinor: true },
          where: { customerId: id },
        }),
        prisma.sale.count({
          where: { customerId: id, status: { notIn: ['CANCELLED', 'DRAFT'] } },
        }),
      ]);

    const totalCredits = BigInt(creditsAgg._sum.amountMinor ?? 0n);
    const totalPayments = BigInt(paymentsAgg._sum.amountMinor ?? 0n);
    const outstanding = totalCredits - totalPayments;
    const totalSpent = BigInt(salesAgg._sum.totalMinor ?? 0n);
    const outstandingOnSales = BigInt(salesAgg._sum.outstandingMinor ?? 0n);

    const summary = {
      totalSales: salesCount,
      totalSpentMinor: totalSpent.toString(),
      outstandingOnSalesMinor: outstandingOnSales.toString(),
      outstandingBalanceMinor: (outstanding < 0n ? 0n : outstanding).toString(),
      lastSale: lastSale
        ? {
            ...lastSale,
            totalMinor: lastSale.totalMinor.toString(),
          }
        : null,
    };

    return sendSuccess(res, serializeCustomer(customer, outstanding < 0n ? 0n : outstanding), 'OK');
  }),
);

// =====================================================
// PATCH /customers/:id — update
// =====================================================
customerRouter.patch(
  '/:id',
  requirePermission('customer:manage'),
  validateParams(IdParamsSchema),
  validateBody(UpdateCustomerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof UpdateCustomerSchema>;

    const existing = await prisma.customer.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!existing) return sendError(res, Errors.notFound('Customer not found'));

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.address !== undefined ? { address: body.address } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });

    writeAudit(req, {
      action: 'customer.update',
      resourceType: 'customer',
      resourceId: id,
      change: body,
    });

    return sendSuccess(res, serializeCustomer(updated, 0n), 'Customer updated');
  }),
);

// =====================================================
// DELETE /customers/:id — archive (hard delete with safeguards)
// =====================================================
// The Customer model has no archivedAt field; we implement "archive" as a
// hard delete. To preserve financial audit data we BLOCK deletion if the
// customer has credits or payments on file (those would be cascade-deleted).
// The full record snapshot is written to the audit log.
customerRouter.delete(
  '/:id',
  requirePermission('customer:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: bizId },
      include: {
        _count: { select: { credits: true, payments: true, sales: true } },
      },
    });
    if (!customer) return sendError(res, Errors.notFound('Customer not found'));

    if (customer._count.credits > 0 || customer._count.payments > 0) {
      return sendError(
        res,
        Errors.conflict(
          `Cannot archive customer with ${customer._count.credits} credit(s) and ${customer._count.payments} payment(s) on file. Settle or reassign those first.`,
          'CUSTOMER_HAS_FINANCIAL_RECORDS',
        ),
      );
    }

    await prisma.customer.delete({ where: { id } });

    writeAudit(req, {
      action: 'customer.archive',
      resourceType: 'customer',
      resourceId: id,
      change: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        type: customer.type,
        salesLinked: customer._count.sales,
      },
    });

    return sendSuccess(res, { id, archived: true }, 'Customer archived');
  }),
);

// =====================================================
// GET /customers/:id/sales — paginated sale history
// =====================================================
customerRouter.get(
  '/:id/sales',
  validateParams(IdParamsSchema),
  validateQuery(CustomerSalesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const query = req.query as unknown as z.infer<typeof CustomerSalesQuerySchema>;

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!customer) return sendError(res, Errors.notFound('Customer not found'));

    const where: Record<string, unknown> = {
      customerId: id,
      businessId: bizId,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            saleDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const total = await prisma.sale.count({ where });
    const sales = await prisma.sale.findMany({
      ...paginate({ where, orderBy: { saleDate: 'desc' } } as any, query),
      select: {
        id: true,
        receiptNo: true,
        saleDate: true,
        status: true,
        subtotalMinor: true,
        discountMinor: true,
        taxMinor: true,
        totalMinor: true,
        amountPaidMinor: true,
        outstandingMinor: true,
        branchId: true,
        _count: { select: { items: true } },
      },
    } as any);

    const items = sales.map((s: any) => ({
      ...s,
      subtotalMinor: s.subtotalMinor.toString(),
      discountMinor: s.discountMinor.toString(),
      taxMinor: s.taxMinor.toString(),
      totalMinor: s.totalMinor.toString(),
      amountPaidMinor: s.amountPaidMinor.toString(),
      outstandingMinor: s.outstandingMinor.toString(),
    }));

    return sendSuccess(res, { items, meta: pageMeta(total, query) }, 'OK');
  }),
);

// =====================================================
// GET /customers/:id/credits — outstanding credit records
// =====================================================
customerRouter.get(
  '/:id/credits',
  validateParams(IdParamsSchema),
  validateQuery(CustomerCreditsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const query = req.query as unknown as z.infer<typeof CustomerCreditsQuerySchema>;

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!customer) return sendError(res, Errors.notFound('Customer not found'));

    const where: Record<string, unknown> = { customerId: id, businessId: bizId };
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeSettled) {
      where.status = { in: ['OPEN', 'PARTIALLY_SETTLED'] };
    }

    const credits = await prisma.customerCredit.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        sale: {
          select: { id: true, receiptNo: true, saleDate: true, totalMinor: true },
        },
      },
    });

    const items = credits.map((c: any) => ({
      ...c,
      amountMinor: c.amountMinor.toString(),
      sale: c.sale
        ? { ...c.sale, totalMinor: c.sale.totalMinor.toString() }
        : null,
    }));

    const totalOutstanding = credits.reduce(
      (acc: bigint, c: any) =>
        c.status === 'OPEN' || c.status === 'PARTIALLY_SETTLED'
          ? acc + BigInt(c.amountMinor)
          : acc,
      0n,
    );

    return sendSuccess(
      res,
      { items, totalOutstandingMinor: totalOutstanding.toString() },
      'OK',
    );
  }),
);

// =====================================================
// POST /customers/:id/payments — record a customer payment (settles outstanding credit)
// =====================================================
customerRouter.post(
  '/:id/payments',
  requirePermission('customer:manage'),
  validateParams(IdParamsSchema),
  validateBody(RecordPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof RecordPaymentSchema>;

    const amountMinor = toMinor(body.amount);
    if (amountMinor <= 0n) {
      return sendError(res, Errors.badRequest('Payment amount must be positive', 'INVALID_AMOUNT'));
    }

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!customer) return sendError(res, Errors.notFound('Customer not found'));

    // Optional: link to a specific sale — verify it belongs to this customer & business.
    if (body.saleId) {
      const sale = await prisma.sale.findFirst({
        where: { id: body.saleId, businessId: bizId, customerId: id },
        select: { id: true },
      });
      if (!sale) {
        return sendError(
          res,
          Errors.badRequest('Sale not found for this customer', 'SALE_NOT_FOUND'),
        );
      }
    }

    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();

    // Allocate payment FIFO to OPEN/PARTIALLY_SETTLED credits. If a saleId is
    // supplied, prefer credits linked to that sale first, then fall back to
    // other open credits. Reduce credit.amountMinor and update status.
    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Fetch credits to settle (FIFO).
      const credits = await tx.customerCredit.findMany({
        where: {
          customerId: id,
          businessId: bizId,
          status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
        },
        orderBy: [
          // Linked sale first (if specified), then oldest credit first.
          { createdAt: 'asc' },
        ],
      });

      // Build allocation plan.
      const linkedFirst = body.saleId
        ? credits.filter((c: any) => c.saleId === body.saleId)
        : [];
      const others = body.saleId
        ? credits.filter((c: any) => c.saleId !== body.saleId)
        : credits;
      const ordered = [...linkedFirst, ...others];

      const allocations: Array<{
        creditId: string;
        appliedMinor: bigint;
        settled: boolean;
      }> = [];
      let remaining = amountMinor;

      for (const credit of ordered) {
        if (remaining <= 0n) break;
        const creditOutstanding = BigInt(credit.amountMinor);
        const applied = remaining >= creditOutstanding ? creditOutstanding : remaining;
        const newAmount = creditOutstanding - applied;
        const newStatus =
          newAmount === 0n
            ? 'SETTLED'
            : 'PARTIALLY_SETTLED';
        await tx.customerCredit.update({
          where: { id: credit.id },
          data: {
            amountMinor: newAmount,
            status: newStatus,
            settledAt: newAmount === 0n ? paidAt : null,
          },
        });
        allocations.push({
          creditId: credit.id,
          appliedMinor: applied,
          settled: newAmount === 0n,
        });
        remaining -= applied;
      }

      // 2. Create the CustomerPayment record (always for the full amount —
      //    any excess over outstanding is recorded as a prepayment / credit balance).
      const payment = await tx.customerPayment.create({
        data: {
          businessId: bizId,
          customerId: id,
          saleId: body.saleId ?? null,
          amountMinor,
          paymentMethod: body.paymentMethod,
          reference: body.reference ?? null,
          paidAt,
        },
      });

      // 3. If a saleId is provided, update the linked Sale's amountPaid/outstanding.
      if (body.saleId) {
        const sale = await tx.sale.findUnique({
          where: { id: body.saleId },
          select: { totalMinor: true, amountPaidMinor: true, outstandingMinor: true },
        });
        if (sale) {
          const newPaid = BigInt(sale.amountPaidMinor) + amountMinor;
          const total = BigInt(sale.totalMinor);
          const newOutstanding = total - newPaid;
          await tx.sale.update({
            where: { id: body.saleId },
            data: {
              amountPaidMinor: newPaid,
              outstandingMinor: newOutstanding < 0n ? 0n : newOutstanding,
              status:
                newOutstanding <= 0n
                  ? 'COMPLETED'
                  : newPaid > 0n
                    ? 'PARTIALLY_PAID'
                    : 'PENDING_PAYMENT',
            },
          });
        }
      }

      return { payment, allocations, unallocatedMinor: remaining };
    });

    writeAudit(req, {
      action: 'customer.payment',
      resourceType: 'customer_payment',
      resourceId: result.payment.id,
      change: {
        customerId: id,
        amountMinor: amountMinor.toString(),
        paymentMethod: body.paymentMethod,
        saleId: body.saleId ?? null,
        allocations: result.allocations.map((a: any) => ({
          creditId: a.creditId,
          appliedMinor: a.appliedMinor.toString(),
          settled: a.settled,
        })),
        unallocatedMinor: result.unallocatedMinor.toString(),
      },
    });

    return sendSuccess(
      res,
      {
        payment: {
          ...result.payment,
          amountMinor: result.payment.amountMinor.toString(),
        },
        allocations: result.allocations.map((a: any) => ({
          ...a,
          appliedMinor: a.appliedMinor.toString(),
        })),
        unallocatedMinor: result.unallocatedMinor.toString(),
      },
      'Payment recorded',
      201,
    );
  }),
);

// =====================================================
// GET /customers/:id/statement — customer statement over a date range
// =====================================================
customerRouter.get(
  '/:id/statement',
  validateParams(IdParamsSchema),
  validateQuery(CustomerStatementQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const query = req.query as unknown as z.infer<typeof CustomerStatementQuerySchema>;

    const customer = await prisma.customer.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, name: true, phone: true, email: true },
    });
    if (!customer) return sendError(res, Errors.notFound('Customer not found'));

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;

    // Opening balance = Σ credits created before `from` − Σ payments paid before `from`.
    // If `from` is omitted, opening = 0.
    let openingCreditsMinor = 0n;
    let openingPaymentsMinor = 0n;
    if (from) {
      const [openingC, openingP] = await Promise.all([
        prisma.customerCredit.aggregate({
          _sum: { amountMinor: true },
          where: { customerId: id, businessId: bizId, createdAt: { lt: from } },
        }),
        prisma.customerPayment.aggregate({
          _sum: { amountMinor: true },
          where: { customerId: id, businessId: bizId, paidAt: { lt: from } },
        }),
      ]);
      openingCreditsMinor = BigInt(openingC._sum.amountMinor ?? 0n);
      openingPaymentsMinor = BigInt(openingP._sum.amountMinor ?? 0n);
    }

    // Activity in range.
    const creditsWhere: Record<string, unknown> = {
      customerId: id,
      businessId: bizId,
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };
    const paymentsWhere: Record<string, unknown> = {
      customerId: id,
      businessId: bizId,
      ...(from || to
        ? {
            paidAt: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    };

    const [credits, payments] = await Promise.all([
      prisma.customerCredit.findMany({
        where: creditsWhere,
        orderBy: { createdAt: 'asc' },
        include: {
          sale: { select: { id: true, receiptNo: true, saleDate: true, totalMinor: true } },
        },
      }),
      prisma.customerPayment.findMany({
        where: paymentsWhere,
        orderBy: { paidAt: 'asc' },
      }),
    ]);

    const creditsMinor = credits.reduce(
      (acc: bigint, c: any) => acc + BigInt(c.amountMinor),
      0n,
    );
    const paymentsMinor = payments.reduce(
      (acc: bigint, p: any) => acc + BigInt(p.amountMinor),
      0n,
    );

    const opening = openingCreditsMinor - openingPaymentsMinor;
    const closing = opening + creditsMinor - paymentsMinor;

    return sendSuccess(
      res,
      {
        customer,
        range: { from: from ?? null, to: to ?? null },
        openingBalanceMinor: opening.toString(),
        closingBalanceMinor: closing.toString(),
        totals: {
          creditsMinor: creditsMinor.toString(),
          paymentsMinor: paymentsMinor.toString(),
        },
        activity: {
          credits: credits.map((c: any) => ({
            ...c,
            amountMinor: c.amountMinor.toString(),
            sale: c.sale
              ? { ...c.sale, totalMinor: c.sale.totalMinor.toString() }
              : null,
          })),
          payments: payments.map((p: any) => ({
            ...p,
            amountMinor: p.amountMinor.toString(),
          })),
        },
      },
      'OK',
    );
  }),
);
