/**
 * @openapi
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         categoryId: { type: string, format: uuid, nullable: true }
 *         unitId: { type: string, format: uuid, nullable: true }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         imageUrl: { type: string, nullable: true }
 *         sku: { type: string }
 *         barcode: { type: string, nullable: true }
 *         brand: { type: string, nullable: true }
 *         costPriceMinor: { type: string, description: "Integer minor units (kobo)" }
 *         sellingPriceMinor: { type: string }
 *         wholesalePriceMinor: { type: string, nullable: true }
 *         minStock: { type: integer }
 *         status: { type: string, enum: [ACTIVE, INACTIVE, ARCHIVED] }
 *         archivedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     Category:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         parentId: { type: string, format: uuid, nullable: true }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     UnitOfMeasure:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         name: { type: string }
 *         shortName: { type: string }
 *         createdAt: { type: string, format: date-time }
 *     ProductBarcode:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         productId: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         barcode: { type: string }
 *         format: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Create a product
 *     description: Creates a new product in the active business. Initial stock is NOT set here — use the Stock-In operation. Money fields are decimal strings ("1250.50") converted to integer minor units.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Product' }
 *     responses:
 *       201: { description: Product created }
 *       409: { description: Duplicate SKU or barcode }
 *   get:
 *     tags: [Products]
 *     summary: List products
 *     description: Paginated list with search, category filter, status filter and stock-status filter.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: categoryId, schema: { type: string, format: uuid } }
 *       - { in: query, name: status, schema: { type: string, enum: [ACTIVE, INACTIVE, ARCHIVED] } }
 *       - { in: query, name: stock, schema: { type: string, enum: [in_stock, low_stock, out_of_stock, all] } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: includeArchived, schema: { type: boolean, default: false } }
 *     responses:
 *       200: { description: Paginated list of products }
 *
 * /products/import:
 *   post:
 *     tags: [Products]
 *     summary: Bulk import products
 *     description: Creates up to 1000 products from an array. Partial success is allowed — failed rows are returned with an error message.
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
 *               products:
 *                 type: array
 *                 items: { $ref: '#/components/schemas/Product' }
 *     responses:
 *       201: { description: Bulk import result with created/failed arrays }
 *
 * /products/export:
 *   get:
 *     tags: [Products]
 *     summary: Export all products as JSON
 *     description: Returns all non-archived products for the active business. Clients can build CSV/XLSX from this.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Array of products }
 *
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Product detail with category, unit, barcodes and inventory balances }
 *       404: { description: Not found }
 *   patch:
 *     tags: [Products]
 *     summary: Update product
 *     description: If only price fields (costPrice/sellingPrice/wholesalePrice) are sent, requires `product:edit_price`; otherwise requires `product:edit`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated product }
 *
 * /products/{id}/archive:
 *   patch:
 *     tags: [Products]
 *     summary: Archive a product
 *     description: Soft-archives a product by setting status=ARCHIVED and archivedAt=now(). Does not delete.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Archived product }
 *
 * /products/{id}/movements:
 *   get:
 *     tags: [Products]
 *     summary: Inventory movement history for a product
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: branchId, schema: { type: string, format: uuid } }
 *       - { in: query, name: movementType, schema: { type: string } }
 *     responses:
 *       200: { description: Paginated inventory movements }
 *
 * /products/categories:
 *   post:
 *     tags: [Products]
 *     summary: Create a category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Category created }
 *   get:
 *     tags: [Products]
 *     summary: List categories (tree if parentId or ?tree=true)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: parentId, schema: { type: string, format: uuid } }
 *       - { in: query, name: tree, schema: { type: boolean, default: false } }
 *     responses:
 *       200: { description: List or tree of categories }
 *
 * /products/categories/{id}:
 *   patch:
 *     tags: [Products]
 *     summary: Update a category
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated category }
 *   delete:
 *     tags: [Products]
 *     summary: Delete a category (only if no products attached and no children)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Category deleted }
 *       409: { description: Category has products or children }
 *
 * /products/units:
 *   post:
 *     tags: [Products]
 *     summary: Create a unit of measure
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Unit created }
 *   get:
 *     tags: [Products]
 *     summary: List units of measure
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: List of units }
 *
 * /products/barcodes:
 *   post:
 *     tags: [Products]
 *     summary: Add an additional barcode to a product
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Barcode added }
 *
 * /products/barcodes/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Delete a barcode
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Barcode deleted }
 */
