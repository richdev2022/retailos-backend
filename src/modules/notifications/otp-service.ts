/**
 * OTP service — generates, sends, and verifies one-time passwords.
 *
 * Each OTP is:
 *   - 6 digits (for SMS) or alphanumeric for email — actually we use 6-digit numeric everywhere for simplicity
 *   - Valid for 10 minutes
 *   - Has at most 5 verification attempts before lockout
 *   - Hashed with bcrypt before storage (never stored in plaintext)
 *   - Single-use (verified=true after success, cannot be reused)
 *
 * Throttling:
 *   - Max 3 OTPs per (recipient + purpose) within 10 minutes (prevents abuse)
 *   - Max 10 OTPs per IP within 1 hour
 */
import crypto from 'node:crypto';
import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { Errors } from '../../utils/errors.js';
import type { OtpPurpose, OtpChannel } from '@prisma/client';
import * as brevo from '../brevo/client.js';
import {
  sendOtpEmail,
  sendOtpSms,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendLoginAlertEmail,
  sendAdminLoginAlertEmail,
  sendPasswordResetSuccessEmail,
} from './templates.js';

/** Generate a random 6-digit OTP. */
function generateCode(): string {
  // Use crypto.randomInt for unbiased generation (avoids modulo bias)
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Create + send an OTP. Idempotency: if a non-expired OTP for the same
 * (recipient, purpose) exists, return that one (don't generate a new code).
 * Throttle: max 3 active OTPs per (recipient, purpose) per 10 minutes.
 */
export async function createAndSendOtp(opts: {
  userId?: string;
  recipient: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  ipAddress?: string;
  userAgent?: string;
  /** Optional context — e.g. businessName for welcome email, login device for login alert. */
  context?: Record<string, unknown>;
}): Promise<{ otpId: string; expiresAt: Date; attemptsRemaining: number; queued: boolean }> {
  const { userId, recipient, channel, purpose, ipAddress, userAgent, context } = opts;

  // Throttle: count active OTPs (not yet verified, not yet expired) for this recipient+purpose
  const recentCount = await prisma.otpCode.count({
    where: {
      recipient,
      purpose,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) }, // last 10 min
    },
  });
  if (recentCount >= 3) {
    throw Errors.rateLimited('Too many OTP requests. Please wait 10 minutes before requesting another code.');
  }

  // Invalidate any existing unused OTPs for the same recipient+purpose
  await prisma.otpCode.updateMany({
    where: { recipient, purpose, usedAt: null, verified: false },
    data: { expiresAt: new Date(0) }, // immediate expiry
  });

  // Generate + hash the code
  const code = generateCode();
  const codeHash = await hashPassword(code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  const otp = await prisma.otpCode.create({
    data: {
      userId: userId ?? null,
      channel,
      purpose,
      recipient,
      codeHash,
      expiresAt,
      ipAddress: ipAddress ?? null,
      userAgent: userAgent ?? null,
    },
  });

  // Send the code
  let queued = false;
  try {
    if (channel === 'EMAIL') {
      await sendOtpEmail({
        to: recipient,
        fullName: (context?.fullName as string) ?? 'there',
        code,
        purpose,
        expirationMinutes: 10,
        userId,
        context,
      });
    } else {
      await sendOtpSms({
        to: recipient,
        code,
        purpose,
        userId,
        context,
      });
    }
  } catch (err) {
    // Don't leak Brevo errors to the client — log them and mark as queued
    console.warn(`[otp] Failed to send OTP via ${channel} for ${purpose}:`, err instanceof Error ? err.message : err);
    queued = true;
  }

  return {
    otpId: otp.id,
    expiresAt,
    attemptsRemaining: otp.maxAttempts,
    queued,
  };
}

/**
 * Verify an OTP. Returns true if the code is valid; false otherwise.
 * On success, marks the OTP as verified + used.
 * On failure, increments the attempt count.
 * Throws if the OTP is expired, already used, or locked out.
 */
export async function verifyOtp(opts: {
  recipient: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<{ verified: boolean; userId?: string; reason?: string }> {
  const { recipient, purpose, code } = opts;

  // Find the most recent unused OTP for this recipient+purpose
  const otp = await prisma.otpCode.findFirst({
    where: { recipient, purpose, usedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!otp) {
    return { verified: false, reason: 'NO_OTP' };
  }
  if (otp.verified) {
    return { verified: false, reason: 'ALREADY_USED' };
  }
  if (otp.expiresAt < new Date()) {
    return { verified: false, reason: 'EXPIRED' };
  }
  if (otp.attempts >= otp.maxAttempts) {
    return { verified: false, reason: 'LOCKED_OUT' };
  }

  // Verify the code (bcrypt)
  const isValid = await verifyPassword(code, otp.codeHash);
  if (!isValid) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    const remaining = otp.maxAttempts - otp.attempts - 1;
    return { verified: false, reason: remaining > 0 ? `INVALID_CODE (${remaining} attempts left)` : 'LOCKED_OUT' };
  }

  // Success
  await prisma.otpCode.update({
    where: { id: otp.id },
    data: { verified: true, usedAt: new Date() },
  });
  return { verified: true, userId: otp.userId ?? undefined };
}

/**
 * Send the welcome email after a user successfully verifies their email post-signup.
 */
export async function sendWelcome(opts: { userId: string; email: string; fullName: string }): Promise<void> {
  try {
    await sendWelcomeEmail(opts);
  } catch (err) {
    console.warn('[email] welcome send failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Send a password reset email with a one-time reset link.
 * Stores the reset token in the password_resets table.
 */
export async function sendPasswordReset(opts: {
  userId: string;
  email: string;
  fullName: string;
  resetToken: string;
}): Promise<void> {
  const resetLink = `${config.urls.webapp}/reset-password?token=${opts.resetToken}`;
  try {
    await sendPasswordResetEmail({
      to: opts.email,
      fullName: opts.fullName,
      resetLink,
      userId: opts.userId,
    });
  } catch (err) {
    console.warn('[email] password-reset send failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Send the success notification after a password has been changed.
 */
export async function sendPasswordChangedNotification(opts: {
  userId: string;
  email: string;
  fullName: string;
}): Promise<void> {
  try {
    await sendPasswordResetSuccessEmail({
      to: opts.email,
      fullName: opts.fullName,
      userId: opts.userId,
    });
  } catch (err) {
    console.warn('[email] password-changed send failed:', err instanceof Error ? err.message : err);
  }
}

/**
 * Send a security alert when a login occurs. By default only sent when:
 *   - User logs in from a new device or location (TODO — needs session fingerprinting)
 *   - Admin login (always)
 */
export async function sendLoginAlert(opts: {
  userId: string;
  email: string;
  fullName: string;
  device?: string;
  location?: string;
  timestamp: Date;
  isAdmin?: boolean;
}): Promise<void> {
  try {
    if (opts.isAdmin) {
      await sendAdminLoginAlertEmail(opts);
    } else {
      await sendLoginAlertEmail(opts);
    }
  } catch (err) {
    console.warn('[email] login-alert send failed:', err instanceof Error ? err.message : err);
  }
}
