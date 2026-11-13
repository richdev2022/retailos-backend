import { ulid } from 'ulid';

/** Generate a short human-readable reference, e.g. RCP-01J8X9K3P0. */
export function ref(prefix: string): string {
  return `${prefix}-${ulid()}`;
}

/** Generate a receipt number. */
export function receiptNo(): string {
  return `RCP-${ulid()}`;
}

/** Generate a purchase order reference. */
export function purchaseRef(): string {
  return `PO-${ulid()}`;
}

/** Generate a refund reference. */
export function refundRef(): string {
  return `REF-${ulid()}`;
}

/** Generate a transfer reference. */
export function transferRef(): string {
  return `TRF-${ulid()}`;
}

/** Generate a payment submission reference. */
export function paymentSubmissionRef(): string {
  return `PS-${ulid()}`;
}
