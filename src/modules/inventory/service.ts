/**
 * Inventory service — shared by inventory routes, sales, purchases, and branch
 * transfer modules. All mutations go through `applyMovement` so that WAC
 * valuation, balance projection, and the immutable movement ledger stay
 * consistent. NEVER update or delete an InventoryMovement record — corrections
 * happen via a new ADJUSTMENT movement.
 *
 * Money is stored as integer minor units (kobo for NGN). WAC is maintained per
 * (business, branch, product) and re-computed only on stock-in (qty > 0).
 */
import {
  type MovementType,
  type Prisma,
} from '@prisma/client';

import { config } from '../../config/index.js';
import type { Tx } from '../../db/index.js';
import { prisma } from '../../db/index.js';
import { Errors } from '../../utils/errors.js';
import { computeWac } from '../../utils/money.js';
import {
  paginate,
  pageMeta,
  type PaginationInput,
} from '../../utils/pagination.js';

// =====================================================
// Types
// =====================================================

/** Parameters accepted by `applyMovement`. `quantity` is SIGNED (positive=in, negative=out). */
export interface ApplyMovementParams {
  businessId: string;
  branchId?: string | null;
  productId: string;
  movementType: MovementType;
  /** Signed quantity. Positive for stock-in, negative for stock-out. */
  quantity: number;
  /** Per-unit cost in minor units. Required for stock-in to compute WAC. For stock-out, current WAC is used. */
  unitCostMinor?: bigint | null;
  referenceType?: string | null;
  referenceId?: string | null;
  batchNo?: string | null;
  expiryDate?: Date | null;
  reason?: string | null;
  notes?: string | null;
  transferId?: string | null;
  syncId?: string | null;
  responsibleUserId?: string | null;
}

/** Result of `applyMovement` — the freshly-created immutable movement and the updated balance. */
export interface ApplyMovementResult {
  movement: Prisma.InventoryMovementGetPayload<{}>;
  balance: Prisma.InventoryBalanceGetPayload<{}>;
}

/** A zero-initialised balance — returned by `getBalance` when no row exists yet. */
export interface ZeroBalance {
  id: null;
  businessId: string;
  branchId: string | null;
  productId: string;
  quantity: number;
  wacCostMinor: bigint;
  updatedAt: null;
}

/** Query options for `getMovements`. */
export interface GetMovementsParams extends PaginationInput {
  businessId: string;
  branchId?: string;
  productId?: string;
  movementType?: MovementType;
  referenceType?: string;
  referenceId?: string;
  from?: Date;
  to?: Date;
  search?: string;
}

// =====================================================
// Core: applyMovement
// =====================================================

/**
 * Atomically apply a stock movement.
 *
 * 1. Fetch or create InventoryBalance for (businessId, branchId, productId).
 * 2. For stock-in (qty > 0): recompute WAC via computeWac using existing qty/wac and
 *    the incoming unit cost. If unitCostMinor is omitted (e.g. branch transfer in),
 *    the existing WAC is used as the incoming cost so the blended WAC stays unchanged
 *    when the cost basis is identical.
 * 3. For stock-out (qty < 0): verify balance + qty >= 0 unless
 *    config.tenant.enableNegativeStock is true. Use the current WAC as the cost
 *    basis; do NOT change WAC.
 * 4. Create an immutable InventoryMovement record (with totalCostMinor computed
 *    from |qty| * effectiveUnitCost).
 * 5. Return { movement, balance }.
 *
 * MUST be called inside a `prisma.$transaction` — this function does not
 * open its own transaction.
 */
