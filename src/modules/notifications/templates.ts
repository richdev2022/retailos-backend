/**
 * Email + SMS templates.
 *
 * Every email:
 *   1. Is recorded in the `email_logs` table (audit trail).
 *   2. Is sent via Brevo's REST API when `BREVO_ENABLED=true` + `BREVO_API_KEY` is set.
 *   3. When Brevo is disabled, emails are stored with status=QUEUED and a debug
 *      log is emitted — useful for local dev and demo.
 *
 * Templates in use:
 *   - signup.welcome              (sent after first successful login)
 *   - signup.otp.email             (6-digit OTP for email verification)
 *   - signup.otp.sms               (6-digit OTP for phone verification)
 *   - login.alert                 (security alert on every login)
 *   - login.admin.alert           (admin login alert)
 *   - password.reset               (password reset link)
 *   - password.reset.success      (password changed confirmation)
 *   - subscription.charge.success (recurring charge succeeded)
 *   - subscription.charge.failed  (recurring charge failed — user asked to update card)
 *   - subscription.card.added     (new card tokenized)
 *   - subscription.card.removed   (card removed)
 *   - subscription.trial.ending   (3 days before trial ends — TODO)
 *
 * HTML emails use a shared RetailOS-branded layout (gradient header + clean body).
 */
import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';
import * as brevo from '../brevo/client.js';
import type { OtpPurpose } from '@prisma/client';

// =====================================================
// Core: write to email_logs + dispatch via Brevo (or queue)
// =====================================================

interface SendEmailInput {
  to: string;
  userId?: string;
  businessId?: string;
  subject: string;
  html: string;
  text?: string;
  template?: string;
  tags?: string[];
}

async function sendEmailAndLog(input: SendEmailInput): Promise<{ logId: string; status: 'SENT' | 'QUEUED' | 'FAILED'; brevoMessageId?: string }> {
  // Create a queued EmailLog row first
  const log = await prisma.emailLog.create({
    data: {
      to: input.to,
      userId: input.userId ?? null,
      businessId: input.businessId ?? null,
      from: `${config.brevo.senderName} <${config.brevo.senderEmail}>`,
      subject: input.subject,
      body: input.html,
      template: input.template ?? null,
      status: 'QUEUED',
    },
  });

  if (!config.brevo.enabled || !config.brevo.apiKey) {
    console.log(`[email:queued] ${log.id} to=${input.to} subject="${input.subject}" template=${input.template ?? '-'}`);
    return { logId: log.id, status: 'QUEUED' };
  }

  try {
    const result = await brevo.sendEmail({
      to: [{ email: input.to }],
      sender: { email: config.brevo.senderEmail, name: config.brevo.senderName },
      replyTo: { email: config.brevo.replyToEmail },
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
      tags: input.tags ?? [input.template ?? 'transactional'].filter(Boolean) as string[],
    });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
    });
    console.log(`[email:sent] ${log.id} to=${input.to} messageId=${result.messageId}`);
    return { logId: log.id, status: 'SENT', brevoMessageId: result.messageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: errorMessage.slice(0, 1000), attempts: { increment: 1 } },
    });
    console.error(`[email:failed] ${log.id} to=${input.to} error=${errorMessage}`);
    return { logId: log.id, status: 'FAILED' };
  }
}

interface SendSmsInput {
  to: string;
  content: string;
  userId?: string;
  businessId?: string;
  template?: string;
}

async function sendSmsAndLog(input: SendSmsInput): Promise<{ status: 'SENT' | 'QUEUED' | 'FAILED'; brevoReference?: string }> {
  // We log SMS messages in the same email_logs table (they share the same audit pattern).
  const log = await prisma.emailLog.create({
    data: {
      to: input.to,
      userId: input.userId ?? null,
      businessId: input.businessId ?? null,
      from: config.brevo.smsSender,
      subject: `[SMS] ${input.template ?? 'notification'}`,
      body: input.content,
      template: input.template ?? null,
      status: 'QUEUED',
    },
  });

  if (!config.brevo.enabled || !config.brevo.apiKey) {
    console.log(`[sms:queued] ${log.id} to=${input.to} content="${input.content}"`);
    return { status: 'QUEUED' };
  }

  try {
    const result = await brevo.sendSms({
      recipient: input.to,
      content: input.content,
      tag: input.template,
    });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
    });
    console.log(`[sms:sent] ${log.id} to=${input.to} ref=${result.reference}`);
    return { status: 'SENT', brevoReference: result.reference };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'FAILED', error: errorMessage.slice(0, 1000), attempts: { increment: 1 } },
    });
    console.error(`[sms:failed] ${log.id} to=${input.to} error=${errorMessage}`);
    return { status: 'FAILED' };
  }
}

