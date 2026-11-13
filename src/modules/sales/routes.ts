/**
 * @openapi
 * components:
 *   schemas:
 *     Sale:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         cashierId: { type: string, format: uuid }
 *         customerId: { type: string, format: uuid, nullable: true }
 *         receiptNo: { type: string }
 *         syncId: { type: string, nullable: true, description: "Client-generated idempotency key (offline sync)" }
 *         status:
 *           type: string
 *           enum: [DRAFT, PENDING_PAYMENT, PARTIALLY_PAID, COMPLETED, CANCELLED, REFUNDED]
 *         subtotalMinor: { type: string, description: "Integer minor units (kobo)" }
 *         discountMinor: { type: string, description: "Item discounts + cart-level discount" }
 *         taxMinor: { type: string }
 *         totalMinor: { type: string }
 *         amountPaidMinor: { type: string }
 *         outstandingMinor: { type: string }
 *         notes: { type: string, nullable: true }
 *         saleDate: { type: string, format: date-time }
 *         cancelledAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     SaleItem:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         saleId: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         quantity: { type: integer }
 *         unitPriceMinor: { type: string, description: "Selling price captured at sale time" }
 *         unitCostMinor: { type: string, description: "WAC captured at sale time — preserves COGS basis" }
 *         discountMinor: { type: string }
 *         totalMinor: { type: string }
 *         totalCostMinor: { type: string, description: "quantity * unitCostMinor — used for COGS" }
 *     SalePayment:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         saleId: { type: string, format: uuid }
 *         method:
 *           type: string
 *           enum: [CASH, BANK_TRANSFER, CARD_POS, CUSTOMER_CREDIT, OTHER]
 *         amountMinor: { type: string }
 *         reference: { type: string, nullable: true }
 *         paidAt: { type: string, format: date-time }
 *     Refund:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         saleId: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         amountMinor: { type: string }
 *         reason: { type: string }
 *         restockItems: { type: boolean }
 *         reference: { type: string }
 *         processedById: { type: string, format: uuid, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *
 * /sales:
 *   post:
 *     tags: [Sales]
 *     summary: Process a sale (POS checkout)
 *     description: |
 *       Atomic checkout flow inside a single `prisma.$transaction`:
 *       idempotency (syncId) → validate products → capture WAC at sale time →
 *       compute totals/tax → create Sale + SaleItems + SalePayments →
 *       apply SALE_DEDUCTION movements via `applyMovement` → optionally create
 *       CustomerCredit for outstanding balance → audit log.
 *       Money fields arrive as decimal strings and are converted to minor units.
 *       BigInt fields are returned as strings.
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
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: integer, minimum: 1 }
 *                     unitPrice: { type: string, description: "Decimal major string. Defaults to product.sellingPriceMinor." }
 *                     discount: { type: string, description: "Line-level discount, decimal major string." }
 *               discount: { type: string, description: "Cart-level discount, decimal major string." }
 *               customerId: { type: string, format: uuid }
 *               payments:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [method, amount]
 *                   properties:
 *                     method: { type: string, enum: [CASH, BANK_TRANSFER, CARD_POS, CUSTOMER_CREDIT, OTHER] }
 *                     amount: { type: string }
 *                     reference: { type: string }
 *               branchId: { type: string, format: uuid }
 *               notes: { type: string }
 *               syncId: { type: string, description: "Idempotency key. Re-submitting the same syncId returns the original sale." }
 *               saleDate: { type: string, format: date-time }
 *     responses:
 *       201: { description: Sale created }
 *       409: { description: Insufficient stock or duplicate syncId }
 *   get:
 *     tags: [Sales]
 *     summary: List sales
 *     description: Paginated list with filters (receiptNo, cashier, customer, payment method, date range, status, branch) and search. Includes cashier + customer names and item count.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: receiptNo, schema: { type: string } }
 *       - { in: query, name: cashierId, schema: { type: string, format: uuid } }
 *       - { in: query, name: customerId, schema: { type: string, format: uuid } }
 *       - { in: query, name: paymentMethod, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated list of sales }
 *
 * /sales/{id}:
 *   get:
 *     tags: [Sales]
 *     summary: Get a sale with items, payments, refund history, customer, cashier
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Sale detail }
 *       404: { description: Not found }
 *
 * /sales/{id}/refunds:
 *   post:
 *     tags: [Sales]
 *     summary: Issue a refund for a sale
 *     description: |
 *       Atomic refund flow. Validates the sale is refundable, creates a Refund
 *       record, optionally restocks items via SALE_REVERSAL movements, settles
 *       CustomerCredit if the original payment was on credit, and updates the
 *       sale status to REFUNDED when fully refunded.
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
 *             required: [amount, reason]
 *             properties:
 *               amount: { type: string, description: "Decimal major string. Must be > 0 and <= remaining refundable." }
 *               reason: { type: string }
 *               restockItems: { type: boolean, default: false }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Refund created }
 *       409: { description: Sale not refundable or amount exceeds remaining refundable }
 *
 * /sales/{id}/cancel:
 *   post:
 *     tags: [Sales]
 *     summary: Cancel a sale
 *     description: |
 *       Only sales with NO payments OR fully refunded can be cancelled.
 *       Reverses ALL inventory movements (regardless of restockItems flag) via
 *       SALE_REVERSAL for each line item and marks the sale CANCELLED.
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
 *             required: [reason]
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Sale cancelled }
 *       409: { description: Sale cannot be cancelled }
 *
 * /sales/{id}/receipt:
 *   get:
 *     tags: [Sales]
 *     summary: Get receipt payload
 *     description: Returns the receipt payload that clients render to PDF or thermal printer — business, branch, receiptNo, date/time, cashier, line items, totals, payments, outstanding.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Receipt payload }
 *       404: { description: Not found }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { type Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../db/index.js';
import { config } from '../../config/index.js';
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
import { receiptNo, refundRef } from '../../utils/refs.js';
import { applyMovement, getBalance } from '../inventory/service.js';
import {
  computeSaleTotals,
  serializeSale,
  serializeRefund,
  type ComputedSaleItem,
  type SaleItemInput,
  type SalePaymentInput,
} from './service.js';

// =====================================================
// Router setup
// =====================================================

export const saleRouter = Router();

// All sales routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
saleRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

const PaymentMethodEnum = z.enum([
  'CASH',
  'BANK_TRANSFER',
  'CARD_POS',
  'CUSTOMER_CREDIT',
  'OTHER',
]);

const SaleStatusEnum = z.enum([
  'DRAFT',
  'PENDING_PAYMENT',
  'PARTIALLY_PAID',
  'COMPLETED',
  'CANCELLED',
  'REFUNDED',
]);

/** Money input accepts decimal strings ("1250.50") or finite non-negative numbers. */
const moneyInput = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
  z.number().nonnegative().finite(),
]);
const moneyString = moneyInput.transform((v: string | number) => String(v));