export async function applyMovement(
  tx: Tx,
  params: ApplyMovementParams,
): Promise<ApplyMovementResult> {
  const {
    businessId,
    branchId = null,
    productId,
    movementType,
    quantity,
    unitCostMinor = null,
    referenceType = null,
    referenceId = null,
    batchNo = null,
    expiryDate = null,
    reason = null,
    notes = null,
    transferId = null,
    syncId = null,
    responsibleUserId = null,
  } = params;

  if (!Number.isInteger(quantity) || quantity === 0) {
    throw Errors.badRequest(
      'Movement quantity must be a non-zero integer',
      'INVALID_QUANTITY',
    );
  }

  // 1. Fetch existing balance (or zero-init).
  const existing = await tx.inventoryBalance.findFirst({
    where: { businessId, branchId: branchId ?? null, productId },
  });

  const currentQty = existing?.quantity ?? 0;
  const currentWac = existing?.wacCostMinor ?? 0n;

  // 2. Determine effective unit cost + new WAC.
  let effectiveUnitCost: bigint;
  let newWac: bigint;

  if (quantity > 0) {
    // Stock-in: incoming unit cost is required for WAC if no balance exists.
    // If not provided (e.g. branch transfer-in), use the current WAC (so blended
    // WAC stays constant when the per-unit cost is the same).
    const incomingCost =
      unitCostMinor != null ? BigInt(unitCostMinor) : currentWac;
    effectiveUnitCost = incomingCost;
    newWac = computeWac(currentQty, currentWac, quantity, incomingCost);
  } else {
    // Stock-out: use current WAC as cost basis. WAC unchanged.
    effectiveUnitCost = currentWac;
    newWac = currentWac;
  }

  // 3. Stock-out: sufficiency check (unless negative stock is explicitly enabled).
  if (quantity < 0) {
    const resultingQty = currentQty + quantity;
    if (resultingQty < 0 && !config.tenant.enableNegativeStock) {
      throw Errors.insufficientStock(
        `Insufficient stock: requested ${Math.abs(
          quantity,
        )}, available ${currentQty}`,
      );
    }
  }

  const totalCostMinor =
    BigInt(Math.abs(quantity)) * effectiveUnitCost;

  // 4. Create the immutable movement record.
  const movement = await tx.inventoryMovement.create({
    data: {
      businessId,
      branchId: branchId ?? null,
      productId,
      movementType,
      quantity,
      referenceType,
      referenceId,
      batchNo,
      expiryDate,
      unitCostMinor: effectiveUnitCost,
      totalCostMinor,
      reason,
      notes,
      transferId,
      syncId,
      responsibleUserId,
    },
  });

  // 5. Upsert the balance.
  const newQuantity = currentQty + quantity;
  const balanceData = {
    businessId,
    branchId: branchId ?? null,
    productId,
    quantity: newQuantity,
    wacCostMinor: newWac,
  };

  let balance: Prisma.InventoryBalanceGetPayload<{}>;
  if (existing) {
    balance = await tx.inventoryBalance.update({
      where: { id: existing.id },
      data: {
        quantity: newQuantity,
        // If the balance has gone to zero, reset WAC to 0n so future receipts
        // start fresh (rather than carrying a stale cost basis).
        wacCostMinor: newQuantity === 0 ? 0n : newWac,
      },
    });
  } else {
    balance = await tx.inventoryBalance.create({
      data: balanceData,
    });
  }

  return { movement, balance };
}

// =====================================================
// getBalance
// =====================================================

/**
 * Fetch the InventoryBalance for (businessId, branchId, productId), or return a
 * zero-initialised stub if no row exists. Never throws on missing balance.
 */
export async function getBalance(
  businessId: string,
  branchId: string | null | undefined,
  productId: string,
  tx: Tx = prisma,
): Promise<Prisma.InventoryBalanceGetPayload<{}> | ZeroBalance> {
  const balance = await tx.inventoryBalance.findFirst({
    where: { businessId, branchId: branchId ?? null, productId },
  });
  if (balance) return balance;
  return {
    id: null,
    businessId,
    branchId: branchId ?? null,
    productId,
    quantity: 0,
    wacCostMinor: 0n,
    updatedAt: null,
  };
}

// =====================================================
// getMovements
// =====================================================

/** Build a Prisma WHERE clause for movement filtering. */
function buildMovementsWhere(params: GetMovementsParams): Prisma.InventoryMovementWhereInput {
  const where: Prisma.InventoryMovementWhereInput = {
    businessId: params.businessId,
  };
  if (params.branchId) where.branchId = params.branchId;
  if (params.productId) where.productId = params.productId;
  if (params.movementType) where.movementType = params.movementType;
  if (params.referenceType) where.referenceType = params.referenceType;
  if (params.referenceId) where.referenceId = params.referenceId;
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }
  if (params.search) {
    // Search across reason, notes, batchNo, and related product name/sku.
    where.OR = [
      { reason: { contains: params.search } },
      { notes: { contains: params.search } },
      { batchNo: { contains: params.search } },
      {
        product: {
          OR: [
            { name: { contains: params.search } },
            { sku: { contains: params.search } },
            { barcode: { contains: params.search } },
          ],
        },
      },
    ];
  }
  return where;
}

/**
 * Paginated inventory movement query. Includes the related product (name, sku,
 * barcode) and branch (name). Caller is responsible for serialising BigInt
 * fields to strings.
 */
export async function getMovements(
  params: GetMovementsParams,
  tx: Tx = prisma,
): Promise<{
  items: any[];
  total: number;
  meta: ReturnType<typeof pageMeta>;
}> {
  const where = buildMovementsWhere(params);
  const [total, items] = await Promise.all([
    tx.inventoryMovement.count({ where }),
    tx.inventoryMovement.findMany({
      ...paginate({ where, orderBy: { createdAt: 'desc' } } as any, params),
      include: {
        product: { select: { id: true, name: true, sku: true, barcode: true } },
        branch: { select: { id: true, name: true } },
      },
    } as any),
  ]);
  return { items, total, meta: pageMeta(total, params) };
}
