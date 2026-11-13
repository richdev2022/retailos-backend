import { z } from 'zod';
import { PaginationSchema } from '../../utils/pagination.js';

// =====================================================
// Shared primitives
// =====================================================

/**
 * Money fields arrive as decimal strings ("1250.50") — sometimes as raw numbers
 * from poorly-typed clients. We accept both and normalise to a string, which the
 * route layer converts to BigInt minor units via `toMinor()`.
 * Floating-point must NEVER be stored.
 */
const moneyInput = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
  z.number().nonnegative().finite(),
]);

export const moneyString = moneyInput.transform((v: string | number) => String(v));

/** Optional money input — keeps null/undefined distinct so update handlers
 *  can tell "don't touch this field" (undefined) from "clear this field" (null). */
export const moneyStringNullableOptional = moneyInput
  .nullish()
  .transform((v: string | number | null | undefined) =>
    v === undefined ? undefined : v === null ? null : String(v),
  );

export const ProductStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']);

/** Boolean from a query-string value. Handles "true"/"false"/"1"/"0". */
const boolQuery = z.preprocess((v: unknown) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  if (Array.isArray(v)) return v[0] === 'true' || v[0] === '1';
  return false;
}, z.boolean());

// =====================================================
// Product CRUD
// =====================================================

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  sku: z.string().min(1).max(100),
  barcode: z.string().max(100).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  costPrice: moneyString.default('0'),
  sellingPrice: moneyString.default('0'),
  wholesalePrice: moneyStringNullableOptional,
  minStock: z.number().int().min(0).max(1_000_000_000).default(0),
  status: ProductStatusEnum.default('ACTIVE'),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  sku: z.string().min(1).max(100).optional(),
  barcode: z.string().max(100).optional().nullable(),
  brand: z.string().max(120).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  costPrice: moneyString.optional(),
  sellingPrice: moneyString.optional(),
  wholesalePrice: moneyStringNullableOptional,
  minStock: z.number().int().min(0).max(1_000_000_000).optional(),
  status: ProductStatusEnum.optional(),
});

export const ListProductsQuerySchema = PaginationSchema.extend({
  categoryId: z.string().uuid().optional(),
  status: ProductStatusEnum.optional(),
  /** "in_stock" | "low_stock" | "out_of_stock" | "all" (default: all). */
  stock: z.enum(['in_stock', 'low_stock', 'out_of_stock', 'all']).optional(),
  branchId: z.string().uuid().optional(),
  includeArchived: boolQuery.default(false),
  brand: z.string().max(120).optional(),
});

export const ProductParamsSchema = z.object({
  id: z.string().uuid(),
});

export const ProductMovementsQuerySchema = PaginationSchema.extend({
  branchId: z.string().uuid().optional(),
  movementType: z.string().max(60).optional(),
  referenceType: z.string().max(60).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

// =====================================================
// Bulk import
// =====================================================

export const BulkImportProductSchema = z.object({
  products: z.array(CreateProductSchema).min(1).max(1000),
});

// =====================================================
// Category
// =====================================================

export const CreateCategorySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

export const ListCategoriesQuerySchema = z.object({
  /** If set, returns the children of this parent (one level of the tree). */
  parentId: z.string().uuid().optional(),
  /** If true, returns a full nested tree starting from roots. */
  tree: boolQuery.default(false),
});

export const IdParamsSchema = z.object({
  id: z.string().uuid(),
});

// =====================================================
// Unit of measure
// =====================================================

export const CreateUnitSchema = z.object({
  name: z.string().min(1).max(80),
  shortName: z.string().min(1).max(20),
});

export const UpdateUnitSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  shortName: z.string().min(1).max(20).optional(),
});

// =====================================================
// Barcode
// =====================================================

export const CreateBarcodeSchema = z.object({
  productId: z.string().uuid(),
  barcode: z.string().min(1).max(100),
  format: z.string().max(40).optional().nullable(),
});

export const BarcodeParamsSchema = z.object({
  id: z.string().uuid(),
});

// =====================================================
// Type exports
// =====================================================

export type CreateProductInput = z.infer<typeof CreateProductSchema>;
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;
export type ListProductsQuery = z.infer<typeof ListProductsQuerySchema>;
export type ProductMovementsQuery = z.infer<typeof ProductMovementsQuerySchema>;
export type BulkImportProductInput = z.infer<typeof BulkImportProductSchema>;
export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuerySchema>;
export type CreateUnitInput = z.infer<typeof CreateUnitSchema>;
export type UpdateUnitInput = z.infer<typeof UpdateUnitSchema>;
export type CreateBarcodeInput = z.infer<typeof CreateBarcodeSchema>;