/** Resolve the effective branchId: body first, then the request's active branch. */
function resolveBranchId(
  bodyBranchId: string | null | undefined,
  req: Request,
): string | null {
  if (bodyBranchId) return bodyBranchId;
  return req.activeBranchId ?? null;
}

/** Fire-and-forget audit log write. Never throws. */
function writeAudit(
  req: Request,
  opts: {
    action: string;
    resourceType: string;
    resourceId: string;
    change?: unknown;
  },
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

// =====================================================
// POST /sales — process a sale (POS checkout)
// =====================================================
const CreateSaleItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(1_000_000_000),
  unitPrice: moneyString.optional(),
  discount: moneyString.optional(),
});

const CreateSalePaymentSchema = z.object({
  method: PaymentMethodEnum,
  amount: moneyString,
  reference: z.string().max(200).optional().nullable(),
});

const CreateSaleSchema = z.object({
  items: z.array(CreateSaleItemSchema).min(1),
  discount: moneyString.optional(),
  customerId: z.string().uuid().optional().nullable(),
  payments: z.array(CreateSalePaymentSchema).default([]),
  branchId: z.string().uuid().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  syncId: z.string().max(200).optional().nullable(),
  saleDate: z.string().datetime().optional(),
});

saleRouter.post(
  '/',
  requirePermission('sale:process'),
  validateBody(CreateSaleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateSaleSchema>;
    const branchId = resolveBranchId(body.branchId, req);

    // 1. Idempotency: if syncId provided, return the existing sale if present.
    if (body.syncId) {
      const existing = await prisma.sale.findFirst({
        where: { businessId: bizId, syncId: body.syncId },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, sku: true, barcode: true } } },
          },
          payments: { orderBy: { paidAt: 'desc' } },
          refunds: { orderBy: { createdAt: 'desc' } },
          customer: { select: { id: true, name: true, phone: true } },
          cashier: { select: { id: true, fullName: true } },
          branch: { select: { id: true, name: true } },
        },
      });
      if (existing) {
        return sendSuccess(res, serializeSale(existing), 'Sale already exists (idempotent)');
      }
    }

    // 2. Validate products belong to business; capture sellingPriceMinor as fallback.
    const productIds = Array.from(new Set(body.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, businessId: bizId },
      select: {
        id: true,
        name: true,
        sku: true,
        sellingPriceMinor: true,
        status: true,
      },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    if (productMap.size !== productIds.length) {
      const missing = productIds.filter((id) => !productMap.has(id));
      return sendError(
        res,
        Errors.badRequest(
          `One or more products not found in this business: ${missing.join(', ')}`,
          'PRODUCT_NOT_FOUND',
        ),
      );
    }
    // Refuse to sell archived/inactive products — the cashier must correct the cart.
    const inactive = products.filter((p) => p.status !== 'ACTIVE');
    if (inactive.length > 0) {
      return sendError(
        res,
        Errors.badRequest(
          `Cannot sell inactive product(s): ${inactive.map((p) => p.sku).join(', ')}`,
          'PRODUCT_INACTIVE',
        ),
      );
    }

    // 3. Resolve the business (needed for taxRateBps) — and customer if provided.
    const business = await prisma.business.findUnique({
      where: { id: bizId },
      select: { id: true, taxRateBps: true, currency: true },
    });
    if (!business) return sendError(res, Errors.notFound('Business not found'));

    if (body.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: body.customerId, businessId: bizId },
        select: { id: true },
      });
      if (!customer) {
        return sendError(
          res,
          Errors.badRequest('Customer not found in this business', 'CUSTOMER_NOT_FOUND'),
        );
      }
    }

    // 4. For each line item: resolve unit price, capture WAC cost, check stock,
    //    and build the priced SaleItem payload. Cost capture happens BEFORE any
    //    movement so the unitCostMinor reflects the WAC at the instant of sale.
    const computedItems: ComputedSaleItem[] = [];
    {
      // Look up balances once per product (keyed by branchId). Multiple line
      // items for the same product share the same starting WAC because
      // SALE_DEDUCTION does not alter WAC (see inventory/service.ts).
      const balanceCache = new Map<string, { qty: number; wac: bigint }>();
      for (const inp of body.items as SaleItemInput[]) {
        const product = productMap.get(inp.productId)!;
        const unitPriceMinor = inp.unitPrice
          ? toMinor(inp.unitPrice)
          : product.sellingPriceMinor;
        const discountMinor = inp.discount ? toMinor(inp.discount) : 0n;
        const lineTotal = BigInt(inp.quantity) * unitPriceMinor - discountMinor;
        if (lineTotal < 0n) {
          return sendError(
            res,
            Errors.badRequest(
              `Line discount exceeds line total for product ${product.sku}`,
              'INVALID_DISCOUNT',
            ),
          );
        }

        // Fetch (and cache) the current balance + WAC for this product+branch.
        const cacheKey = `${inp.productId}|${branchId ?? ''}`;
        let bal = balanceCache.get(cacheKey);
        if (!bal) {
          const fetched = await getBalance(bizId, branchId, inp.productId);
          bal = {
            qty: (fetched as any).quantity ?? 0,
            wac: (fetched as any).wacCostMinor ?? 0n,
          };
          balanceCache.set(cacheKey, bal);
        }

        // Stock sufficiency check (skip when negative stock is enabled at
        // tenant level — applyMovement will not re-check in that case).
        if (!config.tenant.enableNegativeStock) {
          // Sum the quantities already consumed in this cart for the same
          // product+branch so multi-line carts stay consistent.
          const alreadyConsumed = computedItems
            .filter((c) => c.productId === inp.productId)
            .reduce((acc, c) => acc + c.quantity, 0);
          if (bal.qty - alreadyConsumed < inp.quantity) {
            return sendError(
              res,
              Errors.insufficientStock(
                `Insufficient stock for ${product.sku}: requested ${inp.quantity}, available ${bal.qty - alreadyConsumed}`,
              ),
            );
          }
        }

        const unitCostMinor = bal.wac;
        const totalCostMinor = BigInt(inp.quantity) * unitCostMinor;

        computedItems.push({
          productId: inp.productId,
          quantity: inp.quantity,
          unitPriceMinor,
          unitCostMinor,
          discountMinor,
          totalMinor: lineTotal,
          totalCostMinor,
        });
      }
    }

    // 5. Compute totals (subtotal, tax, total, amountPaid, outstanding, status).
    const totals = computeSaleTotals(computedItems, {
      cartDiscount: body.discount,
      taxRateBps: business.taxRateBps,
      payments: body.payments as SalePaymentInput[],
    });

    const receipt = receiptNo();
    const saleDate = body.saleDate ? new Date(body.saleDate) : new Date();

    // 6. Persist everything atomically. applyMovement is called for each line
    //    inside the same transaction so stock + ledger stay consistent.
    const sale = await prisma.$transaction(async (tx: Tx) => {
      const created = await tx.sale.create({
        data: {
          businessId: bizId,
          branchId,
          cashierId: req.user!.id,
          customerId: body.customerId ?? null,
          receiptNo: receipt,
          syncId: body.syncId ?? null,
          status: totals.status,
          subtotalMinor: totals.subtotalMinor,
          discountMinor: totals.discountMinor,
          taxMinor: totals.taxMinor,
          totalMinor: totals.totalMinor,
          amountPaidMinor: totals.amountPaidMinor,
          outstandingMinor: totals.outstandingMinor,
          notes: body.notes ?? null,
          saleDate,
        },
      });

      // SaleItem rows — preserve BOTH unitPriceMinor AND unitCostMinor.
      await tx.saleItem.createMany({
        data: computedItems.map((it) => ({
          saleId: created.id,
          productId: it.productId,
          quantity: it.quantity,
          unitPriceMinor: it.unitPriceMinor,
          unitCostMinor: it.unitCostMinor,
          discountMinor: it.discountMinor,
          totalMinor: it.totalMinor,
          totalCostMinor: it.totalCostMinor,
        })),
      });

      // SalePayment rows.
      if (body.payments.length > 0) {
        await tx.salePayment.createMany({
          data: body.payments.map((p) => ({
            saleId: created.id,
            method: p.method,
            amountMinor: toMinor(p.amount),
            reference: p.reference ?? null,
          })),
        });
      }

      // Apply SALE_DEDUCTION movements via the shared inventory service.
      // Pass unitCostMinor through so the movement's effective cost matches
      // the captured cost basis on the SaleItem (WAC is unchanged on outflow).
      for (const it of computedItems) {
        await applyMovement(tx, {
          businessId: bizId,
          branchId,
          productId: it.productId,
          movementType: 'SALE_DEDUCTION',
          quantity: -Math.abs(it.quantity),
          unitCostMinor: it.unitCostMinor,
          referenceType: 'sale',
          referenceId: created.id,
          reason: `Sale ${receipt}`,
          syncId: body.syncId ?? null,
          responsibleUserId: req.user?.id ?? null,
        });
      }

      // Outstanding balance → CustomerCredit. The full outstanding is stored
      // as the credit's amountMinor; subsequent CustomerPayment allocations
      // (see customers module) reduce it FIFO.
      if (totals.outstandingMinor > 0n && body.customerId) {
        await tx.customerCredit.create({
          data: {
            businessId: bizId,
            customerId: body.customerId,
            saleId: created.id,
            amountMinor: totals.outstandingMinor,
            status: 'OPEN',
          },
        });
      }

      return created;
    });

    // 7. Re-fetch with relations for the response (single round-trip).
    const full = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true, barcode: true } } },
        },
        payments: { orderBy: { paidAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        customer: { select: { id: true, name: true, phone: true } },
        cashier: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    writeAudit(req, {
      action: 'sale.create',
      resourceType: 'sale',
      resourceId: sale.id,
      change: {
        receiptNo: receipt,
        customerId: body.customerId ?? null,
        branchId,
        itemCount: computedItems.length,
        totalMinor: totals.totalMinor.toString(),
        amountPaidMinor: totals.amountPaidMinor.toString(),
        outstandingMinor: totals.outstandingMinor.toString(),
        status: totals.status,
        syncId: body.syncId ?? null,
      },
    });

    return sendSuccess(res, serializeSale(full), 'Sale created', 201);
  }),
);

