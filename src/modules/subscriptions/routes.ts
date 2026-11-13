/**
 * @openapi
 * components:
 *   schemas:
 *     SubscriptionPlan:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         code: { type: string, enum: [free, pro, business, enterprise] }
 *         name: { type: string }
 *         description: { type: string, nullable: true }
 *         monthlyPriceMinor: { type: string, description: "Integer minor units (kobo)" }
 *         annualPriceMinor: { type: string }
 *         productLimit: { type: integer, nullable: true, description: "null = unlimited" }
 *         staffLimit: { type: integer, nullable: true }
 *         branchLimit: { type: integer, nullable: true }
 *         cloudSync: { type: boolean }
 *         advancedReports: { type: boolean }
 *         multiUserPerms: { type: boolean }
 *         branchAnalytics: { type: boolean }
 *         trialDays: { type: integer }
 *         gracePeriodDays: { type: integer }
 *         isActive: { type: boolean }
 *         sortOrder: { type: integer }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     Subscription:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         planId: { type: string, format: uuid }
 *         status:
 *           type: string
 *           enum: [TRIAL, ACTIVE, PAST_DUE, GRACE_PERIOD, EXPIRED, SUSPENDED, CANCELLED]
 *         startDate: { type: string, format: date-time }
 *         endDate: { type: string, format: date-time, nullable: true }
 *         trialEndsAt: { type: string, format: date-time, nullable: true }
 *         graceEndsAt: { type: string, format: date-time, nullable: true }
 *         cancelledAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         plan:
 *           $ref: "#/components/schemas/SubscriptionPlan"
 *     PaymentSubmission:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         subscriptionId: { type: string, format: uuid, nullable: true }
 *         planId: { type: string, format: uuid }
 *         amountMinor: { type: string, description: "Integer minor units (kobo)" }
 *         paymentMethod: { type: string }
 *         reference: { type: string, description: "Unique human-readable reference, e.g. PS-01J8X9K3P0" }
 *         proofUrl: { type: string, format: uri, nullable: true }
 *         submittedById: { type: string, format: uuid }
 *         status:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         reviewedById: { type: string, format: uuid, nullable: true }
 *         reviewNote: { type: string, nullable: true }
 *         reviewedAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *
 * /subscriptions/plans:
 *   get:
 *     tags: [Subscriptions]
 *     summary: List all active subscription plans
 *     description: Returns all active plans, ordered by `sortOrder`. Public within auth context — any authenticated user can see pricing.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: List of plans }
 *
 * /subscriptions/current:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get the current business subscription
 *     description: Returns the most recent subscription for the active business, including the plan details and effective entitlements.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Current subscription with plan + entitlements }
 *
 * /subscriptions/change:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Change the active subscription plan
 *     description: |
 *       Atomic plan-change flow inside a single `prisma.$transaction`:
 *       1. Look up the target plan (must be active).
 *       2. Mark the previous (most recent) subscription as CANCELLED with cancelledAt=now.
 *       3. Create a new Subscription:
 *          - status=TRIAL + trialEndsAt when plan.trialDays > 0
 *          - status=ACTIVE otherwise (e.g. free plan)
 *       4. Audit log entry.
 *
 *       For paid plans, the new subscription begins as TRIAL; activation past
 *       the trial window requires a verified PaymentSubmission.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, billingCycle]
 *             properties:
 *               planId: { type: string, format: uuid }
 *               billingCycle: { type: string, enum: [monthly, annual] }
 *     responses:
 *       201: { description: New subscription created }
 *       404: { description: Plan not found }
 *
 * /subscriptions/payment-submissions:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Submit a payment for verification
 *     description: |
 *       Creates a PaymentSubmission with status=PENDING and a unique reference
 *       (e.g. `PS-01J8X9K3P0`). A Notification is created for the submitting
 *       user: "Payment submitted, awaiting verification". Money fields arrive
 *       as decimal strings and are converted to minor units.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, amount, paymentMethod]
 *             properties:
 *               planId: { type: string, format: uuid }
 *               amount: { type: string, description: "Decimal major string, e.g. '5000.00'" }
 *               paymentMethod: { type: string }
 *               proofUrl: { type: string, format: uri }
 *     responses:
 *       201: { description: Payment submission created }
 *   get:
 *     tags: [Subscriptions]
 *     summary: List payment submissions for the active business
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string, enum: [PENDING, APPROVED, REJECTED] } }
 *     responses:
 *       200: { description: Paginated list of payment submissions }
 *
 * /subscriptions/payment-submissions/{id}:
 *   get:
 *     tags: [Subscriptions]
 *     summary: Get a single payment submission
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Payment submission detail }
 *       404: { description: Not found }
 *
 * /subscriptions/cancel:
 *   post:
 *     tags: [Subscriptions]
 *     summary: Cancel the current subscription
 *     description: |
 *       Marks the most recent subscription as CANCELLED with cancelledAt=now.
 *       Plan benefits continue until endDate or graceEndsAt (whichever is later);
 *       tenant middleware continues to permit read access during the grace window.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Subscription cancelled }
 *       404: { description: No active subscription found }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { type Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../db/index.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import { toMinor } from '../../utils/money.js';
import { paginate, pageMeta, PaginationSchema } from '../../utils/pagination.js';
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { paymentSubmissionRef } from '../../utils/refs.js';

// =====================================================
// Router setup
// =====================================================

export const subscriptionRouter = Router();

// All subscription routes are tenant-scoped.
// authMiddleware is applied at the mount point in app.ts.
subscriptionRouter.use(tenantContext);

// =====================================================
// Helpers
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

const BillingCycleEnum = z.enum(['monthly', 'annual']);

const PaymentSubmissionStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

const moneyInput = z.union([
  z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Must be a decimal string like "1250.50"'),
  z.number().nonnegative().finite(),
]);
const moneyString = moneyInput.transform((v: string | number) => String(v));

/** Fire-and-forget audit log write. Never throws. */
function writeAudit(
  req: Request,
  opts: { action: string; resourceType: string; resourceId: string; change?: unknown },
) {
  const businessId = req.activeBusinessId;
  if (!businessId) return;
  prisma.auditLog
    .create({
      data: {
        businessId,
        actorId: req.user?.id ?? null,
        adminActorId: req.user?.scope === 'admin' ? req.user.id : null,
        action: opts.action,
        resourceType: opts.resourceType,
        resourceId: opts.resourceId,
        change: (opts.change as any) ?? null,
        ipAddress: req.ip ?? null,
        userAgent: req.headers['user-agent'] ?? null,
      },
    })
    .catch(() => {
      /* fire and forget — never throw from audit */
    });
}

