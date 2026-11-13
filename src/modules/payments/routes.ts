/**
 * Payment methods + subscription charge routes.
 *
 * Endpoints (all under /api/v1):
 *
 *   GET    /payments/cards                 — list saved cards for the active business
 *   POST   /payments/cards                — tokenize + save a new card
 *   DELETE /payments/cards/:id             — remove a card (only allowed if business has >1 card OR no subscription)
 *   POST   /payments/cards/:id/default     — set a card as default
 *
 *   POST   /payments/charge                — charge the default card (or specified cardId) for a subscription renewal
 *   GET    /payments/charges                — list all charges (subscription history)
 *   GET    /payments/charges/:id           — get a single charge detail
 *   POST   /payments/charges/:id/retry     — retry a failed charge
 *
 *   GET    /payments/events                 — list subscription events (audit history)
 *
 *   GET    /payments/public-key            — get the Flutterwave public key (used by the webapp for inline SDK)
 *
 * All endpoints require authentication + business scope. The business owner or
 * a user with `subscription:manage` permission may call these.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';
import { authMiddleware, requirePermission } from '../../middleware/auth.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { Errors, asyncHandler, sendSuccess, sendError } from '../../utils/errors.js';
import * as flw from './flutterwave.js';
import {
  sendChargeSuccessEmail,
  sendChargeFailedEmail,
  sendCardAddedEmail,
  sendCardRemovedEmail,
  getBusinessOwnerEmail,
} from '../email/service.js';

export const paymentRouter = Router();
paymentRouter.use(authMiddleware);
paymentRouter.use(requirePermission('subscription:manage'));

// =====================================================
// Helper: get the current (latest) subscription for a business
// =====================================================

async function getCurrentSubscription(businessId: string) {
  return prisma.subscription.findFirst({
    where: { businessId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function getDefaultCard(businessId: string) {
  return prisma.savedCard.findFirst({
    where: { businessId, isActive: true, isDefault: true },
  });
}

async function extendSubscription(businessId: string, planId: string, amountMinor: bigint, interval: 'monthly' | 'annual'): Promise<{ subscriptionId: string; newEndDate: Date }> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw Errors.notFound('Plan not found');

  // 30 or 365 days
  const days = interval === 'annual' ? 365 : 30;
  const sub = await getCurrentSubscription(businessId);
  const now = new Date();
  // If existing subscription still active, extend from its end date; else from now
  const baseDate = sub?.endDate && sub.endDate > now ? sub.endDate : now;
  const newEndDate = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

  if (sub) {
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        planId,
        status: 'ACTIVE',
        endDate: newEndDate,
        graceEndsAt: null,
        cancelledAt: null,
        updatedAt: now,
      },
    });
    return { subscriptionId: updated.id, newEndDate };
  }
  const created = await prisma.subscription.create({
    data: {
      businessId,
      planId,
      status: 'ACTIVE',
      startDate: now,
      endDate: newEndDate,
      trialEndsAt: null,
    },
  });
  return { subscriptionId: created.id, newEndDate };
}

// =====================================================
// Public key (used by the webapp inline SDK)
// =====================================================

paymentRouter.get('/public-key', asyncHandler(async (req: Request, res: Response) => {
  if (!config.flutterwave.enabled) {
    return sendError(res, Errors.serviceUnavailable('Flutterwave is not enabled. Set FLW_ENABLED=true to enable card payments.', 'FLW_DISABLED'));
  }
  return sendSuccess(res, { publicKey: config.flutterwave.publicKey, title: config.flutterwave.title, logoUrl: config.flutterwave.logoUrl }, 'Flutterwave public key');
}));

// =====================================================
// List saved cards
// =====================================================

paymentRouter.get('/cards', asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.activeBusinessId!;
  const cards = await prisma.savedCard.findMany({
    where: { businessId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  // Don't expose the token itself — only the masked card metadata
  const safe = cards.map((c) => ({
    id: c.id,
    brand: c.brand,
    last4: c.last4,
    first6: c.first6,
    issuer: c.issuer,
    country: c.country,
    cardType: c.cardType,
    expiry: c.expiry,
    isDefault: c.isDefault,
    isActive: c.isActive,
    lastUsedAt: c.lastUsedAt,
    createdAt: c.createdAt,
  }));
  return sendSuccess(res, safe, 'Saved cards');
}));

// =====================================================
// Add a new card (tokenize + first verification charge)
// =====================================================

const AddCardSchema = z.object({
  cardNumber: z.string().min(12).max(19),
  cvv: z.string().min(3).max(4),
  expiryMonth: z.string().regex(/^\d{2}$/),
  expiryYear: z.string().regex(/^\d{2}$/),
  pin: z.string().regex(/^\d{4}$/).optional(),
  billingAddress: z
    .object({
      city: z.string().optional(),
      address: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zipcode: z.string().optional(),
    })
    .optional(),
});

paymentRouter.post('/cards', validateBody(AddCardSchema), asyncHandler(async (req: Request, res: Response) => {
  if (!config.flutterwave.enabled) {
    return sendError(res, Errors.serviceUnavailable('Flutterwave is not enabled. Set FLW_ENABLED=true to enable card payments.', 'FLW_DISABLED'));
  }
  const businessId = req.activeBusinessId!;
  const body = req.body as z.infer<typeof AddCardSchema>;

  // Look up the business owner email (Flutterwave requires the same email for token + future charges)
  const owner = await getBusinessOwnerEmail(businessId);
  if (!owner) {
    return sendError(res, Errors.badRequest('Business owner email is required for card tokenization', 'OWNER_EMAIL_MISSING'));
  }

  // 1. Charge the card for a small amount (100 NGN) to tokenize it.
  //    This is a common pattern: Flutterwave returns the card token after a successful charge.
  //    In production you'd refund this verification charge; for simplicity here we charge
  //    the actual subscription amount or a small verification fee of NGN 100.
  const verificationAmountMinor = 10000n; // NGN 100.00
  const txRef = flw.generateTxRef('CARD-ADD');
  const charge = await flw.chargeCardDirectly({
    cardNumber: body.cardNumber.replace(/\s/g, ''),
    cvv: body.cvv,
    expiryMonth: body.expiryMonth,
    expiryYear: body.expiryYear,
    amount: Number(verificationAmountMinor) / 100,
    currency: 'NGN',
    email: owner.email,
    firstName: undefined,
    lastName: undefined,
    txRef,
    narration: 'RetailOS card verification (NGN 100)',
    pin: body.pin,
    billingAddress: body.billingAddress,
  });

  if (charge.status === 'success' && charge.cardToken && charge.card) {
    // 2. Save the card with the token. If it's the first card, set it as default.
    const existingCount = await prisma.savedCard.count({ where: { businessId, isActive: true } });
    const isFirst = existingCount === 0;
    const savedCard = await prisma.savedCard.create({
      data: {
        businessId,
        token: charge.cardToken,
        emailUsed: owner.email,
        first6: charge.card.first6,
        last4: charge.card.last4,
        brand: charge.card.brand || 'CARD',
        issuer: charge.card.issuer ?? null,
        country: charge.card.country ?? null,
        cardType: charge.card.type ?? null,
        expiry: charge.card.expiry ?? null,
        isDefault: isFirst,
        lastUsedAt: new Date(),
        isActive: true,
      },
    });
    // 3. Record a subscription event
    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        type: 'CARD_ADDED',
        description: `Added ${savedCard.brand} card ending ${savedCard.last4}`,
        cardId: savedCard.id,
      },
    });
    // 4. Email the owner that the card was added
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    await sendCardAddedEmail({
      to: owner.email,
      userId: owner.userId,
      businessId,
      businessName: biz?.name ?? 'your business',
      card: savedCard,
    });

    // Refund the verification charge (best-effort, fail silently)
    if (charge.flwTransactionId) {
      flw.refundCharge(charge.flwTransactionId, Number(verificationAmountMinor)).catch(() => {});
    }

    return sendSuccess(res, {
      id: savedCard.id,
      brand: savedCard.brand,
      last4: savedCard.last4,
      first6: savedCard.first6,
      issuer: savedCard.issuer,
      expiry: savedCard.expiry,
      isDefault: savedCard.isDefault,
      createdAt: savedCard.createdAt,
    }, 'Card added');
  }

  if (charge.status === 'pending_otp' || charge.status === 'pending_3ds') {
    // Return the OTP/3DS challenge to the client so they can complete it
    return sendSuccess(res, {
      status: charge.status,
      flwRef: charge.flwRef,
      flwTransactionId: charge.flwTransactionId,
      authUrl: charge.authUrl,
      txRef: charge.txRef,
      chargeResponseMessage: charge.chargeResponseMessage,
    }, 'Card requires OTP/3DS verification', 202);
  }

  return sendError(res, Errors.badRequest(charge.chargeResponseMessage ?? 'Card verification failed', 'CARD_VERIFY_FAILED'));
}));

// =====================================================
// Remove a card
// =====================================================

paymentRouter.delete('/cards/:id', validateParams(z.object({ id: z.string().uuid() })), asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.activeBusinessId!;
  const { id } = req.params as { id: string };
  const card = await prisma.savedCard.findFirst({ where: { id, businessId } });
  if (!card) return sendError(res, Errors.notFound('Card not found'));

  const activeCount = await prisma.savedCard.count({ where: { businessId, isActive: true } });
  // If the card is the only active card AND there is an ACTIVE/TRIAL subscription, we still allow deletion
  // but warn that the subscription will fail to renew.
  const sub = await getCurrentSubscription(businessId);
  if (activeCount === 1 && sub && sub.status !== 'CANCELLED' && sub.status !== 'EXPIRED') {
    // Soft-block: client can override with ?force=true
    if (req.query.force !== 'true') {
      return res.status(409).json({
        success: false,
        message: 'This is your only saved card. Removing it will prevent your subscription from renewing. Pass ?force=true to confirm.',
        code: 'ONLY_CARD_WITH_SUBSCRIPTION',
        errors: [],
      });
    }
  }

  // Mark as inactive (soft delete) — preserves audit history
  await prisma.savedCard.update({ where: { id }, data: { isActive: false, isDefault: false } });
  // If this was the default and other active cards exist, promote the next one
  if (card.isDefault) {
    const next = await prisma.savedCard.findFirst({ where: { businessId, isActive: true }, orderBy: { createdAt: 'asc' } });
    if (next) await prisma.savedCard.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      type: 'CARD_REMOVED',
      description: `Removed ${card.brand} card ending ${card.last4}`,
      cardId: card.id,
    },
  });
  // Email the owner
  const owner = await getBusinessOwnerEmail(businessId);
  if (owner) {
    const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
    await sendCardRemovedEmail({
      to: owner.email,
      userId: owner.userId,
      businessId,
      businessName: biz?.name ?? 'your business',
      brand: card.brand,
      last4: card.last4,
    });
  }
  return sendSuccess(res, { id }, 'Card removed');
}));

// =====================================================
// Set default card
// =====================================================

paymentRouter.post('/cards/:id/default', validateParams(z.object({ id: z.string().uuid() })), asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.activeBusinessId!;
  const { id } = req.params as { id: string };
  const card = await prisma.savedCard.findFirst({ where: { id, businessId, isActive: true } });
  if (!card) return sendError(res, Errors.notFound('Card not found'));

  await prisma.$transaction([
    prisma.savedCard.updateMany({ where: { businessId, isDefault: true }, data: { isDefault: false } }),
    prisma.savedCard.update({ where: { id }, data: { isDefault: true } }),
  ]);
  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      type: 'CARD_SET_DEFAULT',
      description: `Set ${card.brand} ending ${card.last4} as default`,
      cardId: card.id,
    },
  });
  return sendSuccess(res, { id }, 'Default card updated');
}));

// =====================================================
// Charge now (manual renewal)
// =====================================================

const ChargeSchema = z.object({
  planId: z.string().uuid().optional(),
  cardId: z.string().uuid().optional(),
  interval: z.enum(['monthly', 'annual']).default('monthly'),
}).refine((v) => v.planId !== undefined || v.interval !== undefined, { message: 'Either planId or interval must be provided' });

paymentRouter.post('/charge', validateBody(ChargeSchema), asyncHandler(async (req: Request, res: Response) => {
  if (!config.flutterwave.enabled) {
    return sendError(res, Errors.serviceUnavailable('Flutterwave is not enabled. Set FLW_ENABLED=true to enable card payments.', 'FLW_DISABLED'));
  }
  const businessId = req.activeBusinessId!;
  const body = req.body as z.infer<typeof ChargeSchema>;

  // Resolve the plan: either from body, or from the active subscription
  let planId = body.planId;
  let sub: Awaited<ReturnType<typeof getCurrentSubscription>> = null;
  if (!planId) {
    sub = await getCurrentSubscription(businessId);
    if (!sub) return sendError(res, Errors.notFound('No active subscription. Provide planId to start one.'));
    planId = sub.planId;
  }
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) return sendError(res, Errors.notFound('Plan not found'));

  // Resolve the card: either from body, or from default
  let card = body.cardId
    ? await prisma.savedCard.findFirst({ where: { id: body.cardId, businessId, isActive: true } })
    : await getDefaultCard(businessId);
  if (!card) return sendError(res, Errors.badRequest('No saved card available. Add a card first.', 'NO_CARD'));

  const amountMinor = body.interval === 'annual' ? plan.annualPriceMinor : plan.monthlyPriceMinor;
  const amountMajor = Number(amountMinor) / 100;
  const txRef = flw.generateTxRef('CHG');

  // Create the charge row (status=PENDING)
  const charge = await prisma.subscriptionCharge.create({
    data: {
      businessId,
      subscriptionId: sub?.id ?? null,
      planId: plan.id,
      savedCardId: card.id,
      txRef,
      amountMinor,
      currency: 'NGN',
      status: 'PENDING',
      narration: `RetailOS subscription renewal — ${plan.name} (${body.interval})`,
      attemptedAt: new Date(),
    },
  });

  // Call Flutterwave
  const result = await flw.chargeTokenizedCard({
    token: card.token,
    email: card.emailUsed,
    amount: amountMajor,
    currency: 'NGN',
    txRef,
    narration: `RetailOS subscription renewal — ${plan.name}`,
    redirectUrl: `${config.urls.webapp}/subscription`,
  });

  // Update charge + lastUsedAt
  await prisma.savedCard.update({ where: { id: card.id }, data: { lastUsedAt: new Date() } });

  if (result.status === 'success') {
    await prisma.subscriptionCharge.update({
      where: { id: charge.id },
      data: {
        status: 'SUCCESSFUL',
        flwTransactionId: result.flwTransactionId,
        chargeResponseCode: result.chargeResponseCode,
        chargeResponseMessage: result.chargeResponseMessage,
        finalizedAt: new Date(),
      },
    });
    // Extend the subscription
    const { subscriptionId, newEndDate } = await extendSubscription(businessId, plan.id, amountMinor, body.interval);
    // Record event
    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        type: 'CHARGE_SUCCESSFUL',
        description: `Charged ${formatMoney(amountMinor)} for ${plan.name} plan — renewed until ${newEndDate.toISOString().slice(0, 10)}`,
        amountMinor,
        currency: 'NGN',
        chargeId: charge.id,
        planId: plan.id,
        cardId: card.id,
      },
    });
    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        type: 'SUBSCRIPTION_RENEWED',
        description: `${plan.name} subscription renewed until ${newEndDate.toISOString().slice(0, 10)}`,
        amountMinor,
        currency: 'NGN',
        chargeId: charge.id,
        planId: plan.id,
        cardId: card.id,
      },
    });
    // Email success
    const owner = await getBusinessOwnerEmail(businessId);
    if (owner) {
      const updatedCharge = await prisma.subscriptionCharge.findUnique({ where: { id: charge.id } });
      if (updatedCharge) {
        const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
        await sendChargeSuccessEmail({
          to: owner.email,
          userId: owner.userId,
          businessId,
          businessName: biz?.name ?? 'your business',
          plan,
          charge: updatedCharge,
          newEndDate,
        });
      }
    }
    return sendSuccess(res, {
      chargeId: charge.id,
      txRef,
      status: 'SUCCESSFUL',
      flwTransactionId: result.flwTransactionId,
      subscriptionId,
      newEndDate,
      amountMinor: amountMinor.toString(),
      currency: 'NGN',
      plan: { id: plan.id, name: plan.name },
    }, 'Payment successful');
  }

  // Failed or pending OTP/3DS
  await prisma.subscriptionCharge.update({
    where: { id: charge.id },
    data: {
      status: result.status === 'pending_otp' ? 'REQUIRES_OTP' : result.status === 'pending_3ds' ? 'REQUIRES_OTP' : 'FAILED',
      flwTransactionId: result.flwTransactionId,
      chargeResponseCode: result.chargeResponseCode,
      chargeResponseMessage: result.chargeResponseMessage,
      authUrl: result.authUrl,
      failureReason: result.failureReason ?? result.chargeResponseMessage,
      finalizedAt: result.status === 'failed' ? new Date() : null,
    },
  });

  if (result.status === 'pending_otp' || result.status === 'pending_3ds') {
    return sendSuccess(res, {
      chargeId: charge.id,
      txRef,
      status: 'REQUIRES_OTP',
      flwRef: result.flwRef,
      flwTransactionId: result.flwTransactionId,
      authUrl: result.authUrl,
      message: result.chargeResponseMessage ?? 'OTP/3DS verification required',
    }, 'Charge requires OTP/3DS verification', 202);
  }

  // Failure — record event + email
  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      type: 'CHARGE_FAILED',
      description: `Failed charge of ${formatMoney(amountMinor)} for ${plan.name}: ${result.failureReason ?? 'unknown'}`,
      amountMinor,
      currency: 'NGN',
      chargeId: charge.id,
      planId: plan.id,
      cardId: card.id,
    },
  });
  const owner = await getBusinessOwnerEmail(businessId);
  if (owner) {
    const updatedCharge = await prisma.subscriptionCharge.findUnique({ where: { id: charge.id } });
    if (updatedCharge) {
      const biz = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true } });
      await sendChargeFailedEmail({
        to: owner.email,
        userId: owner.userId,
        businessId,
        businessName: biz?.name ?? 'your business',
        plan,
        charge: updatedCharge,
        updateCardUrl: `${config.urls.webapp}/subscription?tab=cards`,
      });
    }
  }

  return sendError(res, Errors.badRequest(result.failureReason ?? result.chargeResponseMessage ?? 'Charge failed', 'CHARGE_FAILED'));
}));

// =====================================================
// List charges (subscription history)
// =====================================================

paymentRouter.get('/charges', asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.activeBusinessId!;
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const [items, total] = await Promise.all([
    prisma.subscriptionCharge.findMany({
      where: { businessId },
      orderBy: { attemptedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { plan: { select: { id: true, name: true } }, savedCard: { select: { id: true, brand: true, last4: true } } },
    }),
    prisma.subscriptionCharge.count({ where: { businessId } }),
  ]);
  return sendSuccess(res, {
    items: items.map((c) => ({
      id: c.id,
      txRef: c.txRef,
      amountMinor: c.amountMinor.toString(),
      currency: c.currency,
      status: c.status,
      narration: c.narration,
      chargeResponseMessage: c.chargeResponseMessage,
      failureReason: c.failureReason,
      attemptedAt: c.attemptedAt,
      finalizedAt: c.finalizedAt,
      retryCount: c.retryCount,
      plan: c.plan,
      card: c.savedCard,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }, 'Charges');
}));

paymentRouter.get('/charges/:id', validateParams(z.object({ id: z.string().uuid() })), asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.activeBusinessId!;
  const { id } = req.params as { id: string };
  const charge = await prisma.subscriptionCharge.findFirst({
    where: { id, businessId },
    include: { plan: { select: { id: true, name: true } }, savedCard: { select: { id: true, brand: true, last4: true, expiry: true } } },
  });
  if (!charge) return sendError(res, Errors.notFound('Charge not found'));
  return sendSuccess(res, {
    id: charge.id,
    txRef: charge.txRef,
    amountMinor: charge.amountMinor.toString(),
    currency: charge.currency,
    status: charge.status,
    narration: charge.narration,
    chargeResponseCode: charge.chargeResponseCode,
    chargeResponseMessage: charge.chargeResponseMessage,
    authUrl: charge.authUrl,
    failureReason: charge.failureReason,
    attemptedAt: charge.attemptedAt,
    finalizedAt: charge.finalizedAt,
    retryCount: charge.retryCount,
    flwTransactionId: charge.flwTransactionId,
    plan: charge.plan,
    card: charge.savedCard,
  }, 'Charge detail');
}));

// =====================================================
// Retry a failed charge
// =====================================================

paymentRouter.post('/charges/:id/retry', validateParams(z.object({ id: z.string().uuid() })), asyncHandler(async (req: Request, res: Response) => {
  if (!config.flutterwave.enabled) {
    return sendError(res, Errors.serviceUnavailable('Flutterwave is not enabled', 'FLW_DISABLED'));
  }
  const businessId = req.activeBusinessId!;
  const { id } = req.params as { id: string };
  const oldCharge = await prisma.subscriptionCharge.findFirst({
    where: { id, businessId },
    include: { plan: true, savedCard: true },
  });
  if (!oldCharge) return sendError(res, Errors.notFound('Charge not found'));
  if (oldCharge.status !== 'FAILED') {
    return sendError(res, Errors.badRequest('Only failed charges can be retried', 'NOT_FAILED'));
  }
  if (!oldCharge.savedCard || !oldCharge.savedCard.isActive) {
    return sendError(res, Errors.badRequest('The card used for this charge is no longer active. Add a new card.', 'CARD_INACTIVE'));
  }
  // Create a new charge row linked to the same subscription/plan/card
  const txRef = flw.generateTxRef('CHG-RETRY');
  const newCharge = await prisma.subscriptionCharge.create({
    data: {
      businessId,
      subscriptionId: oldCharge.subscriptionId,
      planId: oldCharge.planId,
      savedCardId: oldCharge.savedCardId,
      txRef,
      amountMinor: oldCharge.amountMinor,
      currency: oldCharge.currency,
      status: 'PENDING',
      narration: `Retry of ${oldCharge.txRef}`,
      attemptedAt: new Date(),
      retryCount: oldCharge.retryCount + 1,
    },
  });
  // Mark old as cancelled
  await prisma.subscriptionCharge.update({ where: { id: oldCharge.id }, data: { status: 'CANCELLED', finalizedAt: new Date() } });

  // Charge Flutterwave
  const result = await flw.chargeTokenizedCard({
    token: oldCharge.savedCard.token,
    email: oldCharge.savedCard.emailUsed,
    amount: Number(oldCharge.amountMinor) / 100,
    currency: oldCharge.currency,
    txRef,
    narration: `Retry: ${oldCharge.narration ?? 'RetailOS subscription renewal'}`,
  });

  if (result.status === 'success') {
    await prisma.subscriptionCharge.update({
      where: { id: newCharge.id },
      data: {
        status: 'SUCCESSFUL',
        flwTransactionId: result.flwTransactionId,
        chargeResponseCode: result.chargeResponseCode,
        chargeResponseMessage: result.chargeResponseMessage,
        finalizedAt: new Date(),
      },
    });
    await extendSubscription(businessId, oldCharge.planId!, oldCharge.amountMinor, 'monthly');
    await prisma.subscriptionEvent.create({
      data: {
        businessId,
        type: 'CHARGE_SUCCESSFUL',
        description: `Retry of ${oldCharge.txRef} succeeded`,
        amountMinor: oldCharge.amountMinor,
        currency: oldCharge.currency,
        chargeId: newCharge.id,
        planId: oldCharge.planId,
        cardId: oldCharge.savedCardId,
      },
    });
    return sendSuccess(res, { chargeId: newCharge.id, status: 'SUCCESSFUL' }, 'Retry successful');
  }

  await prisma.subscriptionCharge.update({
    where: { id: newCharge.id },
    data: {
      status: 'FAILED',
      chargeResponseCode: result.chargeResponseCode,
      chargeResponseMessage: result.chargeResponseMessage,
      failureReason: result.failureReason,
      finalizedAt: new Date(),
    },
  });
  await prisma.subscriptionEvent.create({
    data: {
      businessId,
      type: 'CHARGE_FAILED',
      description: `Retry of ${oldCharge.txRef} failed: ${result.failureReason ?? 'unknown'}`,
      amountMinor: oldCharge.amountMinor,
      currency: oldCharge.currency,
      chargeId: newCharge.id,
      planId: oldCharge.planId,
      cardId: oldCharge.savedCardId,
    },
  });
  return sendError(res, Errors.badRequest(result.failureReason ?? 'Retry failed', 'RETRY_FAILED'));
}));

// =====================================================
// Subscription events (audit history)
// =====================================================

paymentRouter.get('/events', asyncHandler(async (req: Request, res: Response) => {
  const businessId = req.activeBusinessId!;
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 20)));
  const [items, total] = await Promise.all([
    prisma.subscriptionEvent.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { plan: { select: { id: true, name: true } } },
    }),
    prisma.subscriptionEvent.count({ where: { businessId } }),
  ]);
  return sendSuccess(res, {
    items: items.map((e) => ({
      id: e.id,
      type: e.type,
      description: e.description,
      amountMinor: e.amountMinor?.toString() ?? null,
      currency: e.currency,
      chargeId: e.chargeId,
      cardId: e.cardId,
      plan: e.plan,
      createdAt: e.createdAt,
    })),
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }, 'Subscription events');
}));

// =====================================================
// Helpers
// =====================================================

function formatMoney(minor: bigint): string {
  const major = Number(minor) / 100;
  return `\u20A6${major.toLocaleString('en-NG', { minimumFractionDigits: major % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
}
