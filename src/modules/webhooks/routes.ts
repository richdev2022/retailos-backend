/**
 * Flutterwave webhook handler.
 *
 * Endpoint: POST /api/v1/webhooks/flutterwave
 *
 * Flutterwave sends webhook events for transaction status changes:
 *   - charge.completed    (card charge finalized — verify and update our record)
 *   - transfer.completed  (outbound transfer — not used here)
 *
 * The webhook includes a `verif-hash` header that we compare against
 * FLW_WEBHOOK_HASH to authenticate the request.
 *
 * On `charge.completed` we:
 *   1. Verify the signature.
 *   2. Read the `data.id` (Flutterwave transaction id) and call verifyTransaction().
 *   3. Find the matching SubscriptionCharge by `tx_ref` (which we generated).
 *   4. Update the charge status. If success, extend the subscription + send email.
 *      If failure, mark as failed and send the failure email.
 *
 * Returns 200 immediately (Flutterwave retries if not 200).
 */
import { Router, type Request, type Response } from 'express';
import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';
import { asyncHandler, sendSuccess } from '../../utils/errors.js';
import * as flw from '../payments/flutterwave.js';
import {
  sendChargeSuccessEmail,
  sendChargeFailedEmail,
  getBusinessOwnerEmail,
} from '../email/service.js';

export const webhookRouter = Router();

webhookRouter.post('/flutterwave', asyncHandler(async (req: Request, res: Response) => {
  // Verify the verif-hash header
  const verifHash = req.headers['verif-hash'] as string | undefined;
  if (!config.flutterwave.webhookHash) {
    // If no secret configured, accept but log warning
    console.warn('[webhook:flw] FLW_WEBHOOK_HASH not configured — accepting unverified webhook');
  } else if (!flw.verifyWebhookSignature(verifHash)) {
    console.warn('[webhook:flw] Invalid webhook signature');
    // Flutterwave expects a 200; returning 401 will cause retries.
    // We still 200 to stop retries, but ignore the payload.
    return res.status(200).json({ status: 'ignored', reason: 'invalid_signature' });
  }

  const event = req.body?.event as string | undefined;
  const data = req.body?.data ?? {};

  console.log(`[webhook:flw] event=${event} tx_ref=${data.tx_ref ?? '-'} id=${data.id ?? '-'}`);

  if (event === 'charge.completed' && data.id) {
    // Verify the transaction with Flutterwave (idempotent and authoritative)
    try {
      const verified = await flw.verifyTransaction(Number(data.id));
      // Find our local charge by tx_ref
      const txRef = verified.txRef;
      if (!txRef) {
        console.warn('[webhook:flw] No tx_ref in verified transaction', verified.flwTransactionId);
        return res.status(200).json({ status: 'ok', reason: 'no_tx_ref' });
      }
      const charge = await prisma.subscriptionCharge.findUnique({
        where: { txRef },
        include: { plan: true, savedCard: true, business: { include: { owner: true } } },
      });
      if (!charge) {
        console.warn('[webhook:flw] No charge found for tx_ref', txRef);
        return res.status(200).json({ status: 'ok', reason: 'no_charge' });
      }
      // Idempotency — skip if already finalized
      if (charge.status === 'SUCCESSFUL' || charge.status === 'FAILED') {
        return res.status(200).json({ status: 'ok', reason: 'already_finalized' });
      }

      if (verified.status === 'success') {
        await prisma.subscriptionCharge.update({
          where: { id: charge.id },
          data: {
            status: 'SUCCESSFUL',
            flwTransactionId: verified.flwTransactionId,
            chargeResponseCode: '00',
            chargeResponseMessage: verified.narration || 'Approved',
            finalizedAt: new Date(),
          },
        });
        // Extend the subscription (30 days from current end or now)
        const now = new Date();
        const existingSub = charge.subscriptionId
          ? await prisma.subscription.findUnique({ where: { id: charge.subscriptionId } })
          : null;
        const baseDate = existingSub?.endDate && existingSub.endDate > now ? existingSub.endDate : now;
        const newEndDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);
        let subscriptionId: string | undefined;
        if (charge.subscriptionId) {
          await prisma.subscription.update({
            where: { id: charge.subscriptionId },
            data: { status: 'ACTIVE', endDate: newEndDate, graceEndsAt: null, cancelledAt: null, planId: charge.planId ?? undefined },
          });
          subscriptionId = charge.subscriptionId;
        } else {
          const created = await prisma.subscription.create({
            data: {
              businessId: charge.businessId,
              planId: charge.planId!,
              status: 'ACTIVE',
              startDate: now,
              endDate: newEndDate,
            },
          });
          subscriptionId = created.id;
        }
        await prisma.subscriptionEvent.create({
          data: {
            businessId: charge.businessId,
            type: 'CHARGE_SUCCESSFUL',
            description: `Webhook confirmed charge of ${charge.amountMinor} kobo for ${charge.plan?.name ?? 'subscription'} — renewed until ${newEndDate.toISOString().slice(0, 10)}`,
            amountMinor: charge.amountMinor,
            currency: charge.currency,
            chargeId: charge.id,
            planId: charge.planId ?? null,
            cardId: charge.savedCardId ?? null,
          },
        });
        // Email the owner
        const owner = await getBusinessOwnerEmail(charge.businessId);
        if (owner && charge.plan && charge.business?.owner?.email) {
          const updatedCharge = await prisma.subscriptionCharge.findUnique({ where: { id: charge.id } });
          if (updatedCharge) {
            await sendChargeSuccessEmail({
              to: owner.email,
              userId: owner.userId,
              businessId: charge.businessId,
              businessName: charge.business.name,
              plan: charge.plan,
              charge: updatedCharge,
              newEndDate,
            });
          }
        }
      } else if (verified.status === 'failed') {
        await prisma.subscriptionCharge.update({
          where: { id: charge.id },
          data: {
            status: 'FAILED',
            flwTransactionId: verified.flwTransactionId,
            chargeResponseMessage: verified.narration || 'Failed',
            failureReason: verified.narration || 'Charge failed',
            finalizedAt: new Date(),
          },
        });
        await prisma.subscriptionEvent.create({
          data: {
            businessId: charge.businessId,
            type: 'CHARGE_FAILED',
            description: `Webhook reported failed charge of ${charge.amountMinor} kobo: ${verified.narration ?? 'unknown'}`,
            amountMinor: charge.amountMinor,
            currency: charge.currency,
            chargeId: charge.id,
            planId: charge.planId ?? null,
            cardId: charge.savedCardId ?? null,
          },
        });
        const owner = await getBusinessOwnerEmail(charge.businessId);
        if (owner && charge.plan) {
          const updatedCharge = await prisma.subscriptionCharge.findUnique({ where: { id: charge.id } });
          if (updatedCharge) {
            await sendChargeFailedEmail({
              to: owner.email,
              userId: owner.userId,
              businessId: charge.businessId,
              businessName: charge.business.name,
              plan: charge.plan,
              charge: updatedCharge,
              updateCardUrl: `${config.urls.webapp}/subscription?tab=cards`,
            });
          }
        }
      }
    } catch (err) {
      console.error('[webhook:flw] Error processing charge.completed:', err);
      // Return 500 to trigger retry
      return res.status(500).json({ status: 'error', message: 'processing failed' });
    }
  }

  return res.status(200).json({ status: 'ok' });
}));