// =====================================================
// GET /sales — list with filters + search
// =====================================================
const ListSalesQuerySchema = PaginationSchema.extend({
  receiptNo: z.string().max(120).optional(),
  cashierId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  paymentMethod: PaymentMethodEnum.optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: SaleStatusEnum.optional(),
  branchId: z.string().uuid().optional(),
});

saleRouter.get(
  '/',
  requirePermission('sale:view'),
  validateQuery(ListSalesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ListSalesQuerySchema>;

    const where: Prisma.SaleWhereInput = { businessId: bizId };

    if (q.receiptNo) where.receiptNo = { contains: q.receiptNo };
    if (q.cashierId) where.cashierId = q.cashierId;
    if (q.customerId) where.customerId = q.customerId;
    if (q.status) where.status = q.status;
    if (q.branchId) where.branchId = q.branchId;

    if (q.from || q.to) {
      where.saleDate = {
        ...(q.from ? { gte: new Date(q.from) } : {}),
        ...(q.to ? { lte: new Date(q.to) } : {}),
      };
    }

    if (q.paymentMethod) {
      where.payments = { some: { method: q.paymentMethod } };
    }

    if (q.search) {
      const term = q.search;
      where.OR = [
        { receiptNo: { contains: term } },
        { notes: { contains: term } },
        { customer: { name: { contains: term } } },
        { cashier: { fullName: { contains: term } } },
        { syncId: { contains: term } },
      ];
    }

    const total = await prisma.sale.count({ where });
    const sales = await prisma.sale.findMany({
      ...paginate(
        { where, orderBy: { saleDate: 'desc' as const } },
        q,
      ),
      include: {
        cashier: { select: { id: true, fullName: true } },
        customer: { select: { id: true, name: true, phone: true } },
        branch: { select: { id: true, name: true } },
        _count: { select: { items: true, payments: true, refunds: true } },
      },
    });

    const items = sales.map((s: any) => ({
      ...serializeSale(s),
      itemCount: s._count?.items ?? 0,
      paymentCount: s._count?.payments ?? 0,
      refundCount: s._count?.refunds ?? 0,
    }));

    return sendSuccess(res, { items, meta: pageMeta(total, q) }, 'OK');
  }),
);

