/**
 * Money helpers. The system stores money as integer minor units
 * (e.g. kobo for NGN, cent for USD). NEVER use floating-point for storage.
 *
 * Conversion: 1 NGN = 100 kobo. ₦1,250.50 = 125050 minor units.
 */

export function toMinor(amountMajor: number | string): bigint {
  // Accept decimal input ("1250.50" or 1250.5) and convert to minor units
  const str = typeof amountMajor === 'number' ? amountMajor.toFixed(2) : String(amountMajor).trim();
  const neg = str.startsWith('-');
  const cleaned = neg ? str.slice(1) : str;
  const [whole, frac = '00'] = cleaned.split('.');
  const fracPadded = (frac + '00').slice(0, 2);
  const minor = BigInt(whole) * 100n + BigInt(fracPadded);
  return neg ? -minor : minor;
}

export function toMajor(amountMinor: bigint | number): number {
  const m = BigInt(amountMinor);
  const neg = m < 0n;
  const abs = neg ? -m : m;
  const whole = Number(abs / 100n);
  const frac = Number(abs % 100n);
  const val = whole + frac / 100;
  return neg ? -val : val;
}

export function formatMajor(amountMinor: bigint | number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(toMajor(amountMinor));
}

export function addMinor(...amounts: Array<bigint | number>): bigint {
  return amounts.reduce((acc: bigint, n) => acc + BigInt(n), 0n);
}

export function subMinor(a: bigint | number, b: bigint | number): bigint {
  return BigInt(a) - BigInt(b);
}

export function mulMinor(qty: number | bigint, unitMinor: bigint | number): bigint {
  return BigInt(qty) * BigInt(unitMinor);
}

/**
 * Compute Weighted Average Cost after a stock-in.
 * @param currentQty    Existing quantity on hand
 * @param currentWacMinor Existing WAC (per unit, minor units)
 * @param inQty         New quantity received
 * @param inUnitCostMinor New per-unit cost (minor units)
 * @returns new per-unit WAC (minor units), rounded down to nearest minor unit.
 */
export function computeWac(
  currentQty: number,
  currentWacMinor: bigint,
  inQty: number,
  inUnitCostMinor: bigint,
): bigint {
  if (currentQty + inQty === 0) return 0n;
  const totalCost =
    BigInt(currentQty) * currentWacMinor + BigInt(inQty) * inUnitCostMinor;
  const wac = totalCost / BigInt(currentQty + inQty);
  return wac < 0n ? 0n : wac;
}