/** Serialise a plan so BigInt fields become JSON-safe strings. */
function serializePlan(p: any) {
  return {
    ...p,
    monthlyPriceMinor: p.monthlyPriceMinor?.toString() ?? '0',
    annualPriceMinor: p.annualPriceMinor?.toString() ?? '0',
  };
}

/** Serialise a subscription (+ nested plan) so all BigInt fields become strings. */
function serializeSubscription(s: any) {
  return {
    ...s,
    plan: s.plan ? serializePlan(s.plan) : null,
  };
}

/** Serialise a payment submission so amountMinor becomes a string. */
function serializePaymentSubmission(ps: any) {
  return {
    ...ps,
    amountMinor: ps.amountMinor?.toString() ?? '0',
  };
}

/**
 * Effective entitlements view for a subscription: which features are enabled
 * and whether the subscription is currently within its trial / grace window.
 */
function deriveEntitlements(sub: any, plan: any) {
  const now = new Date();
  const inTrial = sub.status === 'TRIAL' && sub.trialEndsAt ? sub.trialEndsAt > now : false;
  const inGrace =
    (sub.status === 'GRACE_PERIOD' || sub.status === 'PAST_DUE') &&
    sub.graceEndsAt
      ? sub.graceEndsAt > now
      : false;
  const isActive =
    sub.status === 'ACTIVE' || sub.status === 'TRIAL' || sub.status === 'GRACE_PERIOD';

  return {
    status: sub.status,
    inTrial,
    inGrace,
    isActive,
    endDate: sub.endDate,
    trialEndsAt: sub.trialEndsAt,
    graceEndsAt: sub.graceEndsAt,
    cancelledAt: sub.cancelledAt,
    plan: plan
      ? {
          code: plan.code,
          name: plan.name,
          productLimit: plan.productLimit,
          staffLimit: plan.staffLimit,
          branchLimit: plan.branchLimit,
          cloudSync: plan.cloudSync,
          advancedReports: plan.advancedReports,
          multiUserPerms: plan.multiUserPerms,
          branchAnalytics: plan.branchAnalytics,
        }
      : null,
  };
}

