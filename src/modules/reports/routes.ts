/**
 * @openapi
 * components:
 *   schemas:
 *     MoneyField:
 *       type: object
 *       description: Money is stored as integer minor units (kobo for NGN). Both forms are returned.
 *       properties:
 *         minor: { type: string, description: "Integer minor units as string (precision-safe)" }
 *         major: { type: number, description: "Major units (e.g. NGN) for display" }
 *     SalesReport:
 *       type: object
 *       properties:
 *         from: { type: string, format: date-time }
 *         to: { type: string, format: date-time }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         salesCount: { type: integer }
 *         totalRevenue: { $ref: '#/components/schemas/MoneyField' }
 *         totalDiscount: { $ref: '#/components/schemas/MoneyField' }
 *         totalTax: { $ref: '#/components/schemas/MoneyField' }
 *         totalPaid: { $ref: '#/components/schemas/MoneyField' }
 *         totalOutstanding: { $ref: '#/components/schemas/MoneyField' }
 *         statusCounts: { type: object, additionalProperties: { type: integer } }
 *         daily:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date: { type: string, description: "YYYY-MM-DD (UTC)" }
 *               sales: { type: integer }
 *               revenue: { $ref: '#/components/schemas/MoneyField' }
 *               discount: { $ref: '#/components/schemas/MoneyField' }
 *               tax: { $ref: '#/components/schemas/MoneyField' }
 *     ProfitLossReport:
 *       type: object
 *       properties:
 *         from: { type: string, format: date-time }
 *         to: { type: string, format: date-time }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         grossSales: { $ref: '#/components/schemas/MoneyField' }
 *         salesReturns: { $ref: '#/components/schemas/MoneyField' }
 *         netSales: { $ref: '#/components/schemas/MoneyField' }
 *         cogs: { $ref: '#/components/schemas/MoneyField' }
 *         grossProfit: { $ref: '#/components/schemas/MoneyField' }
 *         operatingExpenses: { $ref: '#/components/schemas/MoneyField' }
 *         operatingProfit: { $ref: '#/components/schemas/MoneyField' }
 *         taxCollected: { $ref: '#/components/schemas/MoneyField' }
 *         daily:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date: { type: string }
 *               grossSales: { $ref: '#/components/schemas/MoneyField' }
 *               returns: { $ref: '#/components/schemas/MoneyField' }
 *               cogs: { $ref: '#/components/schemas/MoneyField' }
 *               expenses: { $ref: '#/components/schemas/MoneyField' }
 *     InventoryReport:
 *       type: object
 *       properties:
 *         totalSkuCount: { type: integer }
 *         totalStockQty: { type: integer }
 *         totalValue: { $ref: '#/components/schemas/MoneyField' }
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               productId: { type: string, format: uuid }
 *               name: { type: string, nullable: true }
 *               sku: { type: string, nullable: true }
 *               quantity: { type: integer }
 *               wacCost: { $ref: '#/components/schemas/MoneyField' }
 *               value: { $ref: '#/components/schemas/MoneyField' }
 *               minStock: { type: integer }
 *               stockStatus: { type: string, enum: [in_stock, low_stock, out_of_stock] }
 *
 * /reports/sales:
 *   get:
 *     tags: [Reports]
 *     summary: Daily sales report (range + per-day breakdown for charting)
 *     description: Returns total revenue, discount, tax, paid, outstanding, status counts, and per-day aggregates within the date range. Defaults to the last 30 days. Requires `report:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Sales report (JSON or CSV) }
 *
 * /reports/profit-loss:
 *   get:
 *     tags: [Reports]
 *     summary: Profit & Loss report
 *     description: Computes Gross Sales, Returns, Net Sales, COGS, Gross Profit, Operating Expenses, Operating Profit, and Tax collected for the period. Includes per-day breakdown. Requires `profit:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Profit & Loss report (JSON or CSV) }
 *
 * /reports/inventory:
 *   get:
 *     tags: [Reports]
 *     summary: Inventory valuation report
 *     description: Returns current inventory valuation (sum of quantity * wacCostMinor per balance), per-product breakdown with stock status, total SKU count, and total stock quantity. Requires `report:view` OR `stock:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Inventory valuation report (JSON or CSV) }
 *
 * /reports/stock-movement:
 *   get:
 *     tags: [Reports]
 *     summary: Stock movement aggregation report
 *     description: Aggregates inventory movements by movementType with totals. Filterable by productId, branchId, movementType, date range. Requires `stock:movements`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: productId, schema: { type: string, format: uuid } }
 *       - { in: query, name: movementType, schema: { type: string } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Stock movement aggregation (JSON or CSV) }
 *
 * /reports/low-stock:
 *   get:
 *     tags: [Reports]
 *     summary: Low stock report
 *     description: List of products whose quantity is at or below the product's `minStock` threshold, with current balance and minimum threshold. Requires `report:view` OR `stock:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Low stock list (JSON or CSV) }
 *
 * /reports/expiry:
 *   get:
 *     tags: [Reports]
 *     summary: Expiry tracking report
 *     description: Stock batches with `expiryDate`, grouped by `expired` (expiryDate < now), `expiringSoon` (<30 days), and `good` (>=30 days). Includes product info. Requires `report:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Expiry report (JSON or CSV) }
 *
 * /reports/product-performance:
 *   get:
 *     tags: [Reports]
 *     summary: Product performance report
 *     description: Best and worst selling products by quantity and revenue in the date range. `limit` defaults to 10. Requires `report:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Product performance report (JSON or CSV) }
 *
 * /reports/cashier:
 *   get:
 *     tags: [Reports]
 *     summary: Cashier performance report
 *     description: Sales grouped by cashier with name, total sales count, total revenue, and total refunds in the date range. Requires `report:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Cashier report (JSON or CSV) }
 *
 * /reports/customer-credit:
 *   get:
 *     tags: [Reports]
 *     summary: Outstanding customer credit report
 *     description: Customers with OPEN or PARTIALLY_SETTLED credits, total outstanding per customer, oldest credit date. Requires `report:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Customer credit report (JSON or CSV) }
 *
 * /reports/supplier:
 *   get:
 *     tags: [Reports]
 *     summary: Supplier payables report
 *     description: Suppliers with total purchases, total paid, and outstanding payables. Requires `report:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Supplier report (JSON or CSV) }
 *
 * /reports/expenses:
 *   get:
 *     tags: [Reports]
 *     summary: Expenses by category report
 *     description: Expenses aggregated by category in the date range with total per category and grand total. Requires `report:view`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: format, schema: { type: string, enum: [json, csv, excel], default: json } }
 *     responses:
 *       200: { description: Expenses report (JSON or CSV) }
 *
 * /reports/export:
 *   get:
 *     tags: [Reports]
 *     summary: Export report as CSV
 *     description: |
 *       Exports the requested report type as a CSV file with Content-Type `text/csv`
 *       and Content-Disposition `attachment; filename="report_<type>_<date>.csv"`.
 *       `type` selects the dataset: `sales`, `expenses`, `inventory`, or `profit-loss`.
 *       For `type=profit-loss`, `profit:view` is additionally required.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: type, required: true, schema: { type: string, enum: [sales, expenses, inventory, profit-loss] } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: CSV file download }
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import {
  Prisma,
  type SaleStatus,
  type MovementType,
  type CreditStatus,
} from '@prisma/client';

import { prisma } from '../../db/index.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import { toMajor } from '../../utils/money.js';
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';
import { validateQuery } from '../../middleware/validate.js';

// =====================================================
// Router setup
// =====================================================

export const reportRouter = Router();

// All report routes are tenant-scoped (require auth + active business).
// authMiddleware is applied at the mount point in app.ts.
reportRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

/** Statuses excluded from "active" sales aggregates (DRAFT + CANCELLED). */
const EXCLUDED_SALE_STATUSES: SaleStatus[] = ['CANCELLED', 'DRAFT'];