// =====================================================
// GET /sales/:id — single sale with relations
// =====================================================
saleRouter.get(
  '/:id',
  requirePermission('sale:view'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: bizId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, sku: true, barcode: true } } },
        },
        payments: { orderBy: { paidAt: 'desc' } },
        refunds: { orderBy: { createdAt: 'desc' } },
        customer: { select: { id: true, name: true, phone: true, email: true } },
        cashier: { select: { id: true, fullName: true } },
        branch: { select: { id: true, name: true, phone: true, address: true } },
      },
    });
    if (!sale) return sendError(res, Errors.notFound('Sale not found'));

    return sendSuccess(res, serializeSale(sale), 'OK');
  }),
);

// =====================================================
// POST /sales/:id/refunds — issue a refund
// =====================================================
const RefundSchema = z.object({
  amount: moneyString,
  reason: z.string().min(1).max(500),
  restockItems: z.boolean().default(false),
  notes: z.string().max(2000).optional().nullable(),
});

saleRouter.post(
  '/:id/refunds',
  requirePermission('sale:refund'),
  validateParams(IdParamsSchema),
  validateBody(RefundSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof RefundSchema>;

    const refundAmountMinor = toMinor(body.amount);
    if (refundAmountMinor <= 0n) {
      return sendError(
        res,
        Errors.badRequest('Refund amount must be positive', 'INVALID_AMOUNT'),
      );
    }

    // 1. Load sale + refunds + items + payments for full validation context.
    const sale = await prisma.sale.findFirst({
      where: { id, businessId: bizId },
      include: {
        items: true,
        refunds: true,
        payments: true,
      },
    });
    if (!sale) return sendError(res, Errors.notFound('Sale not found'));

    // 2. Status gate — only completed or partially-paid sales are refundable.
    if (sale.status !== 'COMPLETED' && sale.status !== 'PARTIALLY_PAID') {
      return sendError(
        res,
        Errors.conflict(
          `Sale in status ${sale.status} cannot be refunded`,
          'SALE_NOT_REFUNDABLE',
        ),
      );
    }

    // 3. Refund amount must be > 0 and <= remaining refundable.
    const alreadyRefundedMinor = sale.refunds.reduce(
      (acc: bigint, r: any) => acc + BigInt(r.amountMinor),
      0n,
    );
    const remainingRefundable = BigInt(sale.totalMinor) - alreadyRefundedMinor;
    if (refundAmountMinor > remainingRefundable) {
      return sendError(
        res,
        Errors.conflict(
          `Refund amount exceeds remaining refundable (${remainingRefundable.toString()})`,
          'REFUND_AMOUNT_EXCEEDS_REMAINING',
        ),
      );
    }

    const reference = refundRef();

    // 4. Atomic: create Refund, optionally restock, settle CustomerCredit, update sale status.
    const refund = await prisma.$transaction(async (tx: Tx) => {
      const created = await tx.refund.create({
        data: {
          saleId: sale.id,
          businessId: bizId,
          amountMinor: refundAmountMinor,
          reason: body.reason,
          restockItems: body.restockItems,
          reference,
          processedById: req.user?.id ?? null,
        },
      });

      // Restock: reverse stock for EACH sale item via SALE_REVERSAL.
      // Use the captured unitCostMinor on the SaleItem as the cost basis so
      // WAC blends back correctly (WAC is recomputed on stock-in).
      if (body.restockItems) {
        for (const item of sale.items) {
          await applyMovement(tx, {
            businessId: bizId,
            branchId: sale.branchId,
            productId: item.productId,
            movementType: 'SALE_REVERSAL',
            quantity: Math.abs(item.quantity), // positive = stock-in
            unitCostMinor: item.unitCostMinor,
            referenceType: 'refund',
            referenceId: created.id,
            reason: `Refund ${reference}`,
            notes: body.notes ?? null,
            responsibleUserId: req.user?.id ?? null,
          });
        }
      }

      // If the original payment was via CUSTOMER_CREDIT, settle the linked
      // CustomerCredit(s) FIFO. Reduce amountMinor by the refund amount and
      // update status. (Cash/card refunds settle out-of-band.)
      const creditPaid = sale.payments
        .filter((p: any) => p.method === 'CUSTOMER_CREDIT')
        .reduce((acc: bigint, p: any) => acc + BigInt(p.amountMinor), 0n);

      if (creditPaid > 0n && sale.customerId) {
        // Allocate the refund against this sale's CustomerCredit(s), capped at
        // the smaller of (refundAmount, creditPaid). Any excess is a cash/card
        // refund and is not settled against credit here.
        const creditSettleMinor =
          refundAmountMinor >= creditPaid ? creditPaid : refundAmountMinor;

        const credits = await tx.customerCredit.findMany({
          where: {
            customerId: sale.customerId,
            businessId: bizId,
            saleId: sale.id,
            status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
          },
          orderBy: { createdAt: 'asc' },
        });

        let remaining = creditSettleMinor;
        for (const credit of credits) {
          if (remaining <= 0n) break;
          const outstanding = BigInt(credit.amountMinor);
          const applied = remaining >= outstanding ? outstanding : remaining;
          const newAmount = outstanding - applied;
          await tx.customerCredit.update({
            where: { id: credit.id },
            data: {
              amountMinor: newAmount,
              status: newAmount === 0n ? 'SETTLED' : 'PARTIALLY_SETTLED',
              settledAt: newAmount === 0n ? new Date() : null,
            },
          });
          remaining -= applied;
        }
      }

      // Update sale status if fully refunded.
      const totalRefundedAfter = alreadyRefundedMinor + refundAmountMinor;
      if (totalRefundedAfter >= BigInt(sale.totalMinor)) {
        await tx.sale.update({
          where: { id: sale.id },
          data: { status: 'REFUNDED' },
        });
      }

      return created;
    });

    writeAudit(req, {
      action: 'sale.refund',
      resourceType: 'refund',
      resourceId: refund.id,
      change: {
        saleId: sale.id,
        amountMinor: refundAmountMinor.toString(),
        reason: body.reason,
        restockItems: body.restockItems,
        reference,
      },
    });

    return sendSuccess(res, serializeRefund(refund), 'Refund created', 201);
  }),
);

