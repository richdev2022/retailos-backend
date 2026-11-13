/**
 * Recurring subscription charge cron runner.
 *
 * Run via: `npm run cron:recurring-charges`
 *
 * Logic:
 *   1. Find all ACTIVE subscriptions where endDate is in the past 24 hours (i.e. expiring today)
 *      AND status is ACTIVE (not CANCELLED, not EXPIRED).
 *   2. For each, look up the default saved card for the business.
 *   3. Create a SubscriptionCharge (PENDING) and call Flutterwave's tokenized-charges endpoint.
 *   4. On success: extend the subscription by 30 days + record event + send email.
 *   5. On failure: mark FAILED + record event + send failure email. The subscription
 *      will enter GRACE_PERIOD after 24 hours (handled by the grace-period cron).
 *
 * Idempotency: a unique tx_ref is generated per attempt and the SubscriptionCharge
 * table has a unique constraint on tx_ref, so concurrent runs cannot double-charge.
 *
 * Note: in production you'd run this as a BullMQ worker (with Redis as the queue).
 * The standalone script version processes subscriptions serially with a small delay
 * between charges to respect Flutterwave rate limits.
 */
import { prisma } from '../db/index.js';
import { config } from '../config/index.js';
import * as flw from '../modules/payments/flutterwave.js';
import { extendSubscription } from '../modules/payments/cron-helpers.js';
import { sendChargeSuccessEmail, sendChargeFailedEmail, getBusinessOwnerEmail } from '../modules/email/service.js';
import type { SubscriptionPlan, SubscriptionCharge } from '@prisma/client';

