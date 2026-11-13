/**
 * Email service.
 *
 * - Records every email attempt in the `email_logs` table (audit trail).
 * - Sends via nodemailer when `EMAIL_ENABLED=true` and `SMTP_URL` is set.
 * - When SMTP is disabled, emails are stored with status=QUEUED and a debug
 *   log is emitted — useful for local dev and demo without an SMTP provider.
 *
 * Templates in use:
 *   - subscription.charge.success   (recurring charge succeeded)
 *   - subscription.charge.failed    (recurring charge failed — user asked to update card)
 *   - subscription.card.added       (new card tokenized)
 *   - subscription.card.removed     (card removed)
 *   - subscription.renewed         (subscription extended)
 *   - subscription.cancelled        (subscription cancelled)
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';
import type { SubscriptionPlan, SavedCard, SubscriptionCharge } from '@prisma/client';

let _transporter: Transporter | null = null;
function getTransporter(): Transporter | null {
  if (!config.email.enabled || !config.email.smtpUrl) return null;
  if (_transporter) return _transporter;
  _transporter = nodemailer.createTransport(config.email.smtpUrl);
  return _transporter;
}

export interface SendEmailInput {
  to: string;
  userId?: string;
  businessId?: string;
  subject: string;
  body: string;
  template?: string;
}

/**
 * Send an email and record the result in `email_logs`.
 * Safe to call from inside a transaction or a fire-and-forget handler.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ logId: string; status: 'SENT' | 'QUEUED' | 'FAILED' }> {
  const log = await prisma.emailLog.create({
    data: {
      to: input.to,
      userId: input.userId ?? null,
      businessId: input.businessId ?? null,
      from: config.email.fromAddress,
      subject: input.subject,
      body: input.body,
      template: input.template ?? null,
      status: 'QUEUED',
    },
  });

  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[email:queued] ${log.id} to=${input.to} subject="${input.subject}" template=${input.template ?? '-'}`);
    return { logId: log.id, status: 'QUEUED' };
  }

  try {
    const info = await transporter.sendMail({
      from: config.email.fromAddress,
      to: input.to,
      subject: input.subject,
      html: input.body,
      replyTo: config.email.replyTo,
    });
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: 'SENT', sentAt: new Date(), attempts: { increment: 1 } },
    });
    console.log(`[email:sent] ${log.id} to=${input.to} messageId=${info.messageId}`);
    return { logId: log.id, status: 'SENT' };
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

// =====================================================
// Templated emails (HTML body is built server-side)
// =====================================================

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
  const body = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#10B981;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:22px">Payment Successful</h1>
        <p style="margin:6px 0 0;font-size:14px;opacity:0.95">Your ${plan.name} subscription has been renewed</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">
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
      </div>
      <p style="margin-top:16px;font-size:11px;color:#9ca3af;text-align:center">RetailOS &mdash; run your retail business from one place.</p>
    </div>
  `;
  await sendEmail({ to, userId: opts.userId, businessId: opts.businessId, subject, body, template: 'subscription.charge.success' });
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
  const body = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#EF4444;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center">
        <h1 style="margin:0;font-size:22px">Payment Failed</h1>
        <p style="margin:6px 0 0;font-size:14px;opacity:0.95">Please update your card to keep your ${plan.name} subscription active</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">
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
      </div>
      <p style="margin-top:16px;font-size:11px;color:#9ca3af;text-align:center">RetailOS &mdash; run your retail business from one place.</p>
    </div>
  `;
  await sendEmail({ to, userId: opts.userId, businessId: opts.businessId, subject, body, template: 'subscription.charge.failed' });
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
  const body = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#0F172A;color:#fff;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Card Added Successfully</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0 0 16px;font-size:14px">
          A new card has been added to <strong>${businessName}</strong> for subscription payments:
        </p>
        <div style="background:#f9fafb;padding:16px;border-radius:6px;margin-bottom:16px;font-size:14px">
          <strong>${card.brand}</strong> ending <strong>${card.last4}</strong>${card.expiry ? ` &middot; expires ${card.expiry}` : ''}
        </div>
        ${card.isDefault ? '<p style="margin:0;font-size:14px">This card has been set as your default payment method.</p>' : '<p style="margin:0;font-size:14px">You can set this card as default from Subscription &rsaquo; Payment Methods.</p>'}
      </div>
      <p style="margin-top:16px;font-size:11px;color:#9ca3af;text-align:center">RetailOS &mdash; run your retail business from one place.</p>
    </div>
  `;
  await sendEmail({ to, userId: opts.userId, businessId: opts.businessId, subject, body, template: 'subscription.card.added' });
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
  const body = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#0F172A;color:#fff;padding:20px;border-radius:8px 8px 0 0">
        <h1 style="margin:0;font-size:20px">Card Removed</h1>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:0;padding:24px;border-radius:0 0 8px 8px">
        <p style="margin:0;font-size:14px">
          The card <strong>${brand}</strong> ending <strong>${last4}</strong> has been removed from <strong>${businessName}</strong>.
          If you did not make this change, please contact support immediately.
        </p>
      </div>
      <p style="margin-top:16px;font-size:11px;color:#9ca3af;text-align:center">RetailOS &mdash; run your retail business from one place.</p>
    </div>
  `;
  await sendEmail({ to, userId: opts.userId, businessId: opts.businessId, subject, body, template: 'subscription.card.removed' });
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