import { Router, type Request, type Response, type NextFunction } from 'express';

import { prisma } from '../../db/index.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import { toMinor } from '../../utils/money.js';
import { paginate, pageMeta } from '../../utils/pagination.js';
import { requirePermission } from '../../middleware/auth.js';
import { tenantContext, enforceEntitlement } from '../../middleware/tenant.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  CreateProductSchema,
  UpdateProductSchema,
  ListProductsQuerySchema,
  ProductParamsSchema,
  ProductMovementsQuerySchema,
  BulkImportProductSchema,
  CreateCategorySchema,
  UpdateCategorySchema,
  ListCategoriesQuerySchema,
  IdParamsSchema,
  CreateUnitSchema,
  CreateBarcodeSchema,
  BarcodeParamsSchema,
  type CreateProductInput,
  type UpdateProductInput,
  type ListProductsQuery,
  type ProductMovementsQuery,
  type BulkImportProductInput,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type ListCategoriesQuery,
  type CreateUnitInput,
  type CreateBarcodeInput,
} from './schemas.js';

// =====================================================
// Types
// =====================================================

/** Result of a single product create attempt inside the bulk import flow. */
type BulkImportResult =
  | { success: true; index: number; id: string; sku: string }
  | { success: false; index: number; sku: string; error: string };

// =====================================================
// Router setup
// =====================================================

export const productRouter = Router();

// All product routes require an active business context (tenant scoping).
// authMiddleware is applied at the mount point in app.ts.
productRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

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
 * Permission middleware for PATCH /products/:id.
 * If only price fields are being updated, requires `product:edit_price`;
 * otherwise requires `product:edit`.
 * MUST be registered AFTER validateBody so req.body is the parsed payload.
 */
function requireProductEditPermission(req: Request, res: Response, next: NextFunction) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const priceOnlyFields = new Set(['costPrice', 'sellingPrice', 'wholesalePrice']);
  const keys = Object.keys(body);
  const isPriceOnly = keys.length > 0 && keys.every((k) => priceOnlyFields.has(k));
  const perm = isPriceOnly ? 'product:edit_price' : 'product:edit';
  return Promise.resolve(requirePermission(perm)(req, res, next)).catch(next);
}

/** Convert a parsed CreateProductInput body into Prisma `data` (minor units for money). */
function productCreateData(bizId: string, body: CreateProductInput, branchId?: string) {
  return {
    businessId: bizId,
    branchId: body.branchId ?? branchId ?? null,
    categoryId: body.categoryId ?? null,
    unitId: body.unitId ?? null,
    name: body.name,
    description: body.description ?? null,
    imageUrl: body.imageUrl ?? null,
    sku: body.sku,
    barcode: body.barcode ?? null,
    brand: body.brand ?? null,
    costPriceMinor: toMinor(body.costPrice),
    sellingPriceMinor: toMinor(body.sellingPrice),
    wholesalePriceMinor: body.wholesalePrice ? toMinor(body.wholesalePrice) : null,
    minStock: body.minStock,
    status: body.status,
  };
}

/** Convert a parsed UpdateProductInput body into Prisma `data` (minor units for money). */
function productUpdateData(body: UpdateProductInput) {
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.imageUrl !== undefined) data.imageUrl = body.imageUrl;
  if (body.sku !== undefined) data.sku = body.sku;
  if (body.barcode !== undefined) data.barcode = body.barcode;
  if (body.brand !== undefined) data.brand = body.brand;
  if (body.minStock !== undefined) data.minStock = body.minStock;
  if (body.status !== undefined) data.status = body.status;
  if (body.categoryId !== undefined) {
    data.category = body.categoryId ? { connect: { id: body.categoryId } } : { disconnect: true };
  }
  if (body.unitId !== undefined) {
    data.unit = body.unitId ? { connect: { id: body.unitId } } : { disconnect: true };
  }
  if (body.branchId !== undefined) {
    data.branch = body.branchId ? { connect: { id: body.branchId } } : { disconnect: true };
  }
  if (body.costPrice !== undefined) data.costPriceMinor = toMinor(body.costPrice);
  if (body.sellingPrice !== undefined) data.sellingPriceMinor = toMinor(body.sellingPrice);
  if (body.wholesalePrice !== undefined) {
    data.wholesalePriceMinor = body.wholesalePrice === null ? null : toMinor(body.wholesalePrice);
  }
  return data;
}