// =====================================================
// POST /sales/:id/cancel — cancel a sale
// =====================================================
const CancelSchema = z.object({
  reason: z.string().min(1).max(500),
});

saleRouter.post(
  '/:id/cancel',
  requirePermission('sale:cancel'),
  validateParams(IdParamsSchema),
  validateBody(CancelSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof CancelSchema>;

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: bizId },
      include: { items: true, refunds: true },
    });
    if (!sale) return sendError(res, Errors.notFound('Sale not found'));

    if (sale.status === 'CANCELLED') {
      return sendError(
        res,
        Errors.conflict('Sale is already cancelled', 'SALE_ALREADY_CANCELLED'),
      );
    }
    if (sale.status === 'REFUNDED') {
      return sendError(
        res,
        Errors.conflict('Fully refunded sales cannot be cancelled', 'SALE_REFUNDED'),
      );
    }

    // 1. Only sales with no payments OR fully refunded can be cancelled.
    const refundedTotal = sale.refunds.reduce(
      (acc: bigint, r: any) => acc + BigInt(r.amountMinor),
      0n,
    );
    const isFullyRefunded = refundedTotal >= BigInt(sale.totalMinor);
    if (sale.amountPaidMinor > 0n && !isFullyRefunded) {
      return sendError(
        res,
        Errors.conflict(
          'Cannot cancel a sale that has payments — refund in full first',
          'SALE_HAS_PAYMENTS',
        ),
      );
    }

    // 2. Reverse ALL inventory movements (regardless of restockItems flag).
    await prisma.$transaction(async (tx: Tx) => {
      for (const item of sale.items) {
        await applyMovement(tx, {
          businessId: bizId,
          branchId: sale.branchId,
          productId: item.productId,
          movementType: 'SALE_REVERSAL',
          quantity: Math.abs(item.quantity), // positive = stock-in
          unitCostMinor: item.unitCostMinor,
          referenceType: 'sale_cancel',
          referenceId: sale.id,
          reason: `Cancel sale ${sale.receiptNo}: ${body.reason}`,
          responsibleUserId: req.user?.id ?? null,
        });
      }

      // 3. Update sale status + cancelledAt. amountPaidMinor is preserved as
      //    a historical record — refunds remain tracked on the Refund rows.
      //    outstandingMinor is zeroed because a cancelled sale represents no
      //    further collectable debt.
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          outstandingMinor: 0n,
        },
      });
    });

    writeAudit(req, {
      action: 'sale.cancel',
      resourceType: 'sale',
      resourceId: sale.id,
      change: {
        receiptNo: sale.receiptNo,
        reason: body.reason,
      },
    });

    // Re-fetch for response.
    const updated = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: true,
        payments: true,
        refunds: { orderBy: { createdAt: 'desc' } },
      },
    });
    return sendSuccess(res, serializeSale(updated), 'Sale cancelled');
  }),
);

