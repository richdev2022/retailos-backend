/**
 * @openapi
 * components:
 *   schemas:
 *     ExpenseCategory:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     Expense:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         categoryId: { type: string, format: uuid, nullable: true }
 *         title: { type: string }
 *         amountMinor: { type: string, description: "Integer minor units (kobo)" }
 *         paymentMethod: { type: string, nullable: true }
 *         reference: { type: string, nullable: true }
 *         receiptUrl: { type: string, nullable: true }
 *         description: { type: string, nullable: true }
 *         expenseDate: { type: string, format: date-time }
 *         recordedById: { type: string, format: uuid, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 * /expenses:
 *   post:
 *     tags: [Expenses]
 *     summary: Create an expense
 *     description: Records a new expense. Money fields arrive as decimal strings and are converted to integer minor units. Tenant-scoped via X-Business-Id; branch-scoped via X-Branch-Id (optional).
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
 *             required: [title, amount]
 *             properties:
 *               title: { type: string }
 *               amount: { type: string, description: "Decimal major units, e.g. '1250.50'" }
 *               categoryId: { type: string, format: uuid }
 *               branchId: { type: string, format: uuid }
 *               paymentMethod: { type: string }
 *               reference: { type: string }
 *               receiptUrl: { type: string, format: uri }
 *               description: { type: string }
 *               expenseDate: { type: string, format: date-time }
 *     responses:
 *       201: { description: Expense created }
 *   get:
 *     tags: [Expenses]
 *     summary: List expenses
 *     description: Paginated list with search, category/date/branch filters.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: from, schema: { type: string, format: date-time } }
 *       - { in: query, name: to, schema: { type: string, format: date-time } }
 *     responses:
 *       200: { description: Paginated list of expenses }
 *
 * /expenses/categories:
 *   get:
 *     tags: [Expenses]
 *     summary: List expense categories for the active business
 *     description: Default categories are seeded at business creation; this endpoint also returns any user-created categories.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: List of categories }
 *   post:
 *     tags: [Expenses]
 *     summary: Create an expense category
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
 *               description: { type: string }
 *     responses:
 *       201: { description: Category created }
 *       409: { description: Category name already exists }
 *
 * /expenses/{id}:
 *   get:
 *     tags: [Expenses]
 *     summary: Get expense details with audit trail
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Expense with audit trail }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Expenses]
 *     summary: Update an expense
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated expense }
 *   delete:
 *     tags: [Expenses]
 *     summary: Delete an expense (with audit note)
 *     description: Removes the expense and writes a full snapshot + audit note to the audit log. The Expense model has no archivedAt field so this is a hard delete.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note: { type: string, description: "Reason for deletion" }
 *     responses:
 *       200: { description: Expense deleted }
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

export const expenseRouter = Router();

// All expense routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
expenseRouter.use(tenantContext);

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

/** Serialise an expense so any BigInt fields become strings. */
function serializeExpense(e: any) {
  return {
    ...e,
    amountMinor: e.amountMinor?.toString() ?? '0',
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
const moneyString = moneyInput.transform((v: string | number) => String(v));

const CreateExpenseSchema = z.object({
  title: z.string().min(1).max(200),
  amount: moneyString,
  categoryId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  paymentMethod: PaymentMethodSchema.optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  expenseDate: z.string().datetime().optional(),
});

const UpdateExpenseSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  amount: moneyString.optional(),
  categoryId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  paymentMethod: PaymentMethodSchema.optional().nullable(),
  reference: z.string().max(200).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  expenseDate: z.string().datetime().optional(),
});

const ListExpensesQuerySchema = PaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const CreateExpenseCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
});

const DeleteExpenseSchema = z.object({
  note: z.string().max(2000).optional().nullable(),
}).default({});

// =====================================================
// Sub-routes: categories
// (registered BEFORE /:id to avoid path collision)
// =====================================================
const categoryRouter = Router();

/**
 * GET /expenses/categories
 * List expense categories for the active business.
 */
categoryRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const categories = await prisma.expenseCategory.findMany({
      where: { businessId: bizId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { expenses: true } } },
    });
    return sendSuccess(res, categories, 'OK');
  }),
);

/**
 * POST /expenses/categories
 * Create a new expense category.
 */