/** Friendly message for a Prisma P2002 (unique constraint) error. */
function duplicateMessage(err: unknown): string {
  const e = err as { code?: string; meta?: { target?: string[] } };
  if (e?.code === 'P2002') {
    const target = e.meta?.target ?? [];
    if (target.includes('sku')) return 'A product with this SKU already exists';
    if (target.includes('barcode')) return 'A product with this barcode already exists';
    if (target.includes('name')) return 'A record with this name already exists';
    return 'A record with this value already exists';
  }
  return (err as Error)?.message ?? 'Unknown error';
}

/** Serialise a product (and nested inventory balances) so BigInt fields become strings. */
function serializeProduct(p: any) {
  return {
    ...p,
    costPriceMinor: p.costPriceMinor?.toString() ?? '0',
    sellingPriceMinor: p.sellingPriceMinor?.toString() ?? '0',
    wholesalePriceMinor: p.wholesalePriceMinor != null ? p.wholesalePriceMinor.toString() : null,
    inventoryBalances: (p.inventoryBalances ?? []).map((b: any) => ({
      ...b,
      wacCostMinor: b.wacCostMinor?.toString() ?? '0',
    })),
  };
}

/** Common include for product detail/list queries. */
const productInclude = {
  category: { select: { id: true, name: true } },
  unit: { select: { id: true, name: true, shortName: true } },
  barcodes: { select: { id: true, barcode: true, format: true } },
  inventoryBalances: { select: { branchId: true, quantity: true, wacCostMinor: true } },
  _count: { select: { movements: true } },
};

// =====================================================
// Bulk import + export (registered BEFORE /:id to avoid path collision)
// =====================================================

/**
 * POST /products/import
 * Bulk import products from an array. Partial success allowed.
 */
productRouter.post(
  '/import',
  validateBody(BulkImportProductSchema),
  requirePermission('product:create'),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { products } = req.body as BulkImportProductInput;
    const activeBranchId = req.activeBranchId;

    // Entitlement: ensure import size won't exceed plan product limit.
    const sub = await prisma.subscription.findFirst({
      where: { businessId: bizId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (sub?.plan?.productLimit) {
      const currentCount = await prisma.product.count({
        where: { businessId: bizId, status: { not: 'ARCHIVED' } },
      });
      const remaining = sub.plan.productLimit - currentCount;
      if (products.length > remaining) {
        return sendError(
          res,
          Errors.entitlement(
            `Import would exceed plan product limit (${sub.plan.productLimit}). Only ${Math.max(
              remaining,
              0,
            )} slot(s) remaining.`,
          ),
        );
      }
    }

    // Create each product individually so partial failures don't roll back successes.
    const results = await Promise.all(
      products.map(
        async (p: CreateProductInput, index: number): Promise<BulkImportResult> => {
          try {
            const created = await prisma.product.create({
              data: productCreateData(bizId, p, activeBranchId),
            });
            return { success: true as const, index, id: created.id, sku: created.sku };
          } catch (err) {
            return {
              success: false as const,
              index,
              sku: p.sku,
              error: duplicateMessage(err),
            };
          }
        },
      ),
    );

    const created = results.filter((r: BulkImportResult) => r.success);
    const failed = results.filter((r: BulkImportResult) => !r.success);

    writeAudit(req, {
      action: 'product.bulk_import',
      resourceType: 'product',
      resourceId: bizId,
      change: {
        requested: products.length,
        created: created.length,
        failed: failed.length,
      },
    });

    return sendSuccess(
      res,
      {
        totalRequested: products.length,
        totalCreated: created.length,
        totalFailed: failed.length,
        created,
        failed,
      },
      'Bulk import completed',
      201,
    );
  }),
);

/**
 * GET /products/export
 * Export all (non-archived) products as JSON.
 */
productRouter.get(
  '/export',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const branchId = req.activeBranchId;

    const products = await prisma.product.findMany({
      where: { businessId: bizId, status: { not: 'ARCHIVED' } },
      include: {
        ...productInclude,
        balances: {
          where: branchId ? { branchId } : undefined,
          select: { branchId: true, quantity: true, wacCostMinor: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return sendSuccess(
      res,
      products.map(serializeProduct),
      'OK',
    );
  }),
);

// =====================================================
// Sub-routers: categories, units, barcodes
// (registered BEFORE /:id to avoid path collision)
// =====================================================

// ---------- Categories ----------
const categoryRouter = Router();

categoryRouter.post(
  '/',
  requirePermission('product:create'),
  validateBody(CreateCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as CreateCategoryInput;

    try {
      const category = await prisma.category.create({
        data: {
          businessId: bizId,
          name: body.name,
          description: body.description ?? null,
          parentId: body.parentId ?? null,
        },
      });
      writeAudit(req, {
        action: 'category.create',
        resourceType: 'category',
        resourceId: category.id,
        change: { name: category.name, parentId: category.parentId },
      });
      return sendSuccess(res, category, 'Category created', 201);
    } catch (err) {
      return sendError(res, Errors.conflict(duplicateMessage(err), 'DUPLICATE'));
    }
  }),
);

categoryRouter.get(
  '/',
  validateQuery(ListCategoriesQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as ListCategoriesQuery;

    if (query.tree) {
      // Fetch roots, recursively include children (one level for now).
      const roots = await prisma.category.findMany({
        where: { businessId: bizId, parentId: null },
        include: { children: { include: { children: true } }, _count: { select: { products: true } } },
        orderBy: { name: 'asc' },
      });
      return sendSuccess(res, roots, 'OK');
    }

    if (query.parentId) {
      const children = await prisma.category.findMany({
        where: { businessId: bizId, parentId: query.parentId },
        include: { _count: { select: { products: true, children: true } } },
        orderBy: { name: 'asc' },
      });
      return sendSuccess(res, children, 'OK');
    }

    const all = await prisma.category.findMany({
      where: { businessId: bizId },
      include: { _count: { select: { products: true, children: true } } },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, all, 'OK');
  }),
);

categoryRouter.patch(
  '/:id',
  requirePermission('product:edit'),
  validateParams(IdParamsSchema),
  validateBody(UpdateCategorySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as UpdateCategoryInput;

    // Ensure category belongs to this business.
    const existing = await prisma.category.findFirst({ where: { id, businessId: bizId } });
    if (!existing) return sendError(res, Errors.notFound('Category not found'));

    // Prevent circular parent reference.
    if (body.parentId && body.parentId === id) {
      return sendError(res, Errors.badRequest('A category cannot be its own parent', 'CIRCULAR_PARENT'));
    }

    try {
      const updated = await prisma.category.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
        },
      });
      writeAudit(req, {
        action: 'category.update',
        resourceType: 'category',
        resourceId: id,
        change: body,
      });
      return sendSuccess(res, updated, 'Category updated');
    } catch (err) {
      return sendError(res, Errors.conflict(duplicateMessage(err), 'DUPLICATE'));
    }
  }),
);