// =====================================================
// GET /sales/:id/receipt — receipt payload (PDF / thermal printer)
// =====================================================
saleRouter.get(
  '/:id/receipt',
  requirePermission('sale:view'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const sale = await prisma.sale.findFirst({
      where: { id, businessId: bizId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            address: true,
            logoUrl: true,
            currency: true,
            taxIdentifier: true,
            taxRateBps: true,
            receiptConfig: true,
          },
        },
        branch: { select: { id: true, name: true, phone: true, address: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true, barcode: true } } },
        },
        payments: { orderBy: { paidAt: 'desc' } },
        customer: { select: { id: true, name: true, phone: true } },
        cashier: { select: { id: true, fullName: true } },
        refunds: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!sale) return sendError(res, Errors.notFound('Sale not found'));

    const business = sale.business;
    const totalRefundedMinor = sale.refunds.reduce(
      (acc: bigint, r: any) => acc + BigInt(r.amountMinor),
      0n,
    );

    const receipt = {
      business: {
        name: business.name,
        phone: business.phone,
        email: business.email,
        address: business.address,
        logoUrl: business.logoUrl,
        currency: business.currency,
        taxIdentifier: business.taxIdentifier,
        taxRateBps: business.taxRateBps,
        receiptConfig: business.receiptConfig,
      },
      branch: sale.branch
        ? {
            id: sale.branch.id,
            name: sale.branch.name,
            phone: sale.branch.phone,
            address: sale.branch.address,
          }
        : null,
      receiptNo: sale.receiptNo,
      syncId: sale.syncId,
      saleDate: sale.saleDate,
      status: sale.status,
      cancelledAt: sale.cancelledAt,
      cashier: sale.cashier
        ? { id: sale.cashier.id, name: sale.cashier.fullName }
        : null,
      customer: sale.customer
        ? {
            id: sale.customer.id,
            name: sale.customer.name,
            phone: sale.customer.phone,
          }
        : null,
      notes: sale.notes,
      items: sale.items.map((it: any) => ({
        id: it.id,
        productId: it.productId,
        productName: it.product?.name ?? null,
        sku: it.product?.sku ?? null,
        barcode: it.product?.barcode ?? null,
        quantity: it.quantity,
        unitPriceMinor: it.unitPriceMinor.toString(),
        unitCostMinor: it.unitCostMinor.toString(),
        discountMinor: it.discountMinor.toString(),
        totalMinor: it.totalMinor.toString(),
      })),
      totals: {
        subtotalMinor: sale.subtotalMinor.toString(),
        discountMinor: sale.discountMinor.toString(),
        taxMinor: sale.taxMinor.toString(),
        totalMinor: sale.totalMinor.toString(),
        amountPaidMinor: sale.amountPaidMinor.toString(),
        outstandingMinor: sale.outstandingMinor.toString(),
        refundedMinor: totalRefundedMinor.toString(),
      },
      payments: sale.payments.map((p: any) => ({
        id: p.id,
        method: p.method,
        amountMinor: p.amountMinor.toString(),
        reference: p.reference,
        paidAt: p.paidAt,
      })),
      refunds: sale.refunds.map((r: any) => ({
        id: r.id,
        amountMinor: r.amountMinor.toString(),
        reason: r.reason,
        restockItems: r.restockItems,
        reference: r.reference,
        createdAt: r.createdAt,
      })),
    };

    return sendSuccess(res, receipt, 'OK');
  }),
);