// =====================================================
// HTML email layout helpers
// =====================================================

function emailLayout(opts: { title: string; headerColor: string; body: string }): string {
  const { title, headerColor, body } = opts;
  return `
<div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <div style="background:${headerColor};color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center">
    <h1 style="margin:0;font-size:22px">${title}</h1>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px;background:#fff">
    ${body}
  </div>
  <p style="margin-top:16px;font-size:11px;color:#9ca3af;text-align:center">
    RetailOS &mdash; run your retail business from one place.<br>
    You're receiving this email because you have an account at <a href="${config.urls.website}" style="color:#6b7280">retailos.com</a>.
  </p>
</div>
`;
}

function formatMoneyMinor(minor: bigint, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '\u20A6', USD: '$', GHS: '\u20B5', KES: 'KSh' };
  const symbol = symbols[currency] ?? currency + ' ';
  const major = Number(minor) / 100;
  return `${symbol}${major.toLocaleString('en-NG', { minimumFractionDigits: major % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-NG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// =====================================================
// OTP email templates
// =====================================================

export async function sendOtpEmail(opts: {
  to: string;
  fullName: string;
  code: string;
  purpose: OtpPurpose;
  expirationMinutes: number;
  userId?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const purposeLabel: Record<OtpPurpose, string> = {
    SIGNUP_EMAIL_VERIFICATION: 'verify your email address',
    SIGNUP_PHONE_VERIFICATION: 'verify your phone number',
    LOGIN_VERIFICATION: 'complete your login',
    PASSWORD_RESET: 'reset your password',
    PHONE_CHANGE: 'verify your new phone number',
    EMAIL_CHANGE: 'verify your new email address',
    ADMIN_MFA: 'complete your admin login',
    STAFF_INVITATION: 'accept your staff invitation',
  };
  const action = purposeLabel[opts.purpose] ?? 'verify your identity';
  const subject = `Your RetailOS verification code: ${opts.code}`;
  const html = emailLayout({
    title: 'Verification code',
    headerColor: '#0F172A',
    body: `
      <p style="margin:0 0 16px;font-size:14px">Hello ${opts.fullName},</p>
      <p style="margin:0 0 24px;font-size:14px">
        Use the code below to ${action}. This code expires in ${opts.expirationMinutes} minutes.
      </p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#f1f5f9;border:2px solid #10B981;border-radius:8px;padding:16px 32px;font-family:'Courier New',monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0F172A">
          ${opts.code}
        </div>
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280">
        If you didn't request this code, you can safely ignore this email — no changes have been made to your account.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af">
        For your security, never share this code with anyone. RetailOS will never ask you for your verification code.
      </p>
    `,
  });
  await sendEmailAndLog({
    to: opts.to,
    userId: opts.userId,
    subject,
    html,
    text: `Your RetailOS verification code is ${opts.code}. It expires in ${opts.expirationMinutes} minutes. If you didn't request this, you can safely ignore this email.`,
    template: `otp.${opts.purpose.toLowerCase()}`,
    tags: ['otp', opts.purpose.toLowerCase()],
  });
}

export async function sendOtpSms(opts: {
  to: string;
  code: string;
  purpose: OtpPurpose;
  userId?: string;
  context?: Record<string, unknown>;
}): Promise<void> {
  const content = `RetailOS: Your verification code is ${opts.code}. It expires in 10 minutes. Don't share this code with anyone.`;
  await sendSmsAndLog({
    to: opts.to,
    content,
    userId: opts.userId,
    template: `otp.${opts.purpose.toLowerCase()}.sms`,
  });
}

// =====================================================
// Welcome email
// =====================================================

export async function sendWelcomeEmail(opts: { userId: string; email: string; fullName: string }): Promise<void> {
  const subject = `Welcome to RetailOS, ${opts.fullName.split(' ')[0]}!`;
  const html = emailLayout({
    title: 'Welcome to RetailOS',
    headerColor: '#10B981',
    body: `
      <p style="margin:0 0 16px;font-size:14px">Hello ${opts.fullName},</p>
      <p style="margin:0 0 16px;font-size:14px">
        Welcome to RetailOS — the all-in-one platform for running your retail business.
        You can now manage your inventory, process sales, track expenses, and grow your business from one place.
      </p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px;font-weight:600;color:#15803d;font-size:14px">Get started in 3 steps:</p>
        <ol style="margin:0;padding-left:20px;font-size:14px;color:#374151">
          <li style="margin-bottom:6px">Create your business profile</li>
          <li style="margin-bottom:6px">Add your first products and stock</li>
          <li>Make your first sale through the POS</li>
        </ol>
      </div>
      <div style="text-align:center;margin:24px 0">
        <a href="${config.urls.webapp}" style="background:#10B981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Open dashboard</a>
      </div>
      <p style="margin:0;font-size:12px;color:#6b7280">
        Questions? Reply to this email or visit our <a href="${config.urls.website}/#faq" style="color:#10B981">FAQ</a>.
      </p>
    `,
  });
  await sendEmailAndLog({
    to: opts.email,
    userId: opts.userId,
    subject,
    html,
    template: 'signup.welcome',
    tags: ['welcome', 'onboarding'],
  });
}

