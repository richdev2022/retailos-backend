import { z } from 'zod';

/** Standard pagination query schema. */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

/**
 * Apply skip/take to a Prisma query args object. Preserves the input type
 * so Prisma's inferred return types (include/select) still flow through.
 */
export function paginate<T extends Record<string, unknown>>(q: T, input: PaginationInput): T & { skip: number; take: number } {
  const skip = (input.page - 1) * input.limit;
  const take = input.limit;
  return { ...q, skip, take };
}

export function pageMeta(total: number, input: PaginationInput) {
  return {
    page: input.page,
    limit: input.limit,
    total,
    pages: Math.ceil(total / input.limit) || 1,
  };
}

/** Build a Prisma WHERE clause from a search term across multiple fields (OR). */
export function searchClause(term: string | undefined, fields: string[]) {
  if (!term) return undefined;
  return {
    OR: fields.map((f) => ({ [f]: { contains: term, mode: 'insensitive' } })),
  };
}