categoryRouter.delete(
  '/:id',
  requirePermission('product:edit'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const existing = await prisma.category.findFirst({
      where: { id, businessId: bizId },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!existing) return sendError(res, Errors.notFound('Category not found'));

    if (existing._count.products > 0) {
      return sendError(
        res,
        Errors.conflict(
          `Cannot delete: ${existing._count.products} product(s) are attached to this category`,
          'CATEGORY_HAS_PRODUCTS',
        ),
      );
    }
    if (existing._count.children > 0) {
      return sendError(
        res,
        Errors.conflict(
          `Cannot delete: ${existing._count.children} sub-categor(ies) exist. Re-parent or delete them first.`,
          'CATEGORY_HAS_CHILDREN',
        ),
      );
    }

    await prisma.category.delete({ where: { id } });
    writeAudit(req, {
      action: 'category.delete',
      resourceType: 'category',
      resourceId: id,
      change: { name: existing.name },
    });
    return sendSuccess(res, { id }, 'Category deleted');
  }),
);

productRouter.use('/categories', categoryRouter);

// ---------- Units of measure ----------
const unitRouter = Router();

unitRouter.post(
  '/',
  requirePermission('product:create'),
  validateBody(CreateUnitSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as CreateUnitInput;

    try {
      const unit = await prisma.unitOfMeasure.create({
        data: {
          businessId: bizId,
          name: body.name,
          shortName: body.shortName,
        },
      });
      writeAudit(req, {
        action: 'unit.create',
        resourceType: 'unit_of_measure',
        resourceId: unit.id,
        change: { name: unit.name, shortName: unit.shortName },
      });
      return sendSuccess(res, unit, 'Unit created', 201);
    } catch (err) {
      return sendError(res, Errors.conflict(duplicateMessage(err), 'DUPLICATE'));
    }
  }),
);

unitRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const units = await prisma.unitOfMeasure.findMany({
      where: { businessId: bizId },
      orderBy: { name: 'asc' },
    });
    return sendSuccess(res, units, 'OK');
  }),
);

productRouter.use('/units', unitRouter);

// ---------- Barcodes ----------
const barcodeRouter = Router();

barcodeRouter.post(
  '/',
  requirePermission('product:edit'),
  validateBody(CreateBarcodeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as CreateBarcodeInput;

    // Verify product exists and belongs to this business.
    const product = await prisma.product.findFirst({
      where: { id: body.productId, businessId: bizId },
      select: { id: true, sku: true },
    });
    if (!product) return sendError(res, Errors.notFound('Product not found'));

    try {
      const barcode = await prisma.productBarcode.create({
        data: {
          productId: body.productId,
          businessId: bizId,
          barcode: body.barcode,
          format: body.format ?? null,
        },
      });
      writeAudit(req, {
        action: 'barcode.create',
        resourceType: 'product_barcode',
        resourceId: barcode.id,
        change: { productId: body.productId, barcode: body.barcode },
      });
      return sendSuccess(res, barcode, 'Barcode added', 201);
    } catch (err) {
      return sendError(res, Errors.conflict(duplicateMessage(err), 'BARCODE_DUPLICATE'));
    }
  }),
);

barcodeRouter.delete(
  '/:id',
  requirePermission('product:edit'),
  validateParams(BarcodeParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const barcode = await prisma.productBarcode.findFirst({
      where: { id, businessId: bizId },
    });
    if (!barcode) return sendError(res, Errors.notFound('Barcode not found'));

    await prisma.productBarcode.delete({ where: { id } });
    writeAudit(req, {
      action: 'barcode.delete',
      resourceType: 'product_barcode',
      resourceId: id,
      change: { barcode: barcode.barcode },
    });
    return sendSuccess(res, { id }, 'Barcode deleted');
  }),
);

productRouter.use('/barcodes', barcodeRouter);

// =====================================================
// Product CRUD
// =====================================================

/**
 * POST /products — create product
 */
productRouter.post(
  '/',
  requirePermission('product:create'),
  enforceEntitlement('product'),
  validateBody(CreateProductSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as CreateProductInput;

    try {
      const product = await prisma.product.create({
        data: productCreateData(bizId, body, req.activeBranchId),
        include: productInclude,
      });
      writeAudit(req, {
        action: 'product.create',
        resourceType: 'product',
        resourceId: product.id,
        change: {
          name: product.name,
          sku: product.sku,
          costPriceMinor: product.costPriceMinor.toString(),
          sellingPriceMinor: product.sellingPriceMinor.toString(),
        },
      });
      return sendSuccess(res, serializeProduct(product), 'Product created', 201);
    } catch (err) {
      return sendError(res, Errors.conflict(duplicateMessage(err), 'DUPLICATE'));
    }
  }),
);

/**
 * GET /products — list with search/filter/pagination
 */
productRouter.get(
  '/',
  validateQuery(ListProductsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const query = req.query as unknown as ListProductsQuery;

    const where: Record<string, unknown> = { businessId: bizId };

    // Status filter (default: exclude ARCHIVED unless includeArchived=true or status=ARCHIVED).
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeArchived) {
      where.status = { not: 'ARCHIVED' };
    }

    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.brand) where.brand = { contains: query.brand };

    // Search across name/sku/barcode/brand.
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { sku: { contains: query.search } },
        { barcode: { contains: query.search } },
        { brand: { contains: query.search } },
      ];
    }

    // Stock-status filter: requires joining with InventoryBalance.
    // We pre-compute matching product ids, then constrain the main query.
    if (query.stock && query.stock !== 'all') {
      const balances = await prisma.inventoryBalance.findMany({
        where: { businessId: bizId, ...(query.branchId ? { branchId: query.branchId } : {}) },
        select: { productId: true, quantity: true },
      });
      const stockByProduct = new Map<string, number>();
      for (const b of balances) {
        stockByProduct.set(b.productId, (stockByProduct.get(b.productId) ?? 0) + b.quantity);
      }
      const candidates = await prisma.product.findMany({
        where: { businessId: bizId },
        select: { id: true, minStock: true },
      });
      const matching: string[] = [];
      for (const p of candidates) {
        const qty = stockByProduct.get(p.id) ?? 0;
        if (query.stock === 'out_of_stock' && qty <= 0) matching.push(p.id);
        else if (query.stock === 'low_stock' && qty > 0 && qty <= p.minStock) matching.push(p.id);
        else if (query.stock === 'in_stock' && qty > p.minStock) matching.push(p.id);
      }
      if (matching.length === 0) {
        return sendSuccess(res, { items: [], meta: pageMeta(0, query) }, 'OK');
      }
      where.id = { in: matching };
    }

    const total = await prisma.product.count({ where });
    const products = await prisma.product.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' } } as any, query),
      include: {
        ...productInclude,
        balances: {
          where: query.branchId ? { branchId: query.branchId } : undefined,
          select: { branchId: true, quantity: true, wacCostMinor: true },
        },
      },
    } as any);

    return sendSuccess(
      res,
      {
        items: products.map(serializeProduct),
        meta: pageMeta(total, query),
      },
      'OK',
    );
  }),
);