// =====================================================
// GET /subscriptions/plans
// =====================================================
subscriptionRouter.get(
  '/plans',
  asyncHandler(async (req: Request, res: Response) => {
    // Public within auth context — no tenant header required, but we still
    // honour X-Business-Id if present (tenantContext may set activeBusinessId).
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return sendSuccess(res, plans.map(serializePlan), 'OK');
  }),
);

// =====================================================
// GET /subscriptions/current
// =====================================================
subscriptionRouter.get(
  '/current',
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;

    const sub = await prisma.subscription.findFirst({
      where: { businessId: bizId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
    if (!sub) {
      return sendError(res, Errors.notFound('No subscription found for this business'));
    }

    const entitlements = deriveEntitlements(sub, sub.plan);

    return sendSuccess(
      res,
      {
        ...serializeSubscription(sub),
        entitlements,
      },
      'OK',
    );
  }),
);

// =====================================================
// POST /subscriptions/change
// =====================================================
const ChangePlanSchema = z.object({
  planId: z.string().uuid(),
  billingCycle: BillingCycleEnum,
});

subscriptionRouter.post(
  '/change',
  requirePermission('subscription:manage'),
  validateBody(ChangePlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof ChangePlanSchema>;

    // 1. Look up target plan
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: body.planId },
    });
    if (!plan || !plan.isActive) {
      return sendError(res, Errors.notFound('Plan not found or inactive'));
    }

    // 2. Atomic plan-change: cancel previous + create new subscription
    const newSub = await prisma.$transaction(async (tx: Tx) => {
      // Fetch the most recent subscription and mark it CANCELLED.
      const previous = await tx.subscription.findFirst({
        where: { businessId: bizId },
        orderBy: { createdAt: 'desc' },
      });
      if (previous && previous.status !== 'CANCELLED') {
        await tx.subscription.update({
          where: { id: previous.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
          },
        });
      }

      // Determine trial vs active.
      const trialEndsAt = plan.trialDays
        ? new Date(Date.now() + plan.trialDays * 24 * 60 * 60 * 1000)
        : null;
      const status: 'TRIAL' | 'ACTIVE' = trialEndsAt ? 'TRIAL' : 'ACTIVE';

      // For paid plans, the actual activation (endDate set) requires a verified
      // PaymentSubmission. Until then, endDate is null; trial window governs access.
      const created = await tx.subscription.create({
        data: {
          businessId: bizId,
          planId: plan.id,
          status,
          startDate: new Date(),
          endDate: null,
          trialEndsAt,
          graceEndsAt: null,
        },
        include: { plan: true },
      });

      return created;
    });

    writeAudit(req, {
      action: 'subscription.change',
      resourceType: 'subscription',
      resourceId: newSub.id,
      change: {
        planCode: plan.code,
        planId: plan.id,
        billingCycle: body.billingCycle,
        status: newSub.status,
        trialEndsAt: newSub.trialEndsAt,
        previousSubscriptionId: newSub.id,
      },
    });

    return sendSuccess(
      res,
      serializeSubscription(newSub),
      'Subscription changed — payment verification required for activation',
      201,
    );
  }),
);

// =====================================================
// POST /subscriptions/payment-submissions
// =====================================================
const CreatePaymentSubmissionSchema = z.object({
  planId: z.string().uuid(),
  amount: moneyString,
  paymentMethod: z.string().min(1).max(60),
  proofUrl: z.string().url().optional().nullable(),
});

