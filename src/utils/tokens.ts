import crypto from 'node:crypto';

/**
 * Hash a token (refresh / reset / invitation) before storing it.
 * Uses SHA-256 — tokens are high-entropy so this is sufficient.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Generate a random opaque token (URL-safe). */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Generate a short numeric OTP (e.g. for phone verification). */
export function generateOtp(length = 6): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  return String(crypto.randomInt(min, max + 1));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