/**
 * GET /products/:id — get product by id
 */
productRouter.get(
  '/:id',
  validateParams(ProductParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const branchId = req.activeBranchId;

    const product = await prisma.product.findFirst({
      where: { id, businessId: bizId },
      include: {
        ...productInclude,
        balances: {
          where: branchId ? { branchId } : undefined,
          select: { id: true, branchId: true, quantity: true, wacCostMinor: true, updatedAt: true },
        },
      } as any,
    });
    if (!product) return sendError(res, Errors.notFound('Product not found'));

    return sendSuccess(res, serializeProduct(product), 'OK');
  }),
);

/**
 * PATCH /products/:id — update product
 * If only price fields are sent, requires `product:edit_price`; otherwise `product:edit`.
 */
productRouter.patch(
  '/:id',
  validateParams(ProductParamsSchema),
  validateBody(UpdateProductSchema),
  requireProductEditPermission,
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const body = req.body as UpdateProductInput;

    const existing = await prisma.product.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, sku: true, status: true },
    });
    if (!existing) return sendError(res, Errors.notFound('Product not found'));

    try {
      const updated = await prisma.product.update({
        where: { id },
        data: productUpdateData(body),
        include: productInclude,
      });
      writeAudit(req, {
        action: 'product.update',
        resourceType: 'product',
        resourceId: id,
        change: body,
      });
      return sendSuccess(res, serializeProduct(updated), 'Product updated');
    } catch (err) {
      return sendError(res, Errors.conflict(duplicateMessage(err), 'DUPLICATE'));
    }
  }),
);

/**
 * PATCH /products/:id/archive — archive a product
 */
productRouter.patch(
  '/:id/archive',
  validateParams(ProductParamsSchema),
  requirePermission('product:archive'),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const existing = await prisma.product.findFirst({
      where: { id, businessId: bizId },
      select: { id: true, name: true, status: true },
    });
    if (!existing) return sendError(res, Errors.notFound('Product not found'));
    if (existing.status === 'ARCHIVED') {
      return sendError(res, Errors.badRequest('Product is already archived', 'ALREADY_ARCHIVED'));
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { status: 'ARCHIVED', archivedAt: new Date() },
      include: productInclude,
    });
    writeAudit(req, {
      action: 'product.archive',
      resourceType: 'product',
      resourceId: id,
      change: { previousStatus: existing.status },
    });
    return sendSuccess(res, serializeProduct(updated), 'Product archived');
  }),
);

/**
 * GET /products/:id/movements — inventory movement history for this product
 */
productRouter.get(
  '/:id/movements',
  validateParams(ProductParamsSchema),
  validateQuery(ProductMovementsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };
    const query = req.query as unknown as ProductMovementsQuery;

    const product = await prisma.product.findFirst({
      where: { id, businessId: bizId },
      select: { id: true },
    });
    if (!product) return sendError(res, Errors.notFound('Product not found'));

    const where: Record<string, unknown> = {
      businessId: bizId,
      productId: id,
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.movementType ? { movementType: query.movementType } : {}),
      ...(query.referenceType ? { referenceType: query.referenceType } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const total = await prisma.inventoryMovement.count({ where });
    const movements = await prisma.inventoryMovement.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' } } as any, query),
      include: {
        branch: { select: { id: true, name: true } },
      },
    } as any);

    // Serialise BigInt fields.
    const items = movements.map((m: any) => ({
      ...m,
      unitCostMinor: m.unitCostMinor.toString(),
      totalCostMinor: m.totalCostMinor.toString(),
    }));

    return sendSuccess(res, { items, meta: pageMeta(total, query) }, 'OK');
  }),
);