/** Credit statuses that still have an outstanding balance. */
const OPEN_CREDIT_STATUSES: CreditStatus[] = ['OPEN', 'PARTIALLY_SETTLED'];

/** All inventory movement types (mirrors the Prisma enum). */
const ALL_MOVEMENT_TYPES: MovementType[] = [
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
];

/** Default reporting window when from/to are omitted: last 30 days. */
function resolveRange(from?: string, to?: string): { from: Date; to: Date } {
  const now = new Date();
  const to_ = to ? new Date(to) : now;
  const from_ = from
    ? new Date(from)
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (from_ > to_) {
    // Swap if the client sent them reversed rather than returning an empty set.
    return { from: to_, to: from_ };
  }
  return { from: from_, to: to_ };
}

/** Returns YYYY-MM-DD in UTC for date-bucketing. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD_HH-MM-SS stamp for filenames (UTC). */
function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

/** Money serializer: returns both minor (string) and major (number) forms. */
function money(b: bigint | null | undefined): { minor: string; major: number } {
  const m = b ?? 0n;
  return { minor: m.toString(), major: toMajor(m) };
}

/** CSV field escaping per RFC 4180. Quotes, commas, or newlines trigger quoting. */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'string' ? value : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build CSV body from a 2D array of rows (first row = header). */
function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');
}

/** Send a CSV download response. */
function sendCsv(res: Response, filename: string, csv: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csv);
}

/** True when the requested format is a CSV-style export. */
function isCsvFormat(format: string | undefined): boolean {
  return format === 'csv' || format === 'excel';
}

/**
 * Permission middleware that succeeds if the user has ANY of the listed
 * permission codes. Mirrors the same-named helper in inventory/routes.ts.
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
          userCodes.some((uc: string) => uc.endsWith(':*') && c.startsWith(uc.slice(0, -1))),
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

/** Resolve the effective branchId: query first, then header. */
function resolveBranchId(queryBranchId: string | undefined, req: Request): string | undefined {
  if (queryBranchId) return queryBranchId;
  return req.activeBranchId ?? undefined;
}

// =====================================================
// Schemas
// =====================================================

/** Common report query: date range + branch + format. */
const ReportQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
  format: z.enum(['json', 'csv', 'excel']).default('json'),
});

type ReportQuery = z.infer<typeof ReportQuerySchema>;

/** Stock movement report extends the common schema with extra filters. */
const StockMovementQuerySchema = ReportQuerySchema.extend({
  productId: z.string().uuid().optional(),
  movementType: z.enum([
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
  ]) as z.ZodType<MovementType>,
});

/** Product performance report extends with a `limit` (default 10). */
const ProductPerformanceQuerySchema = ReportQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(500).default(10),
});

/** Export endpoint: type required, no format (always CSV). */
const ExportQuerySchema = z.object({
  type: z.enum(['sales', 'expenses', 'inventory', 'profit-loss']),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  branchId: z.string().uuid().optional(),
});

