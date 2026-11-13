import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';
import { Errors } from '../utils/errors.js';

/**
 * Validate that the active business exists, is ACTIVE, and has an active
 * subscription (or is within trial/grace). Attach the business and subscription
 * to the request for downstream use.
 *
 * Tenant isolation: every business-owned query must be filtered by businessId
 * obtained from this middleware (NOT from request body).
 */
export async function tenantContext(req: Request, _res: Response, next: NextFunction) {
  try {
    const bizId = req.activeBusinessId;
    if (!bizId) return next(Errors.badRequest('No active business', 'NO_ACTIVE_BUSINESS'));

    const business = await prisma.business.findUnique({ where: { id: bizId } });
    if (!business) return next(Errors.notFound('Business not found'));
    if (business.status !== 'ACTIVE') {
      return next(Errors.forbidden('Business suspended', 'BUSINESS_SUSPENDED'));
    }

    // Ensure user is a member
    if (!req.user) return next(Errors.unauthorized());
    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: bizId, userId: req.user.id } },
    });
    if (!member) return next(Errors.forbidden('Not a member of this business', 'NOT_A_MEMBER'));

    // Active subscription?
    const sub = await prisma.subscription.findFirst({
      where: { businessId: bizId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (sub) {
      const now = new Date();
      const isExpired =
        (sub.status === 'EXPIRED' || sub.status === 'CANCELLED') ||
        (sub.endDate && sub.endDate < now && (!sub.graceEndsAt || sub.graceEndsAt < now));
      if (isExpired && sub.status !== 'TRIAL') {
        // Read-only mode for expired subscriptions: allow GET, block writes
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
          return next(Errors.forbidden('Subscription expired. Read-only access.', 'SUBSCRIPTION_EXPIRED'));
        }
      }
    }

    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Entitlement check. Use as: enforceEntitlement('product_limit')
 * Throws ENTITLEMENT_EXCEEDED if the business exceeds plan limits.
 */
export function enforceEntitlement(kind: 'product' | 'staff' | 'branch') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const bizId = req.activeBusinessId!;
      const sub = await prisma.subscription.findFirst({
        where: { businessId: bizId },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });
      const plan = sub?.plan;
      if (!plan) return next(); // no plan = no enforcement (free tier)

      let limit: number | null = null;
      let count = 0;
      if (kind === 'product') {
        limit = plan.productLimit;
        count = await prisma.product.count({
          where: { businessId: bizId, status: { not: 'ARCHIVED' } },
        });
      } else if (kind === 'staff') {
        limit = plan.staffLimit;
        count = await prisma.businessMember.count({
          where: { businessId: bizId, status: 'ACTIVE' },
        });
      } else if (kind === 'branch') {
        limit = plan.branchLimit;
        count = await prisma.branch.count({ where: { businessId: bizId } });
      }

      if (limit !== null && limit !== undefined && count >= limit) {
        return next(Errors.entitlement(`Plan ${kind} limit (${limit}) exceeded`));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