// =====================================================
// Login alert
// =====================================================

export async function sendLoginAlertEmail(opts: {
  userId: string;
  email: string;
  fullName: string;
  device?: string;
  location?: string;
  timestamp: Date;
}): Promise<void> {
  const subject = `New login to your RetailOS account`;
  const deviceStr = opts.device ?? 'Unknown device';
  const locationStr = opts.location ?? 'Unknown location';
  const html = emailLayout({
    title: 'New login detected',
    headerColor: '#0F172A',
    body: `
      <p style="margin:0 0 16px;font-size:14px">Hello ${opts.fullName},</p>
      <p style="margin:0 0 16px;font-size:14px">
        We detected a new login to your RetailOS account. If this was you, no action is needed.
        If you don't recognize this activity, please change your password immediately.
      </p>
      <table style="width:100%;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#6b7280">Device</td><td style="padding:6px 0;text-align:right;font-weight:600">${deviceStr}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Location</td><td style="padding:6px 0;text-align:right;font-weight:600">${locationStr}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Time</td><td style="padding:6px 0;text-align:right;font-weight:600">${formatDateTime(opts.timestamp)}</td></tr>
      </table>
      <div style="text-align:center;margin:24px 0">
        <a href="${config.urls.webapp}/settings/security" style="background:#0F172A;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Review security</a>
      </div>
      <p style="margin:0;font-size:12px;color:#6b7280">
        If this wasn't you, please <a href="${config.urls.webapp}/forgot-password" style="color:#10B981">reset your password</a> immediately and contact support.
      </p>
    `,
  });
  await sendEmailAndLog({
    to: opts.email,
    userId: opts.userId,
    subject,
    html,
    template: 'login.alert',
    tags: ['security', 'login-alert'],
  });
}

export async function sendAdminLoginAlertEmail(opts: {
  userId: string;
  email: string;
  fullName: string;
  device?: string;
  location?: string;
  timestamp: Date;
}): Promise<void> {
  const subject = `Admin login to RetailOS Platform`;
  const deviceStr = opts.device ?? 'Unknown device';
  const locationStr = opts.location ?? 'Unknown location';
  const html = emailLayout({
    title: 'Admin login detected',
    headerColor: '#7C3AED',
    body: `
      <p style="margin:0 0 16px;font-size:14px">Hello ${opts.fullName},</p>
      <p style="margin:0 0 16px;font-size:14px">
        An admin login to the RetailOS Platform occurred. As a security best practice, we're notifying you of all admin access.
      </p>
      <table style="width:100%;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#6b7280">Admin user</td><td style="padding:6px 0;text-align:right;font-weight:600">${opts.fullName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Email</td><td style="padding:6px 0;text-align:right;font-weight:600">${opts.email}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Device</td><td style="padding:6px 0;text-align:right;font-weight:600">${deviceStr}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Location</td><td style="padding:6px 0;text-align:right;font-weight:600">${locationStr}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Time</td><td style="padding:6px 0;text-align:right;font-weight:600">${formatDateTime(opts.timestamp)}</td></tr>
      </table>
      <p style="margin:0;font-size:12px;color:#6b7280">
        If you didn't initiate this login, contact the platform security team immediately and review the audit log at <a href="${config.urls.admin}/audit" style="color:#7C3AED">admin portal &rsaquo; audit logs</a>.
      </p>
    `,
  });
  await sendEmailAndLog({
    to: opts.email,
    userId: opts.userId,
    subject,
    html,
    template: 'login.admin.alert',
    tags: ['security', 'admin', 'login-alert'],
  });
}

// =====================================================
// Password reset
// =====================================================