categoryRouter.post(
  '/',
  requirePermission('expense:manage'),
  validateBody(CreateExpenseCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateExpenseCategorySchema>;

    // Enforce uniqueness within the business.
    const existing = await prisma.expenseCategory.findFirst({
      where: { businessId: bizId, name: { equals: body.name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      return sendError(
        res,
        Errors.conflict('A category with this name already exists', 'CATEGORY_DUPLICATE'),
      );
    }

    try {
      const category = await prisma.expenseCategory.create({
        data: {
          businessId: bizId,
          name: body.name,
          description: body.description ?? null,
        },
      });
      writeAudit(req, {
        action: 'expense_category.create',
        resourceType: 'expense_category',
        resourceId: category.id,
        change: { name: category.name },
      });
      return sendSuccess(res, category, 'Category created', 201);
    } catch (err) {
      return sendError(
        res,
        Errors.conflict(
          (err as Error)?.message ?? 'Category already exists',
          'CATEGORY_DUPLICATE',
        ),
      );
    }
  }),
);

expenseRouter.use('/categories', categoryRouter);

// =====================================================
// POST /expenses — create
// =====================================================
expenseRouter.post(
  '/',
  requirePermission('expense:manage'),
  validateBody(CreateExpenseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateExpenseSchema>;

    const amountMinor = toMinor(body.amount);
    if (amountMinor < 0n) {
      return sendError(res, Errors.badRequest('Amount cannot be negative', 'INVALID_AMOUNT'));
    }

    // Validate categoryId belongs to this business (if provided).
    if (body.categoryId) {
      const cat = await prisma.expenseCategory.findFirst({
        where: { id: body.categoryId, businessId: bizId },
        select: { id: true },
      });
      if (!cat) {
        return sendError(res, Errors.badRequest('Category not found', 'CATEGORY_NOT_FOUND'));
      }
    }

    // Validate branchId belongs to this business (if provided).
    if (body.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: body.branchId, businessId: bizId },
        select: { id: true },
      });
      if (!branch) {
        return sendError(res, Errors.badRequest('Branch not found', 'BRANCH_NOT_FOUND'));
      }
    }

    // Branch scoping: body.branchId wins, else req.activeBranchId.
    const branchId = body.branchId ?? req.activeBranchId ?? null;

    const expense = await prisma.expense.create({
      data: {
        businessId: bizId,
        branchId,
        categoryId: body.categoryId ?? null,
        title: body.title,
        amountMinor,
        paymentMethod: body.paymentMethod ?? null,
        reference: body.reference ?? null,
        receiptUrl: body.receiptUrl ?? null,
        description: body.description ?? null,
        expenseDate: body.expenseDate ? new Date(body.expenseDate) : new Date(),
        recordedById: req.user?.id ?? null,
      },
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    writeAudit(req, {
      action: 'expense.create',
      resourceType: 'expense',
      resourceId: expense.id,
      change: {
        title: expense.title,
        amountMinor: expense.amountMinor.toString(),
        categoryId: expense.categoryId,
        branchId: expense.branchId,
      },
    });

    return sendSuccess(res, serializeExpense(expense), 'Expense created', 201);
  }),
);

// =====================================================
// GET /expenses — list with search, filter by category/date/branch
// =====================================================
expenseRouter.get(
  '/',
  validateQuery(ListExpensesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as z.infer<typeof ListExpensesQuerySchema>;

    const where: Record<string, unknown> = { businessId: bizId };

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.branchId) where.branchId = query.branchId;

    if (query.from || query.to) {
      where.expenseDate = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { description: { contains: query.search } },
        { reference: { contains: query.search } },
      ];
    }

    const total = await prisma.expense.count({ where });
    const expenses = await prisma.expense.findMany({
      ...paginate({ where, orderBy: { expenseDate: 'desc' } } as any, query),
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    } as any);

    const items = expenses.map(serializeExpense);

    // Aggregate totals in the filtered set.
    const agg = await prisma.expense.aggregate({
      _sum: { amountMinor: true },
      where,
    });
    const totalAmountMinor = BigInt(agg._sum.amountMinor ?? 0n);

    return sendSuccess(
      res,
      {
        items,
        meta: pageMeta(total, query),
        totals: {
          amountMinor: totalAmountMinor.toString(),
        },
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /expenses/:id — get details with audit trail
// =====================================================
expenseRouter.get(
  '/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const expense = await prisma.expense.findFirst({
      where: { id, businessId: bizId },
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!expense) return sendError(res, Errors.notFound('Expense not found'));

    // Fetch audit trail (create / update / delete events for this expense).
    const auditTrail = await prisma.auditLog.findMany({
      where: {
        businessId: bizId,
        resourceType: 'expense',
        resourceId: id,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        action: true,
        actorId: true,
        change: true,
        ipAddress: true,
        createdAt: true,
      },
      take: 100,
    });

    return sendSuccess(
      res,
      {
        ...serializeExpense(expense),
        auditTrail,
      },
      'OK',
    );
  }),
);