// =====================================================
// GET /reports/sales — daily sales breakdown
// =====================================================
reportRouter.get(
  '/sales',
  requirePermission('report:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;
    const { from, to } = resolveRange(q.from, q.to);
    const branchId = resolveBranchId(q.branchId, req);

    const where: Prisma.SaleWhereInput = {
      businessId: bizId,
      saleDate: { gte: from, lte: to },
      status: { notIn: EXCLUDED_SALE_STATUSES },
      ...(branchId ? { branchId } : {}),
    };

    const sales = await prisma.sale.findMany({
      where,
      select: {
        saleDate: true,
        status: true,
        subtotalMinor: true,
        discountMinor: true,
        taxMinor: true,
        totalMinor: true,
        amountPaidMinor: true,
        outstandingMinor: true,
      },
    });

    const totalRevenueMinor = sales.reduce((a, s) => a + s.totalMinor, 0n);
    const totalDiscountMinor = sales.reduce((a, s) => a + s.discountMinor, 0n);
    const totalTaxMinor = sales.reduce((a, s) => a + s.taxMinor, 0n);
    const totalPaidMinor = sales.reduce((a, s) => a + s.amountPaidMinor, 0n);
    const totalOutstandingMinor = sales.reduce((a, s) => a + s.outstandingMinor, 0n);

    const statusCounts: Record<string, number> = {};
    for (const s of sales) {
      statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1;
    }

    // Per-day aggregate for charting (sparse: days with no sales are omitted).
    const byDay = new Map<
      string,
      {
        date: string;
        sales: number;
        revenueMinor: bigint;
        discountMinor: bigint;
        taxMinor: bigint;
      }
    >();
    for (const s of sales) {
      const key = dayKey(s.saleDate);
      const entry = byDay.get(key) ?? {
        date: key,
        sales: 0,
        revenueMinor: 0n,
        discountMinor: 0n,
        taxMinor: 0n,
      };
      entry.sales += 1;
      entry.revenueMinor += s.totalMinor;
      entry.discountMinor += s.discountMinor;
      entry.taxMinor += s.taxMinor;
      byDay.set(key, entry);
    }
    const daily = Array.from(byDay.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        [
          'date',
          'sales_count',
          'revenue_minor',
          'revenue_major',
          'discount_minor',
          'discount_major',
          'tax_minor',
          'tax_major',
        ],
        ...daily.map((d) => [
          d.date,
          d.sales,
          d.revenueMinor.toString(),
          toMajor(d.revenueMinor),
          d.discountMinor.toString(),
          toMajor(d.discountMinor),
          d.taxMinor.toString(),
          toMajor(d.taxMinor),
        ]),
        [
          'TOTAL',
          sales.length,
          totalRevenueMinor.toString(),
          toMajor(totalRevenueMinor),
          totalDiscountMinor.toString(),
          toMajor(totalDiscountMinor),
          totalTaxMinor.toString(),
          toMajor(totalTaxMinor),
        ],
      ];
      return sendCsv(res, `report_sales_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        from,
        to,
        branchId: branchId ?? null,
        salesCount: sales.length,
        totalRevenue: money(totalRevenueMinor),
        totalDiscount: money(totalDiscountMinor),
        totalTax: money(totalTaxMinor),
        totalPaid: money(totalPaidMinor),
        totalOutstanding: money(totalOutstandingMinor),
        statusCounts,
        daily: daily.map((d) => ({
          date: d.date,
          sales: d.sales,
          revenue: money(d.revenueMinor),
          discount: money(d.discountMinor),
          tax: money(d.taxMinor),
        })),
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/profit-loss
// =====================================================
reportRouter.get(
  '/profit-loss',
  requirePermission('profit:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;
    const { from, to } = resolveRange(q.from, q.to);
    const branchId = resolveBranchId(q.branchId, req);

    const saleWhere: Prisma.SaleWhereInput = {
      businessId: bizId,
      saleDate: { gte: from, lte: to },
      status: { notIn: EXCLUDED_SALE_STATUSES },
      ...(branchId ? { branchId } : {}),
    };

    const [sales, refunds, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        select: {
          saleDate: true,
          totalMinor: true,
          taxMinor: true,
          items: { select: { totalCostMinor: true } },
        },
      }),
      prisma.refund.findMany({
        where: {
          businessId: bizId,
          createdAt: { gte: from, lte: to },
          ...(branchId ? { sale: { branchId } } : {}),
        },
        select: { amountMinor: true, createdAt: true },
      }),
      prisma.expense.findMany({
        where: {
          businessId: bizId,
          expenseDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        select: { amountMinor: true, expenseDate: true },
      }),
    ]);

    const grossSalesMinor = sales.reduce((a, s) => a + s.totalMinor, 0n);
    const salesReturnsMinor = refunds.reduce((a, r) => a + r.amountMinor, 0n);
    const netSalesMinor = grossSalesMinor - salesReturnsMinor;
    const cogsMinor = sales.reduce(
      (a, s) => a + s.items.reduce((acc, i) => acc + i.totalCostMinor, 0n),
      0n,
    );
    const grossProfitMinor = netSalesMinor - cogsMinor;
    const operatingExpensesMinor = expenses.reduce((a, e) => a + e.amountMinor, 0n);
    const operatingProfitMinor = grossProfitMinor - operatingExpensesMinor;
    const taxCollectedMinor = sales.reduce((a, s) => a + s.taxMinor, 0n);

    // Per-day breakdown for charting.
    const byDay = new Map<
      string,
      {
        date: string;
        grossSalesMinor: bigint;
        returnsMinor: bigint;
        cogsMinor: bigint;
        expensesMinor: bigint;
      }
    >();
    const emptyDay = (
      key: string,
    ): {
      date: string;
      grossSalesMinor: bigint;
      returnsMinor: bigint;
      cogsMinor: bigint;
      expensesMinor: bigint;
    } => ({
      date: key,
      grossSalesMinor: 0n,
      returnsMinor: 0n,
      cogsMinor: 0n,
      expensesMinor: 0n,
    });

    for (const s of sales) {
      const key = dayKey(s.saleDate);
      const entry = byDay.get(key) ?? emptyDay(key);
      entry.grossSalesMinor += s.totalMinor;
      entry.cogsMinor += s.items.reduce((a, i) => a + i.totalCostMinor, 0n);
      byDay.set(key, entry);
    }
    for (const r of refunds) {
      const key = dayKey(r.createdAt);
      const entry = byDay.get(key) ?? emptyDay(key);
      entry.returnsMinor += r.amountMinor;
      byDay.set(key, entry);
    }
    for (const e of expenses) {
      const key = dayKey(e.expenseDate);
      const entry = byDay.get(key) ?? emptyDay(key);
      entry.expensesMinor += e.amountMinor;
      byDay.set(key, entry);
    }
    const daily = Array.from(byDay.values()).sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
    );

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        [
          'date',
          'gross_sales_minor',
          'gross_sales_major',
          'returns_minor',
          'returns_major',
          'cogs_minor',
          'cogs_major',
          'expenses_minor',
          'expenses_major',
        ],
        ...daily.map((d) => [
          d.date,
          d.grossSalesMinor.toString(),
          toMajor(d.grossSalesMinor),
          d.returnsMinor.toString(),
          toMajor(d.returnsMinor),
          d.cogsMinor.toString(),
          toMajor(d.cogsMinor),
          d.expensesMinor.toString(),
          toMajor(d.expensesMinor),
        ]),
        [
          'TOTAL',
          grossSalesMinor.toString(),
          toMajor(grossSalesMinor),
          salesReturnsMinor.toString(),
          toMajor(salesReturnsMinor),
          cogsMinor.toString(),
          toMajor(cogsMinor),
          operatingExpensesMinor.toString(),
          toMajor(operatingExpensesMinor),
        ],
      ];
      return sendCsv(res, `report_profit-loss_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        from,
        to,
        branchId: branchId ?? null,
        grossSales: money(grossSalesMinor),
        salesReturns: money(salesReturnsMinor),
        netSales: money(netSalesMinor),
        cogs: money(cogsMinor),
        grossProfit: money(grossProfitMinor),
        operatingExpenses: money(operatingExpensesMinor),
        operatingProfit: money(operatingProfitMinor),
        taxCollected: money(taxCollectedMinor),
        daily: daily.map((d) => ({
          date: d.date,
          grossSales: money(d.grossSalesMinor),
          returns: money(d.returnsMinor),
          cogs: money(d.cogsMinor),
          expenses: money(d.expensesMinor),
        })),
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/inventory — current valuation
// =====================================================
reportRouter.get(
  '/inventory',
  requireAnyPermission('report:view', 'stock:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;
    const branchId = resolveBranchId(q.branchId, req);

    const balances = await prisma.inventoryBalance.findMany({
      where: { businessId: bizId, ...(branchId ? { branchId } : {}) },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, minStock: true },
        },
      },
      orderBy: { updatedAt: 'desc' as const },
    });

    const totalStockQty = balances.reduce((acc, b) => acc + b.quantity, 0);
    const totalValueMinor = balances.reduce(
      (acc, b) => acc + BigInt(b.quantity) * b.wacCostMinor,
      0n,
    );
    const skuCount = new Set(balances.map((b) => b.productId)).size;

    const items = balances.map((b) => {
      const minStock = b.product?.minStock ?? 0;
      const status: 'in_stock' | 'low_stock' | 'out_of_stock' =
        b.quantity === 0
          ? 'out_of_stock'
          : b.quantity <= minStock
            ? 'low_stock'
            : 'in_stock';
      const valueMinor = BigInt(b.quantity) * b.wacCostMinor;
      return {
        productId: b.productId,
        name: b.product?.name ?? null,
        sku: b.product?.sku ?? null,
        barcode: b.product?.barcode ?? null,
        branchId: b.branchId ?? null,
        quantity: b.quantity,
        wacCost: money(b.wacCostMinor),
        value: money(valueMinor),
        minStock,
        stockStatus: status,
      };
    });

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        [
          'product_id',
          'sku',
          'name',
          'quantity',
          'wac_cost_minor',
          'wac_cost_major',
          'value_minor',
          'value_major',
          'min_stock',
          'stock_status',
        ],
        ...items.map((it) => [
          it.productId,
          it.sku ?? '',
          it.name ?? '',
          it.quantity,
          it.wacCost.minor,
          it.wacCost.major,
          it.value.minor,
          it.value.major,
          it.minStock,
          it.stockStatus,
        ]),
      ];
      return sendCsv(res, `report_inventory_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        branchId: branchId ?? null,
        totalSkuCount: skuCount,
        totalStockQty,
        totalValue: money(totalValueMinor),
        items,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/stock-movement — aggregation by type
// =====================================================
reportRouter.get(
  '/stock-movement',
  requirePermission('stock:movements'),
  validateQuery(StockMovementQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof StockMovementQuerySchema>;
    const { from, to } = resolveRange(q.from, q.to);
    const branchId = resolveBranchId(q.branchId, req);

    const where: Prisma.InventoryMovementWhereInput = {
      businessId: bizId,
      createdAt: { gte: from, lte: to },
      ...(branchId ? { branchId } : {}),
      ...(q.productId ? { productId: q.productId } : {}),
      ...(q.movementType ? { movementType: q.movementType } : {}),
    };

    const movements = await prisma.inventoryMovement.findMany({
      where,
      select: { movementType: true, quantity: true, totalCostMinor: true },
    });

    const byType = new Map<
      MovementType,
      { movementType: MovementType; count: number; quantity: number; totalCostMinor: bigint }
    >();
    for (const m of movements) {
      const entry =
        byType.get(m.movementType) ??
        {
          movementType: m.movementType,
          count: 0,
          quantity: 0,
          totalCostMinor: 0n,
        };
      entry.count += 1;
      entry.quantity += m.quantity;
      entry.totalCostMinor += m.totalCostMinor;
      byType.set(m.movementType, entry);
    }

    // Include all movement types (even those with zero activity) for charting.
    const items = ALL_MOVEMENT_TYPES.map((t) => {
      const e = byType.get(t);
      return {
        movementType: t,
        count: e?.count ?? 0,
        quantity: e?.quantity ?? 0,
        totalCost: money(e?.totalCostMinor ?? 0n),
      };
    });

    const totalCount = movements.length;
    const totalQuantity = items.reduce((a, b) => a + b.quantity, 0);
    const totalCostMinor = items.reduce((a, b) => a + BigInt(b.totalCost.minor), 0n);

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        ['movement_type', 'count', 'quantity', 'total_cost_minor', 'total_cost_major'],
        ...items.map((it) => [
          it.movementType,
          it.count,
          it.quantity,
          it.totalCost.minor,
          it.totalCost.major,
        ]),
        ['TOTAL', totalCount, totalQuantity, totalCostMinor.toString(), toMajor(totalCostMinor)],
      ];
      return sendCsv(res, `report_stock-movement_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        from,
        to,
        branchId: branchId ?? null,
        productId: q.productId ?? null,
        movementTypeFilter: q.movementType ?? null,
        totalCount,
        totalQuantity,
        totalCost: money(totalCostMinor),
        items,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/low-stock
// =====================================================
reportRouter.get(
  '/low-stock',
  requireAnyPermission('report:view', 'stock:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;
    const branchId = resolveBranchId(q.branchId, req);

    const balances = await prisma.inventoryBalance.findMany({
      where: { businessId: bizId, ...(branchId ? { branchId } : {}) },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, minStock: true },
        },
      },
    });

    const items = balances
      .filter((b) => b.quantity <= (b.product?.minStock ?? 0))
      .map((b) => {
        const minStock = b.product?.minStock ?? 0;
        const status: 'low_stock' | 'out_of_stock' = b.quantity === 0 ? 'out_of_stock' : 'low_stock';
        return {
          productId: b.productId,
          name: b.product?.name ?? null,
          sku: b.product?.sku ?? null,
          barcode: b.product?.barcode ?? null,
          branchId: b.branchId ?? null,
          quantity: b.quantity,
          minStock,
          stockStatus: status,
        };
      });

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        ['product_id', 'sku', 'name', 'branch_id', 'quantity', 'min_stock', 'stock_status'],
        ...items.map((it) => [
          it.productId,
          it.sku ?? '',
          it.name ?? '',
          it.branchId ?? '',
          it.quantity,
          it.minStock,
          it.stockStatus,
        ]),
      ];
      return sendCsv(res, `report_low-stock_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        branchId: branchId ?? null,
        count: items.length,
        items,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/exppiry — stock batches grouped by expiry status
// =====================================================
reportRouter.get(
  '/expiry',
  requirePermission('report:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;
    const branchId = resolveBranchId(q.branchId, req);

    const batches = await prisma.stockBatch.findMany({
      where: {
        businessId: bizId,
        expiryDate: { not: null },
        remainingQty: { gt: 0 },
        ...(branchId ? { product: { branchId } } : {}),
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true, barcode: true, branchId: true },
        },
      },
      orderBy: { expiryDate: 'asc' as const },
    });

    const now = new Date();
    const soonCutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const serializeBatch = (b: (typeof batches)[number]) => ({
      id: b.id,
      productId: b.productId,
      name: b.product?.name ?? null,
      sku: b.product?.sku ?? null,
      barcode: b.product?.barcode ?? null,
      batchNo: b.batchNo ?? null,
      expiryDate: b.expiryDate,
      remainingQty: b.remainingQty,
      initialQty: b.initialQty,
      unitCost: money(b.unitCostMinor),
      receivedAt: b.receivedAt,
    });

    const expired = batches
      .filter((b) => b.expiryDate && b.expiryDate < now)
      .map(serializeBatch);
    const expiringSoon = batches
      .filter((b) => b.expiryDate && b.expiryDate >= now && b.expiryDate < soonCutoff)
      .map(serializeBatch);
    const good = batches
      .filter((b) => b.expiryDate && b.expiryDate >= soonCutoff)
      .map(serializeBatch);

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number | null>> = [
        ['group', 'batch_id', 'product_id', 'sku', 'name', 'batch_no', 'expiry_date', 'remaining_qty', 'unit_cost_minor', 'unit_cost_major'],
        ...expired.map((b) => ['expired', b.id, b.productId, b.sku ?? '', b.name ?? '', b.batchNo ?? '', b.expiryDate ? b.expiryDate.toISOString() : '', b.remainingQty, b.unitCost.minor, b.unitCost.major]),
        ...expiringSoon.map((b) => ['expiring_soon', b.id, b.productId, b.sku ?? '', b.name ?? '', b.batchNo ?? '', b.expiryDate ? b.expiryDate.toISOString() : '', b.remainingQty, b.unitCost.minor, b.unitCost.major]),
        ...good.map((b) => ['good', b.id, b.productId, b.sku ?? '', b.name ?? '', b.batchNo ?? '', b.expiryDate ? b.expiryDate.toISOString() : '', b.remainingQty, b.unitCost.minor, b.unitCost.major]),
      ];
      return sendCsv(res, `report_expiry_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        branchId: branchId ?? null,
        expiredCount: expired.length,
        expiringSoonCount: expiringSoon.length,
        goodCount: good.length,
        expired,
        expiringSoon,
        good,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/product-performance
// =====================================================
reportRouter.get(
  '/product-performance',
  requirePermission('report:view'),
  validateQuery(ProductPerformanceQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ProductPerformanceQuerySchema>;
    const { from, to } = resolveRange(q.from, q.to);
    const branchId = resolveBranchId(q.branchId, req);
    const limit = q.limit;

    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          businessId: bizId,
          saleDate: { gte: from, lte: to },
          status: { notIn: EXCLUDED_SALE_STATUSES },
          ...(branchId ? { branchId } : {}),
        },
      },
      select: {
        productId: true,
        quantity: true,
        totalMinor: true,
        totalCostMinor: true,
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    const byProduct = new Map<
      string,
      {
        productId: string;
        name: string | null;
        sku: string | null;
        quantity: number;
        revenueMinor: bigint;
        costMinor: bigint;
      }
    >();
    for (const it of saleItems) {
      const entry = byProduct.get(it.productId) ?? {
        productId: it.productId,
        name: it.product?.name ?? null,
        sku: it.product?.sku ?? null,
        quantity: 0,
        revenueMinor: 0n,
        costMinor: 0n,
      };
      entry.quantity += it.quantity;
      entry.revenueMinor += it.totalMinor;
      entry.costMinor += it.totalCostMinor;
      byProduct.set(it.productId, entry);
    }
    const all = Array.from(byProduct.values());

    // Sort safely by BigInt using comparison.
    const byQuantityDesc = [...all].sort((a, b) => b.quantity - a.quantity);
    const byRevenueDesc = [...all].sort((a, b) =>
      a.revenueMinor > b.revenueMinor
        ? -1
        : a.revenueMinor < b.revenueMinor
          ? 1
          : 0,
    );

    const serialize = (p: (typeof all)[number]) => ({
      productId: p.productId,
      name: p.name,
      sku: p.sku,
      quantity: p.quantity,
      revenue: money(p.revenueMinor),
      cost: money(p.costMinor),
      profit: money(p.revenueMinor - p.costMinor),
    });

    const bestByQuantity = byQuantityDesc.slice(0, limit).map(serialize);
    const worstByQuantity =
      byQuantityDesc.length > limit
        ? byQuantityDesc.slice(-limit).reverse().map(serialize)
        : [];
    const bestByRevenue = byRevenueDesc.slice(0, limit).map(serialize);
    const worstByRevenue =
      byRevenueDesc.length > limit
        ? byRevenueDesc.slice(-limit).reverse().map(serialize)
        : [];

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        ['rank_type', 'rank', 'product_id', 'sku', 'name', 'quantity', 'revenue_minor', 'revenue_major', 'cost_minor', 'cost_major', 'profit_minor', 'profit_major'],
        ...bestByQuantity.map((p, i) => ['best_quantity', i + 1, p.productId, p.sku ?? '', p.name ?? '', p.quantity, p.revenue.minor, p.revenue.major, p.cost.minor, p.cost.major, p.profit.minor, p.profit.major]),
        ...worstByQuantity.map((p, i) => ['worst_quantity', i + 1, p.productId, p.sku ?? '', p.name ?? '', p.quantity, p.revenue.minor, p.revenue.major, p.cost.minor, p.cost.major, p.profit.minor, p.profit.major]),
        ...bestByRevenue.map((p, i) => ['best_revenue', i + 1, p.productId, p.sku ?? '', p.name ?? '', p.quantity, p.revenue.minor, p.revenue.major, p.cost.minor, p.cost.major, p.profit.minor, p.profit.major]),
        ...worstByRevenue.map((p, i) => ['worst_revenue', i + 1, p.productId, p.sku ?? '', p.name ?? '', p.quantity, p.revenue.minor, p.revenue.major, p.cost.minor, p.cost.major, p.profit.minor, p.profit.major]),
      ];
      return sendCsv(res, `report_product-performance_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        from,
        to,
        branchId: branchId ?? null,
        limit,
        productsAnalyzed: all.length,
        bestByQuantity,
        worstByQuantity,
        bestByRevenue,
        worstByRevenue,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/cashier
// =====================================================
reportRouter.get(
  '/cashier',
  requirePermission('report:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;
    const { from, to } = resolveRange(q.from, q.to);
    const branchId = resolveBranchId(q.branchId, req);

    const saleWhere: Prisma.SaleWhereInput = {
      businessId: bizId,
      saleDate: { gte: from, lte: to },
      status: { notIn: EXCLUDED_SALE_STATUSES },
      ...(branchId ? { branchId } : {}),
    };

    const [sales, refunds] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        select: { cashierId: true, totalMinor: true },
      }),
      prisma.refund.findMany({
        where: {
          businessId: bizId,
          createdAt: { gte: from, lte: to },
          ...(branchId ? { sale: { branchId } } : {}),
        },
        select: { amountMinor: true, sale: { select: { cashierId: true } } },
      }),
    ]);

    const cashierIds = Array.from(new Set(sales.map((s) => s.cashierId)));
    const users = await prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, fullName: true },
    });
    const nameMap = new Map(users.map((u) => [u.id, u.fullName]));

    const byCashier = new Map<
      string,
      {
        cashierId: string;
        cashierName: string;
        salesCount: number;
        totalRevenueMinor: bigint;
        totalRefundsMinor: bigint;
      }
    >();
    for (const s of sales) {
      const entry = byCashier.get(s.cashierId) ?? {
        cashierId: s.cashierId,
        cashierName: nameMap.get(s.cashierId) ?? 'Unknown',
        salesCount: 0,
        totalRevenueMinor: 0n,
        totalRefundsMinor: 0n,
      };
      entry.salesCount += 1;
      entry.totalRevenueMinor += s.totalMinor;
      byCashier.set(s.cashierId, entry);
    }
    for (const r of refunds) {
      const cid = r.sale.cashierId;
      const entry = byCashier.get(cid);
      if (entry) entry.totalRefundsMinor += r.amountMinor;
    }

    const items = Array.from(byCashier.values())
      .sort((a, b) =>
        a.totalRevenueMinor > b.totalRevenueMinor
          ? -1
          : a.totalRevenueMinor < b.totalRevenueMinor
            ? 1
            : 0,
      )
      .map((c) => ({
        cashierId: c.cashierId,
        cashierName: c.cashierName,
        salesCount: c.salesCount,
        totalRevenue: money(c.totalRevenueMinor),
        totalRefunds: money(c.totalRefundsMinor),
        netRevenue: money(c.totalRevenueMinor - c.totalRefundsMinor),
      }));

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        ['cashier_id', 'cashier_name', 'sales_count', 'total_revenue_minor', 'total_revenue_major', 'total_refunds_minor', 'total_refunds_major', 'net_revenue_minor', 'net_revenue_major'],
        ...items.map((c) => [
          c.cashierId,
          c.cashierName,
          c.salesCount,
          c.totalRevenue.minor,
          c.totalRevenue.major,
          c.totalRefunds.minor,
          c.totalRefunds.major,
          c.netRevenue.minor,
          c.netRevenue.major,
        ]),
      ];
      return sendCsv(res, `report_cashier_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        from,
        to,
        branchId: branchId ?? null,
        cashiers: items,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/customer-credit — outstanding credit per customer
// =====================================================
reportRouter.get(
  '/customer-credit',
  requirePermission('report:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;

    const credits = await prisma.customerCredit.findMany({
      where: {
        businessId: bizId,
        status: { in: OPEN_CREDIT_STATUSES },
      },
      select: {
        customerId: true,
        amountMinor: true,
        createdAt: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    });

    const byCustomer = new Map<
      string,
      {
        customerId: string;
        name: string | null;
        phone: string | null;
        email: string | null;
        totalOutstandingMinor: bigint;
        creditCount: number;
        oldestCreditAt: Date | null;
      }
    >();
    for (const c of credits) {
      const entry = byCustomer.get(c.customerId) ?? {
        customerId: c.customerId,
        name: c.customer?.name ?? null,
        phone: c.customer?.phone ?? null,
        email: c.customer?.email ?? null,
        totalOutstandingMinor: 0n,
        creditCount: 0,
        oldestCreditAt: null,
      };
      entry.totalOutstandingMinor += c.amountMinor;
      entry.creditCount += 1;
      if (!entry.oldestCreditAt || c.createdAt < entry.oldestCreditAt) {
        entry.oldestCreditAt = c.createdAt;
      }
      byCustomer.set(c.customerId, entry);
    }

    const items = Array.from(byCustomer.values())
      .sort((a, b) =>
        a.totalOutstandingMinor > b.totalOutstandingMinor
          ? -1
          : a.totalOutstandingMinor < b.totalOutstandingMinor
            ? 1
            : 0,
      )
      .map((c) => ({
        customerId: c.customerId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        creditCount: c.creditCount,
        totalOutstanding: money(c.totalOutstandingMinor),
        oldestCreditAt: c.oldestCreditAt,
      }));

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number | null>> = [
        ['customer_id', 'name', 'phone', 'email', 'credit_count', 'total_outstanding_minor', 'total_outstanding_major', 'oldest_credit_at'],
        ...items.map((c) => [
          c.customerId,
          c.name ?? '',
          c.phone ?? '',
          c.email ?? '',
          c.creditCount,
          c.totalOutstanding.minor,
          c.totalOutstanding.major,
          c.oldestCreditAt ? c.oldestCreditAt.toISOString() : '',
        ]),
      ];
      return sendCsv(res, `report_customer-credit_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        count: items.length,
        customers: items,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/supplier — payables per supplier
// =====================================================
reportRouter.get(
  '/supplier',
  requirePermission('report:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;

    const suppliers = await prisma.supplier.findMany({
      where: { businessId: bizId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        purchases: {
          select: { id: true, totalCostMinor: true, paidAmountMinor: true, status: true },
        },
      },
    });

    const items = suppliers
      .map((s) => {
        const totalPurchasesMinor = s.purchases.reduce(
          (a: bigint, p) => a + p.totalCostMinor,
          0n,
        );
        const totalPaidMinor = s.purchases.reduce(
          (a: bigint, p) => a + p.paidAmountMinor,
          0n,
        );
        const outstandingMinor = totalPurchasesMinor - totalPaidMinor;
        return {
          supplierId: s.id,
          name: s.name,
          phone: s.phone,
          email: s.email,
          purchaseCount: s.purchases.length,
          totalPurchases: money(totalPurchasesMinor),
          totalPaid: money(totalPaidMinor),
          outstanding: money(outstandingMinor),
        };
      })
      .sort((a, b) =>
        a.outstanding.minor > b.outstanding.minor
          ? -1
          : a.outstanding.minor < b.outstanding.minor
            ? 1
            : 0,
      );

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        [
          'supplier_id',
          'name',
          'phone',
          'email',
          'purchase_count',
          'total_purchases_minor',
          'total_purchases_major',
          'total_paid_minor',
          'total_paid_major',
          'outstanding_minor',
          'outstanding_major',
        ],
        ...items.map((s) => [
          s.supplierId,
          s.name,
          s.phone ?? '',
          s.email ?? '',
          s.purchaseCount,
          s.totalPurchases.minor,
          s.totalPurchases.major,
          s.totalPaid.minor,
          s.totalPaid.major,
          s.outstanding.minor,
          s.outstanding.major,
        ]),
      ];
      return sendCsv(res, `report_supplier_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(res, { count: items.length, suppliers: items }, 'OK');
  }),
);

// =====================================================
// GET /reports/expenses — aggregated by category
// =====================================================
reportRouter.get(
  '/expenses',
  requirePermission('report:view'),
  validateQuery(ReportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as ReportQuery;
    const { from, to } = resolveRange(q.from, q.to);
    const branchId = resolveBranchId(q.branchId, req);

    const expenses = await prisma.expense.findMany({
      where: {
        businessId: bizId,
        expenseDate: { gte: from, lte: to },
        ...(branchId ? { branchId } : {}),
      },
      select: {
        amountMinor: true,
        categoryId: true,
        category: { select: { id: true, name: true } },
      },
    });

    const byCat = new Map<
      string,
      {
        categoryId: string | null;
        categoryName: string;
        count: number;
        totalMinor: bigint;
      }
    >();
    for (const e of expenses) {
      const key = e.categoryId ?? '__uncategorized__';
      const catName = e.category?.name ?? 'Uncategorized';
      const entry = byCat.get(key) ?? {
        categoryId: e.categoryId ?? null,
        categoryName: catName,
        count: 0,
        totalMinor: 0n,
      };
      entry.count += 1;
      entry.totalMinor += e.amountMinor;
      byCat.set(key, entry);
    }

    const grandTotalMinor = expenses.reduce((a, e) => a + e.amountMinor, 0n);

    const items = Array.from(byCat.values())
      .sort((a, b) =>
        a.totalMinor > b.totalMinor ? -1 : a.totalMinor < b.totalMinor ? 1 : 0,
      )
      .map((c) => ({
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        count: c.count,
        total: money(c.totalMinor),
      }));

    if (isCsvFormat(q.format)) {
      const rows: Array<Array<string | number>> = [
        ['category_id', 'category_name', 'count', 'total_minor', 'total_major'],
        ...items.map((c) => [
          c.categoryId ?? '',
          c.categoryName,
          c.count,
          c.total.minor,
          c.total.major,
        ]),
        ['TOTAL', '', expenses.length, grandTotalMinor.toString(), toMajor(grandTotalMinor)],
      ];
      return sendCsv(res, `report_expenses_${stamp()}.csv`, toCsv(rows));
    }

    return sendSuccess(
      res,
      {
        from,
        to,
        branchId: branchId ?? null,
        expenseCount: expenses.length,
        grandTotal: money(grandTotalMinor),
        categories: items,
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /reports/export — CSV export of sales/expenses/inventory/profit-loss
// =====================================================
reportRouter.get(
  '/export',
  requirePermission('report:view'),
  validateQuery(ExportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ExportQuerySchema>;
    const { from, to } = resolveRange(q.from, q.to);
    const branchId = resolveBranchId(q.branchId, req);

    // For profit-loss export, additionally require profit:view.
    if (q.type === 'profit-loss') {
      // Re-use the standard permission middleware by evaluating inline.
      // requirePermission already ran for `report:view`; ensure profit:view too.
      const member = await prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId: bizId, userId: req.user!.id } },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      const codes = member?.role.permissions.map((rp) => rp.permission.code) ?? [];
      const has =
        codes.includes('profit:view') ||
        codes.includes('admin:*') ||
        codes.some((c) => c.endsWith(':*') && 'profit:view'.startsWith(c.slice(0, -1)));
      if (!has) {
        return sendError(
          res,
          Errors.forbidden('Missing permission: profit:view', 'MISSING_PERMISSION'),
        );
      }
    }

    if (q.type === 'sales') {
      const sales = await prisma.sale.findMany({
        where: {
          businessId: bizId,
          saleDate: { gte: from, lte: to },
          status: { notIn: EXCLUDED_SALE_STATUSES },
          ...(branchId ? { branchId } : {}),
        },
        select: {
          receiptNo: true,
          saleDate: true,
          status: true,
          subtotalMinor: true,
          discountMinor: true,
          taxMinor: true,
          totalMinor: true,
          amountPaidMinor: true,
          outstandingMinor: true,
          cashier: { select: { fullName: true } },
          customer: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { saleDate: 'asc' as const },
      });
      const rows: Array<Array<string | number>> = [
        [
          'receipt_no',
          'sale_date',
          'status',
          'cashier',
          'customer',
          'branch',
          'subtotal_minor',
          'subtotal_major',
          'discount_minor',
          'discount_major',
          'tax_minor',
          'tax_major',
          'total_minor',
          'total_major',
          'paid_minor',
          'paid_major',
          'outstanding_minor',
          'outstanding_major',
        ],
        ...sales.map((s) => [
          s.receiptNo,
          s.saleDate.toISOString(),
          s.status,
          s.cashier?.fullName ?? '',
          s.customer?.name ?? '',
          s.branch?.name ?? '',
          s.subtotalMinor.toString(),
          toMajor(s.subtotalMinor),
          s.discountMinor.toString(),
          toMajor(s.discountMinor),
          s.taxMinor.toString(),
          toMajor(s.taxMinor),
          s.totalMinor.toString(),
          toMajor(s.totalMinor),
          s.amountPaidMinor.toString(),
          toMajor(s.amountPaidMinor),
          s.outstandingMinor.toString(),
          toMajor(s.outstandingMinor),
        ]),
      ];
      return sendCsv(res, `report_sales_${stamp()}.csv`, toCsv(rows));
    }

    if (q.type === 'expenses') {
      const expenses = await prisma.expense.findMany({
        where: {
          businessId: bizId,
          expenseDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        select: {
          title: true,
          expenseDate: true,
          amountMinor: true,
          paymentMethod: true,
          reference: true,
          description: true,
          category: { select: { name: true } },
          branch: { select: { name: true } },
        },
        orderBy: { expenseDate: 'asc' as const },
      });
      const rows: Array<Array<string | number | null>> = [
        [
          'title',
          'expense_date',
          'category',
          'branch',
          'amount_minor',
          'amount_major',
          'payment_method',
          'reference',
          'description',
        ],
        ...expenses.map((e) => [
          e.title,
          e.expenseDate.toISOString(),
          e.category?.name ?? '',
          e.branch?.name ?? '',
          e.amountMinor.toString(),
          toMajor(e.amountMinor),
          e.paymentMethod ?? '',
          e.reference ?? '',
          e.description ?? '',
        ]),
      ];
      return sendCsv(res, `report_expenses_${stamp()}.csv`, toCsv(rows));
    }

    if (q.type === 'inventory') {
      const balances = await prisma.inventoryBalance.findMany({
        where: { businessId: bizId, ...(branchId ? { branchId } : {}) },
        include: {
          product: {
            select: { id: true, name: true, sku: true, barcode: true, minStock: true },
          },
        },
        orderBy: { updatedAt: 'desc' as const },
      });
      const rows: Array<Array<string | number>> = [
        [
          'product_id',
          'sku',
          'name',
          'branch',
          'quantity',
          'wac_cost_minor',
          'wac_cost_major',
          'value_minor',
          'value_major',
          'min_stock',
          'stock_status',
        ],
        ...balances.map((b) => {
          const minStock = b.product?.minStock ?? 0;
          const status =
            b.quantity === 0
              ? 'out_of_stock'
              : b.quantity <= minStock
                ? 'low_stock'
                : 'in_stock';
          const valueMinor = BigInt(b.quantity) * b.wacCostMinor;
          return [
            b.productId,
            b.product?.sku ?? '',
            b.product?.name ?? '',
            b.branchId ?? '',
            b.quantity,
            b.wacCostMinor.toString(),
            toMajor(b.wacCostMinor),
            valueMinor.toString(),
            toMajor(valueMinor),
            minStock,
            status,
          ];
        }),
      ];
      return sendCsv(res, `report_inventory_${stamp()}.csv`, toCsv(rows));
    }

    // type === 'profit-loss'
    const saleWhere: Prisma.SaleWhereInput = {
      businessId: bizId,
      saleDate: { gte: from, lte: to },
      status: { notIn: EXCLUDED_SALE_STATUSES },
      ...(branchId ? { branchId } : {}),
    };
    const [sales, refunds, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        select: {
          saleDate: true,
          totalMinor: true,
          taxMinor: true,
          items: { select: { totalCostMinor: true } },
        },
      }),
      prisma.refund.findMany({
        where: {
          businessId: bizId,
          createdAt: { gte: from, lte: to },
          ...(branchId ? { sale: { branchId } } : {}),
        },
        select: { amountMinor: true, createdAt: true },
      }),
      prisma.expense.findMany({
        where: {
          businessId: bizId,
          expenseDate: { gte: from, lte: to },
          ...(branchId ? { branchId } : {}),
        },
        select: { amountMinor: true, expenseDate: true },
      }),
    ]);

    const grossSalesMinor = sales.reduce((a, s) => a + s.totalMinor, 0n);
    const salesReturnsMinor = refunds.reduce((a, r) => a + r.amountMinor, 0n);
    const cogsMinor = sales.reduce(
      (a, s) => a + s.items.reduce((acc, i) => acc + i.totalCostMinor, 0n),
      0n,
    );
    const operatingExpensesMinor = expenses.reduce((a, e) => a + e.amountMinor, 0n);
    const taxCollectedMinor = sales.reduce((a, s) => a + s.taxMinor, 0n);
    const netSalesMinor = grossSalesMinor - salesReturnsMinor;
    const grossProfitMinor = netSalesMinor - cogsMinor;
    const operatingProfitMinor = grossProfitMinor - operatingExpensesMinor;

    const rows: Array<Array<string | number>> = [
      ['line_item', 'amount_minor', 'amount_major'],
      ['Gross Sales', grossSalesMinor.toString(), toMajor(grossSalesMinor)],
      ['Sales Returns', salesReturnsMinor.toString(), toMajor(salesReturnsMinor)],
      ['Net Sales', netSalesMinor.toString(), toMajor(netSalesMinor)],
      ['COGS', cogsMinor.toString(), toMajor(cogsMinor)],
      ['Gross Profit', grossProfitMinor.toString(), toMajor(grossProfitMinor)],
      ['Operating Expenses', operatingExpensesMinor.toString(), toMajor(operatingExpensesMinor)],
      ['Operating Profit', operatingProfitMinor.toString(), toMajor(operatingProfitMinor)],
      ['Tax Collected', taxCollectedMinor.toString(), toMajor(taxCollectedMinor)],
      ['', '', ''],
      ['Period From', from.toISOString(), ''],
      ['Period To', to.toISOString(), ''],
      ['Branch', branchId ?? 'all', ''],
    ];
    return sendCsv(res, `report_profit-loss_${stamp()}.csv`, toCsv(rows));
  }),
);