subscriptionRouter.post(
  '/payment-submissions',
  requirePermission('subscription:manage'),
  validateBody(CreatePaymentSubmissionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    if (!req.user) return sendError(res, Errors.unauthorized());
    const body = req.body as z.infer<typeof CreatePaymentSubmissionSchema>;

    // Validate plan exists & is active
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: body.planId },
    });
    if (!plan || !plan.isActive) {
      return sendError(res, Errors.notFound('Plan not found or inactive'));
    }

    const amountMinor = toMinor(body.amount);
    if (amountMinor < 0n) {
      return sendError(res, Errors.badRequest('Amount cannot be negative', 'INVALID_AMOUNT'));
    }

    const reference = paymentSubmissionRef();

    // Resolve the active subscription for this plan (if any) — link by planId.
    const activeSub = await prisma.subscription.findFirst({
      where: { businessId: bizId, planId: plan.id },
      orderBy: { createdAt: 'desc' },
    });

    const result = await prisma.$transaction(async (tx: Tx) => {
      const submission = await tx.paymentSubmission.create({
        data: {
          businessId: bizId,
          subscriptionId: activeSub?.id ?? null,
          planId: plan.id,
          amountMinor,
          paymentMethod: body.paymentMethod,
          reference,
          proofUrl: body.proofUrl ?? null,
          submittedById: req.user!.id,
          status: 'PENDING',
        },
        include: {
          plan: { select: { id: true, code: true, name: true } },
          submittedBy: { select: { id: true, fullName: true, email: true } },
        },
      });

      // Fire a notification for the submitting user.
      await tx.notification.create({
        data: {
          businessId: bizId,
          userId: req.user!.id,
          type: 'payment_submission',
          title: 'Payment submitted',
          message: 'Payment submitted, awaiting verification',
          payload: {
            submissionId: submission.id,
            reference: submission.reference,
            amountMinor: submission.amountMinor.toString(),
            planCode: plan.code,
          },
        },
      });

      return submission;
    });

    writeAudit(req, {
      action: 'subscription.payment_submission.create',
      resourceType: 'payment_submission',
      resourceId: result.id,
      change: {
        reference,
        planCode: plan.code,
        amountMinor: amountMinor.toString(),
        paymentMethod: body.paymentMethod,
      },
    });

    return sendSuccess(res, serializePaymentSubmission(result), 'Payment submitted', 201);
  }),
);

// =====================================================
// GET /subscriptions/payment-submissions
// =====================================================
const ListPaymentSubmissionsQuerySchema = PaginationSchema.extend({
  status: PaymentSubmissionStatusEnum.optional(),
});

subscriptionRouter.get(
  '/payment-submissions',
  requirePermission('subscription:manage'),
  validateQuery(ListPaymentSubmissionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ListPaymentSubmissionsQuerySchema>;

    const where: Prisma.PaymentSubmissionWhereInput = { businessId: bizId };
    if (q.status) where.status = q.status;

    const total = await prisma.paymentSubmission.count({ where });
    const items = await prisma.paymentSubmission.findMany({
      ...paginate(
        { where, orderBy: { createdAt: 'desc' as const } },
        q,
      ),
      include: {
        plan: { select: { id: true, code: true, name: true } },
        submittedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
      },
    });

    return sendSuccess(
      res,
      {
        items: items.map(serializePaymentSubmission),
        meta: pageMeta(total, q),
      },
      'OK',
    );
  }),
);

// =====================================================
// GET /subscriptions/payment-submissions/:id
// =====================================================
subscriptionRouter.get(
  '/payment-submissions/:id',
  requirePermission('subscription:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as { id: string };

    const submission = await prisma.paymentSubmission.findFirst({
      where: { id, businessId: bizId },
      include: {
        plan: { select: { id: true, code: true, name: true } },
        submittedBy: { select: { id: true, fullName: true, email: true } },
        reviewedBy: { select: { id: true, fullName: true, email: true } },
      },
    });
    if (!submission) {
      return sendError(res, Errors.notFound('Payment submission not found'));
    }

    return sendSuccess(res, serializePaymentSubmission(submission), 'OK');
  }),
);

// =====================================================
// POST /subscriptions/cancel
// =====================================================
const CancelSchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
}).default({});

subscriptionRouter.post(
  '/cancel',
  requirePermission('subscription:manage'),
  validateBody(CancelSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CancelSchema>;

    const result = await prisma.$transaction(async (tx: Tx) => {
      const sub = await tx.subscription.findFirst({
        where: { businessId: bizId },
        orderBy: { createdAt: 'desc' },
        include: { plan: true },
      });
      if (!sub) {
        return null;
      }
      if (sub.status === 'CANCELLED') {
        return sub; // already cancelled — idempotent
      }
      const updated = await tx.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        },
        include: { plan: true },
      });
      return updated;
    });

    if (!result) {
      return sendError(res, Errors.notFound('No active subscription found for this business'));
    }

    writeAudit(req, {
      action: 'subscription.cancel',
      resourceType: 'subscription',
      resourceId: result.id,
      change: {
        reason: body.reason ?? null,
        previousStatus: result.status,
        cancelledAt: result.cancelledAt,
      },
    });

    return sendSuccess(
      res,
      serializeSubscription(result),
      'Subscription cancelled — plan benefits continue until endDate or graceEndsAt',
    );
  }),
);