// =====================================================
// PATCH /expenses/:id — update
// =====================================================
expenseRouter.patch(
  '/:id',
  requirePermission('expense:manage'),
  validateParams(IdParamsSchema),
  validateBody(UpdateExpenseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof UpdateExpenseSchema>;

    const existing = await prisma.expense.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!existing) return sendError(res, Errors.notFound('Expense not found'));

    if (body.categoryId) {
      const cat = await prisma.expenseCategory.findFirst({
        where: { id: body.categoryId, businessId: bizId },
        select: { id: true },
      });
      if (!cat) {
        return sendError(res, Errors.badRequest('Category not found', 'CATEGORY_NOT_FOUND'));
      }
    }
    if (body.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: body.branchId, businessId: bizId },
        select: { id: true },
      });
      if (!branch) {
        return sendError(res, Errors.badRequest('Branch not found', 'BRANCH_NOT_FOUND'));
      }
    }

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.amount !== undefined) data.amountMinor = toMinor(body.amount);
    if (body.categoryId !== undefined) data.categoryId = body.categoryId;
    if (body.branchId !== undefined) data.branchId = body.branchId;
    if (body.paymentMethod !== undefined) data.paymentMethod = body.paymentMethod;
    if (body.reference !== undefined) data.reference = body.reference;
    if (body.receiptUrl !== undefined) data.receiptUrl = body.receiptUrl;
    if (body.description !== undefined) data.description = body.description;
    if (body.expenseDate !== undefined) data.expenseDate = new Date(body.expenseDate);

    const updated = await prisma.expense.update({
      where: { id },
      data,
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    writeAudit(req, {
      action: 'expense.update',
      resourceType: 'expense',
      resourceId: id,
      change: body,
    });

    return sendSuccess(res, serializeExpense(updated), 'Expense updated');
  }),
);

// =====================================================
// DELETE /expenses/:id — soft delete with audit note
// =====================================================
// The Expense model has no archivedAt field; we implement "soft delete" as a
// hard delete, but capture the full record snapshot + user-supplied note in
// the audit log so financial history is preserved.
expenseRouter.delete(
  '/:id',
  requirePermission('expense:manage'),
  validateParams(IdParamsSchema),
  validateBody(DeleteExpenseSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as z.infer<typeof DeleteExpenseSchema>;

    const expense = await prisma.expense.findFirst({
      where: { id, businessId: bizId },
      include: {
        category: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!expense) return sendError(res, Errors.notFound('Expense not found'));

    // Snapshot for audit trail BEFORE deletion.
    const snapshot = {
      id: expense.id,
      title: expense.title,
      amountMinor: expense.amountMinor.toString(),
      categoryId: expense.categoryId,
      categoryName: expense.category?.name ?? null,
      branchId: expense.branchId,
      branchName: expense.branch?.name ?? null,
      paymentMethod: expense.paymentMethod,
      reference: expense.reference,
      expenseDate: expense.expenseDate,
      description: expense.description,
    };

    await prisma.expense.delete({ where: { id } });

    writeAudit(req, {
      action: 'expense.delete',
      resourceType: 'expense',
      resourceId: id,
      change: {
        snapshot,
        note: body.note ?? null,
        deletedById: req.user?.id ?? null,
      },
    });

    return sendSuccess(
      res,
      { id, deleted: true, note: body.note ?? null },
      'Expense deleted',
    );
  }),
);
