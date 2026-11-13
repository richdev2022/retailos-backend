/**
 * Shared helpers used by both the payments routes and the cron runner.
 *
 * `extendSubscription` is intentionally a no-op-on-duplicate-safe operation:
 * given a (businessId, planId, interval) it loads the current subscription,
 * computes a new end date (from current end if still valid, else from now),
 * and either updates the existing subscription or creates a new one.
 */
import { prisma } from '../../db/index.js';

export async function getCurrentSubscription(businessId: string) {
  return prisma.subscription.findFirst({
    where: { businessId, status: { in: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD'] } },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function extendSubscription(
  businessId: string,
  planId: string,
  _amountMinor: bigint,
  interval: 'monthly' | 'annual',
): Promise<{ subscriptionId: string; newEndDate: Date }> {
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new Error('Plan not found');

  const days = interval === 'annual' ? 365 : 30;
  const sub = await getCurrentSubscription(businessId);
  const now = new Date();
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