export async function sendPasswordResetEmail(opts: {
  to: string;
  fullName: string;
  resetLink: string;
  userId: string;
}): Promise<void> {
  const subject = `Reset your RetailOS password`;
  const html = emailLayout({
    title: 'Password reset',
    headerColor: '#F59E0B',
    body: `
      <p style="margin:0 0 16px;font-size:14px">Hello ${opts.fullName},</p>
      <p style="margin:0 0 16px;font-size:14px">
        We received a request to reset the password for your RetailOS account.
        Click the button below to set a new password. This link expires in 30 minutes.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${opts.resetLink}" style="background:#F59E0B;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Reset password</a>
      </div>
      <p style="margin:0 0 16px;font-size:13px;color:#6b7280">
        Or copy and paste this link into your browser:<br>
        <a href="${opts.resetLink}" style="color:#F59E0B;word-break:break-all;font-size:12px">${opts.resetLink}</a>
      </p>
      <p style="margin:0;font-size:12px;color:#6b7280">
        If you didn't request a password reset, you can safely ignore this email — your password will not be changed.
      </p>
    `,
  });
  await sendEmailAndLog({
    to: opts.to,
    userId: opts.userId,
    subject,
    html,
    text: `Reset your RetailOS password: ${opts.resetLink} (expires in 30 minutes). If you didn't request this, you can safely ignore this email.`,
    template: 'password.reset',
    tags: ['password', 'reset'],
  });
}

export async function sendPasswordResetSuccessEmail(opts: {
  to: string;
  fullName: string;
  userId: string;
}): Promise<void> {
  const subject = `Your RetailOS password was changed`;
  const html = emailLayout({
    title: 'Password changed',
    headerColor: '#10B981',
    body: `
      <p style="margin:0 0 16px;font-size:14px">Hello ${opts.fullName},</p>
      <p style="margin:0 0 16px;font-size:14px">
        Your RetailOS password was successfully changed on ${formatDateTime(new Date())}.
        If you made this change, no further action is needed.
      </p>
      <p style="margin:0 0 16px;font-size:14px">
        If you did <strong>not</strong> change your password, your account may be compromised.
        Please reset your password immediately and contact support.
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="${config.urls.webapp}/settings/security" style="background:#10B981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Review security</a>
      </div>
    `,
  });
  await sendEmailAndLog({
    to: opts.to,
    userId: opts.userId,
    subject,
    html,
    template: 'password.reset.success',
    tags: ['password', 'security'],
  });
}

// =====================================================
// Subscription emails (re-exported for backward compat with payments module)
// =====================================================

import type { SubscriptionPlan, SavedCard, SubscriptionCharge } from '@prisma/client';

export async function sendChargeSuccessEmail(opts: {
  to: string;
  userId?: string;
  businessId: string;
  businessName: string;
  plan: SubscriptionPlan;
  charge: SubscriptionCharge;
  newEndDate?: Date | null;
}): Promise<void> {
  const { to, businessName, plan, charge, newEndDate } = opts;
  const subject = `Payment successful — ${plan.name} subscription renewed`;
  const html = emailLayout({
    title: 'Payment Successful',
    headerColor: '#10B981',
    body: `
      <p style="margin:0 0 16px;font-size:14px;text-align:center">Your ${plan.name} subscription has been renewed</p>
      <table style="width:100%;font-size:14px">
        <tr><td style="padding:8px 0;color:#6b7280">Business</td><td style="padding:8px 0;text-align:right;font-weight:600">${businessName}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Plan</td><td style="padding:8px 0;text-align:right;font-weight:600">${plan.name}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Amount</td><td style="padding:8px 0;text-align:right;font-weight:600">${formatMoneyMinor(charge.amountMinor, charge.currency)}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Reference</td><td style="padding:8px 0;text-align:right;font-family:monospace;font-size:12px">${charge.txRef}</td></tr>
        <tr><td style="padding:8px 0;color:#6b7280">Date</td><td style="padding:8px 0;text-align:right">${formatDate(charge.attemptedAt)}</td></tr>
        ${newEndDate ? `<tr><td style="padding:8px 0;color:#6b7280">Renewed until</td><td style="padding:8px 0;text-align:right;font-weight:600">${formatDate(newEndDate)}</td></tr>` : ''}
      </table>
      <p style="margin-top:20px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
        A receipt for this transaction has been recorded in your RetailOS account under Subscription &rsaquo; History.
      </p>
    `,
  });
  await sendEmailAndLog({
    to,
    userId: opts.userId,
    businessId: opts.businessId,
    subject,
    html,
    template: 'subscription.charge.success',
    tags: ['subscription', 'payment', 'success'],
  });
}