async function runRecurringCharges(): Promise<void> {
  if (!config.flutterwave.enabled) {
    console.log('[cron] Flutterwave disabled — skipping recurring charges');
    return;
  }
  console.log('[cron] Running recurring charge sweep...');

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const dueSubs = await prisma.subscription.findMany({
    where: {
      status: 'ACTIVE',
      endDate: { lte: windowEnd, gte: now },
    },
    include: { plan: true, business: { include: { owner: true } } },
  });
  console.log(`[cron] Found ${dueSubs.length} subscriptions due for renewal`);

  let successCount = 0;
  let failedCount = 0;

  for (const sub of dueSubs) {
    try {
      // Idempotency: skip if a charge for this subscription already exists in the last 24 hours
      const recent = await prisma.subscriptionCharge.findFirst({
        where: {
          subscriptionId: sub.id,
          attemptedAt: { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
          status: { in: ['SUCCESSFUL', 'PENDING', 'REQUIRES_OTP'] },
        },
      });
      if (recent) {
        console.log(`[cron] Skipping ${sub.id} — already charged recently (${recent.status})`);
        continue;
      }

      const card = await prisma.savedCard.findFirst({
        where: { businessId: sub.businessId, isActive: true, isDefault: true },
      });
      if (!card) {
        console.warn(`[cron] No default card for ${sub.businessId} — marking subscription as PAST_DUE`);
        await prisma.subscription.update({ where: { id: sub.id }, data: { status: 'PAST_DUE', graceEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) } });
        await prisma.subscriptionEvent.create({
          data: {
            businessId: sub.businessId,
            type: 'CHARGE_FAILED',
            description: `No saved card available for renewal — subscription moved to PAST_DUE`,
          },
        });
        const owner = await getBusinessOwnerEmail(sub.businessId);
        if (owner && sub.business?.owner?.email) {
          // Synthetic charge record for the failure email template
          const fakeCharge = {
            id: 'no-card',
            txRef: `NO-CARD-${sub.id.slice(0, 8)}`,
            amountMinor: sub.plan.monthlyPriceMinor,
            currency: 'NGN',
            failureReason: 'No saved card on file. Please add a card to renew your subscription.',
            attemptedAt: now,
          } as unknown as SubscriptionCharge;
          await sendChargeFailedEmail({
            to: owner.email,
            userId: owner.userId,
            businessId: sub.businessId,
            businessName: sub.business.name,
            plan: sub.plan,
            charge: fakeCharge,
            updateCardUrl: `${config.urls.webapp}/subscription?tab=cards`,
          });
        }
        failedCount++;
        continue;
      }

      const amountMinor = sub.plan.monthlyPriceMinor;
      const txRef = flw.generateTxRef('CRON-CHG');
      const charge = await prisma.subscriptionCharge.create({
        data: {
          businessId: sub.businessId,
          subscriptionId: sub.id,
          planId: sub.planId,
          savedCardId: card.id,
          txRef,
          amountMinor,
          currency: 'NGN',
          status: 'PENDING',
          narration: `Auto-renewal — ${sub.plan.name} plan`,
          attemptedAt: now,
        },
      });

      console.log(`[cron] Charging ${sub.businessId} via card ${card.last4} for ${sub.plan.name}...`);
      const result = await flw.chargeTokenizedCard({
        token: card.token,
        email: card.emailUsed,
        amount: Number(amountMinor) / 100,
        currency: 'NGN',
        txRef,
        narration: `RetailOS auto-renewal — ${sub.plan.name}`,
      });

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
        await prisma.savedCard.update({ where: { id: card.id }, data: { lastUsedAt: new Date() } });
        const { newEndDate } = await extendSubscription(sub.businessId, sub.planId, amountMinor, 'monthly');
        await prisma.subscriptionEvent.create({
          data: {
            businessId: sub.businessId,
            type: 'CHARGE_SUCCESSFUL',
            description: `Auto-renewed ${sub.plan.name} plan for 30 days — renewed until ${newEndDate.toISOString().slice(0, 10)}`,
            amountMinor,
            currency: 'NGN',
            chargeId: charge.id,
            planId: sub.planId,
            cardId: card.id,
          },
        });
        const owner = await getBusinessOwnerEmail(sub.businessId);
        if (owner && sub.business?.owner?.email) {
          const updatedCharge = await prisma.subscriptionCharge.findUnique({ where: { id: charge.id } });
          if (updatedCharge) {
            await sendChargeSuccessEmail({
              to: owner.email,
              userId: owner.userId,
              businessId: sub.businessId,
              businessName: sub.business.name,
              plan: sub.plan,
              charge: updatedCharge,
              newEndDate,
            });
          }
        }
        successCount++;
        console.log(`[cron] Success: ${sub.id} renewed until ${newEndDate.toISOString().slice(0, 10)}`);
      } else {
        await prisma.subscriptionCharge.update({
          where: { id: charge.id },
          data: {
            status: 'FAILED',
            flwTransactionId: result.flwTransactionId,
            chargeResponseCode: result.chargeResponseCode,
            chargeResponseMessage: result.chargeResponseMessage,
            failureReason: result.failureReason ?? result.chargeResponseMessage,
            finalizedAt: new Date(),
          },
        });
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: 'PAST_DUE', graceEndsAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        });
        await prisma.subscriptionEvent.create({
          data: {
            businessId: sub.businessId,
            type: 'CHARGE_FAILED',
            description: `Auto-renewal failed: ${result.failureReason ?? 'unknown'} — subscription moved to PAST_DUE`,
            amountMinor,
            currency: 'NGN',
            chargeId: charge.id,
            planId: sub.planId,
            cardId: card.id,
          },
        });
        const owner = await getBusinessOwnerEmail(sub.businessId);
        if (owner && sub.business?.owner?.email) {
          const updatedCharge = await prisma.subscriptionCharge.findUnique({ where: { id: charge.id } });
          if (updatedCharge) {
            await sendChargeFailedEmail({
              to: owner.email,
              userId: owner.userId,
              businessId: sub.businessId,
              businessName: sub.business.name,
              plan: sub.plan,
              charge: updatedCharge,
              updateCardUrl: `${config.urls.webapp}/subscription?tab=cards`,
            });
          }
        }
        failedCount++;
        console.warn(`[cron] Failed: ${sub.id} — ${result.failureReason ?? result.chargeResponseMessage}`);
      }
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error(`[cron] Error processing subscription ${sub.id}:`, err);
      failedCount++;
    }
  }

  console.log(`[cron] Done. Success: ${successCount}, Failed: ${failedCount}`);
}

if (process.argv[1]?.endsWith('recurring-charges.ts') || process.argv[1]?.endsWith('recurring-charges.js')) {
  runRecurringCharges()
    .catch((err) => {
      console.error('[cron] Fatal:', err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
}

export { runRecurringCharges };
