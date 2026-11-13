/**
 * Sales service — shared pure helpers used by `routes.ts` (and by the sync /
 * reports modules later). All database work happens inside a
 * `prisma.$transaction` in `routes.ts` so that `applyMovement` (inventory
 * deduction) and sale/payment/credit creation remain atomic. This module only
 * contains pure functions and serializers — no Prisma calls — to keep the
 * pricing rules unit-testable in isolation.
 *
 * Money is stored as integer minor units (kobo for NGN). Money inputs arrive
 * as decimal strings ("1250.50") and are converted via `toMinor()`. BigInts
 * are converted to strings before JSON serialisation (see `serializeSale`).
 *
 * Pricing model (PRD section 4.5 + 7.3):
 *   lineTotal     = quantity * unitPriceMinor − lineDiscountMinor
 *   subtotal      = Σ (quantity * unitPriceMinor)         (== Σ lineTotal + Σ lineDiscount)
 *   taxableBase   = subtotal − cartDiscount               (floored at 0 before tax)
 *   tax           = floor(taxableBase * taxRateBps / 10000)
 *   total         = taxableBase + tax                     (== subtotal − cartDiscount + tax)
 *   amountPaid    = Σ payment.amount
 *   outstanding   = max(0, total − amountPaid)
 *
 * Status:
 *   amountPaid == 0          → PENDING_PAYMENT
 *   0 < amountPaid < total   → PARTIALLY_PAID
 *   amountPaid >= total       → COMPLETED
 */
import type { SaleStatus } from '@prisma/client';

import { toMinor } from '../../utils/money.js';

// =====================================================
// Types
// =====================================================

/** Raw sale line item as it arrives on the wire (decimal strings for money). */
export interface SaleItemInput {
  productId: string;
  quantity: number;
  /** Decimal major string ("1250.50"). Falls back to product.sellingPriceMinor when omitted. */
  unitPrice?: string;
  /** Decimal major string — line-level discount. Defaults to 0. */
  discount?: string;
}

/** Raw payment as it arrives on the wire. */
export interface SalePaymentInput {
  method: 'CASH' | 'BANK_TRANSFER' | 'CARD_POS' | 'CUSTOMER_CREDIT' | 'OTHER';
  /** Decimal major string. */
  amount: string;
  reference?: string;
}

/**
 * A line item after pricing + cost capture. `unitCostMinor` is the WAC at the
 * moment of sale and is preserved verbatim on the SaleItem row so historical
 * COGS reporting stays accurate even if the product's WAC later changes
 * (PRD section 4.8).
 */
export interface ComputedSaleItem {
  productId: string;
  quantity: number;
  unitPriceMinor: bigint;
  unitCostMinor: bigint;
  discountMinor: bigint;
  totalMinor: bigint; // quantity * unitPriceMinor - discountMinor
  totalCostMinor: bigint; // quantity * unitCostMinor
}

export interface ComputedSaleTotals {
  items: ComputedSaleItem[];
  subtotalMinor: bigint;
  itemDiscountMinor: bigint;
  cartDiscountMinor: bigint;
  discountMinor: bigint; // itemDiscount + cartDiscount
  taxableBaseMinor: bigint;
  taxMinor: bigint;
  totalMinor: bigint;
  amountPaidMinor: bigint;
  outstandingMinor: bigint;
  status: SaleStatus;
}

// =====================================================
// Pure helpers
// =====================================================

/** Floor division for non-negative numerators. Returns 0n if divisor is 0. */
function floorDiv(a: bigint, b: bigint): bigint {
  if (b === 0n) return 0n;
  return a / b;
}

/**
 * Derive the sale status from amount-paid vs total. Exposed separately so
 * callers can recompute the status after a partial payment or refund.
 */
export function deriveSaleStatus(
  amountPaidMinor: bigint,
  totalMinor: bigint,
): SaleStatus {
  if (amountPaidMinor <= 0n) return 'PENDING_PAYMENT';
  if (amountPaidMinor >= totalMinor) return 'COMPLETED';
  return 'PARTIALLY_PAID';
}

/**
 * Compute the full sale totals from prepared line items (with cost already
 * captured), a cart-level discount (decimal string), the business tax rate in
 * basis points, and the raw payments array.
 */
export function computeSaleTotals(
  items: ComputedSaleItem[],
  opts: {
    cartDiscount?: string;
    taxRateBps: number;
    payments: SalePaymentInput[];
  },
): ComputedSaleTotals {
  let subtotalMinor = 0n;
  let itemDiscountMinor = 0n;
  for (const it of items) {
    subtotalMinor += BigInt(it.quantity) * it.unitPriceMinor;
    itemDiscountMinor += it.discountMinor;
  }

  const cartDiscountMinor = opts.cartDiscount ? toMinor(opts.cartDiscount) : 0n;
  const discountMinor = itemDiscountMinor + cartDiscountMinor;

  // Guard against an over-discount producing a negative taxable base.
  const taxableBaseMinor = subtotalMinor - cartDiscountMinor;
  const safeTaxableBase = taxableBaseMinor < 0n ? 0n : taxableBaseMinor;

  const taxMinor = floorDiv(
    safeTaxableBase * BigInt(opts.taxRateBps),
    10000n,
  );

  const totalMinor = taxableBaseMinor + taxMinor;

  let amountPaidMinor = 0n;
  for (const p of opts.payments) {
    amountPaidMinor += toMinor(p.amount);
  }

  const rawOutstanding = totalMinor - amountPaidMinor;
  const outstandingMinor = rawOutstanding < 0n ? 0n : rawOutstanding;

  const status = deriveSaleStatus(amountPaidMinor, totalMinor);

  return {
    items,
    subtotalMinor,
    itemDiscountMinor,
    cartDiscountMinor,
    discountMinor,
    taxableBaseMinor,
    taxMinor,
    totalMinor,
    amountPaidMinor,
    outstandingMinor,
    status,
  };
}

/**
 * Serialise a sale (and nested items/payments/refunds) so every BigInt field
 * becomes a JSON-safe string. Express cannot serialise BigInts directly.
 */
export function serializeSale(s: any) {
  return {
    ...s,
    subtotalMinor: s.subtotalMinor?.toString() ?? '0',
    discountMinor: s.discountMinor?.toString() ?? '0',
    taxMinor: s.taxMinor?.toString() ?? '0',
    totalMinor: s.totalMinor?.toString() ?? '0',
    amountPaidMinor: s.amountPaidMinor?.toString() ?? '0',
    outstandingMinor: s.outstandingMinor?.toString() ?? '0',
    items: (s.items ?? []).map((it: any) => ({
      ...it,
      unitPriceMinor: it.unitPriceMinor?.toString() ?? '0',
      unitCostMinor: it.unitCostMinor?.toString() ?? '0',
      discountMinor: it.discountMinor?.toString() ?? '0',
      totalMinor: it.totalMinor?.toString() ?? '0',
      totalCostMinor: it.totalCostMinor?.toString() ?? '0',
    })),
    payments: (s.payments ?? []).map((p: any) => ({
      ...p,
      amountMinor: p.amountMinor?.toString() ?? '0',
    })),
    refunds: (s.refunds ?? []).map((r: any) => ({
      ...r,
      amountMinor: r.amountMinor?.toString() ?? '0',
    })),
  };
}

/** Serialise a refund so its BigInt `amountMinor` becomes a string. */
export function serializeRefund(r: any) {
  return {
    ...r,
    amountMinor: r.amountMinor?.toString() ?? '0',
  };
}