export async function sendChargeFailedEmail(opts: {
  to: string;
  userId?: string;
  businessId: string;
  businessName: string;
  plan: SubscriptionPlan;
  charge: SubscriptionCharge;
  updateCardUrl: string;
}): Promise<void> {
  const { to, businessName, plan, charge, updateCardUrl } = opts;
  const subject = `Action needed — ${plan.name} subscription payment failed`;
  const html = emailLayout({
    title: 'Payment Failed',
    headerColor: '#EF4444',
    body: `
      <p style="margin:0 0 16px;font-size:14px;text-align:center">Please update your card to keep your ${plan.name} subscription active</p>
      <p style="margin:0 0 16px;font-size:14px">Hello,</p>
      <p style="margin:0 0 16px;font-size:14px">
        We attempted to charge your card for your <strong>${plan.name}</strong> subscription renewal but the payment was declined.
        This usually happens when the card has expired, has insufficient funds, or has been blocked by your bank.
      </p>
      <table style="width:100%;font-size:14px;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#6b7280">Business</td><td style="padding:6px 0;text-align:right;font-weight:600">${businessName}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Amount</td><td style="padding:6px 0;text-align:right;font-weight:600">${formatMoneyMinor(charge.amountMinor, charge.currency)}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Reference</td><td style="padding:6px 0;text-align:right;font-family:monospace;font-size:12px">${charge.txRef}</td></tr>
        ${charge.failureReason ? `<tr><td style="padding:6px 0;color:#6b7280">Reason</td><td style="padding:6px 0;text-align:right">${charge.failureReason}</td></tr>` : ''}
      </table>
      <div style="text-align:center;margin:24px 0">
        <a href="${updateCardUrl}" style="background:#10B981;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block">Update card</a>
      </div>
      <p style="margin:0;font-size:12px;color:#6b7280">
        We'll automatically retry the charge once. If it fails again, your subscription will enter a 7-day grace period.
        Update your card now to avoid any interruption.
      </p>
    `,
  });
  await sendEmailAndLog({
    to,
    userId: opts.userId,
    businessId: opts.businessId,
    subject,
    html,
    template: 'subscription.charge.failed',
    tags: ['subscription', 'payment', 'failed'],
  });
}

export async function sendCardAddedEmail(opts: {
  to: string;
  userId?: string;
  businessId: string;
  businessName: string;
  card: SavedCard;
}): Promise<void> {
  const { to, businessName, card } = opts;
  const subject = `New card added — ${card.brand} ending ${card.last4}`;
  const html = emailLayout({
    title: 'Card Added Successfully',
    headerColor: '#0F172A',
    body: `
      <p style="margin:0 0 16px;font-size:14px">A new card has been added to <strong>${businessName}</strong> for subscription payments:</p>
      <div style="background:#f9fafb;padding:16px;border-radius:6px;margin-bottom:16px;font-size:14px">
        <strong>${card.brand}</strong> ending <strong>${card.last4}</strong>${card.expiry ? ` &middot; expires ${card.expiry}` : ''}
      </div>
      ${card.isDefault ? '<p style="margin:0;font-size:14px">This card has been set as your default payment method.</p>' : '<p style="margin:0;font-size:14px">You can set this card as default from Subscription &rsaquo; Payment Methods.</p>'}
    `,
  });
  await sendEmailAndLog({
    to,
    userId: opts.userId,
    businessId: opts.businessId,
    subject,
    html,
    template: 'subscription.card.added',
    tags: ['subscription', 'card'],
  });
}

export async function sendCardRemovedEmail(opts: {
  to: string;
  userId?: string;
  businessId: string;
  businessName: string;
  brand: string;
  last4: string;
}): Promise<void> {
  const { to, businessName, brand, last4 } = opts;
  const subject = `Card removed — ${brand} ending ${last4}`;
  const html = emailLayout({
    title: 'Card Removed',
    headerColor: '#0F172A',
    body: `
      <p style="margin:0;font-size:14px">
        The card <strong>${brand}</strong> ending <strong>${last4}</strong> has been removed from <strong>${businessName}</strong>.
        If you did not make this change, please contact support immediately.
      </p>
    `,
  });
  await sendEmailAndLog({
    to,
    userId: opts.userId,
    businessId: opts.businessId,
    subject,
    html,
    template: 'subscription.card.removed',
    tags: ['subscription', 'card'],
  });
}

/**
 * Helper: get the recipient email for a business (the owner).
 */
export async function getBusinessOwnerEmail(businessId: string): Promise<{ email: string; userId: string } | null> {
  const biz = await prisma.business.findUnique({
    where: { id: businessId },
    include: { owner: { select: { id: true, email: true, fullName: true } } },
  });
  if (!biz || !biz.owner.email) return null;
  return { email: biz.owner.email, userId: biz.owner.id };
}
