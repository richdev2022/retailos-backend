/**
 * @openapi
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         userId: { type: string, format: uuid, nullable: true }
 *         type: { type: string, description: "e.g. staff_invitation, low_stock, sale_refund" }
 *         title: { type: string }
 *         message: { type: string }
 *         payload: { type: object, nullable: true }
 *         readAt: { type: string, format: date-time, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *     NotificationPreferences:
 *       type: object
 *       properties:
 *         email: { type: boolean }
 *         push: { type: boolean }
 *         sms: { type: boolean }
 *         types: { type: object, description: "Per-type enable/disable map" }
 *
 * /notifications:
 *   get:
 *     tags: [Notifications]
 *     summary: List the current user's notifications
 *     description: Paginated list with optional read/unread filter.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string, enum: [read, unread], default: all } }
 *     responses:
 *       200: { description: Paginated notifications }
 *
 * /notifications/unread-count:
 *   get:
 *     tags: [Notifications]
 *     summary: Quick count of unread notifications
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Count of unread notifications }
 *
 * /notifications/{id}/read:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark a single notification as read
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Notification marked as read }
 *       404: { description: Notification not found }
 *
 * /notifications/read-all:
 *   post:
 *     tags: [Notifications]
 *     summary: Mark all of the current user's notifications as read
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: All notifications marked as read }
 *
 * /notifications/{id}:
 *   delete:
 *     tags: [Notifications]
 *     summary: Delete a notification
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Notification deleted }
 *       404: { description: Notification not found }
 *
 * /notifications/preferences:
 *   get:
 *     tags: [Notifications]
 *     summary: Get notification preferences (from PlatformConfig)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Notification preferences object }
 *   patch:
 *     tags: [Notifications]
 *     summary: Update notification preferences
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NotificationPreferences' }
 *     responses:
 *       200: { description: Preferences updated }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

import { prisma } from '../../db/index.js';
import {
  Errors,
  asyncHandler,
  sendSuccess,
  sendError,
} from '../../utils/errors.js';
import {
  validateBody,
  validateQuery,
  validateParams,
} from '../../middleware/validate.js';
import {
  paginate,
  pageMeta,
  PaginationSchema,
} from '../../utils/pagination.js';

// =====================================================
// Router setup
// =====================================================

export const notificationRouter = Router();

// =====================================================
// Helpers / schemas
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

const ListQuerySchema = PaginationSchema.extend({
  status: z.enum(['read', 'unread']).optional(),
});

/** Default preferences used when none are stored for the user yet. */
const DEFAULT_PREFERENCES = {
  email: true,
  push: true,
  sms: false,
  types: {
    staff_invitation: true,
    low_stock: true,
    sale_refund: true,
    payment_reminder: true,
    system: true,
  },
};

/** PlatformConfig key namespacing a user's notification preferences. */
function prefsKey(userId: string): string {
  return `notif_prefs:user:${userId}`;
}

function parsePrefs(raw: string | null): typeof DEFAULT_PREFERENCES {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      types: { ...DEFAULT_PREFERENCES.types, ...(parsed.types ?? {}) },
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

// =====================================================
// 1. GET /notifications — list current user's notifications
// =====================================================
notificationRouter.get(
  '/',
  validateQuery(ListQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const q = req.query as unknown as z.infer<typeof ListQuerySchema>;

    const where = {
      userId: req.user.id,
      ...(q.status === 'read' ? { readAt: { not: null } } : {}),
      ...(q.status === 'unread' ? { readAt: null } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...paginate({}, q),
      }),
    ]);

    return sendSuccess(res, { items, meta: pageMeta(total, q) }, 'OK');
  }),
);

// =====================================================
// 2. GET /notifications/unread-count
// =====================================================
notificationRouter.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const count = await prisma.notification.count({
      where: { userId: req.user.id, readAt: null },
    });
    return sendSuccess(res, { count }, 'OK');
  }),
);

// =====================================================
// 3. POST /notifications/:id/read
// =====================================================
notificationRouter.post(
  '/:id/read',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const notif = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!notif) return sendError(res, Errors.notFound('Notification not found'));

    if (!notif.readAt) {
      await prisma.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    }

    return sendSuccess(res, { id, readAt: notif.readAt ?? new Date() }, 'Marked as read');
  }),
);

// =====================================================
// 4. POST /notifications/read-all
// =====================================================
notificationRouter.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return sendSuccess(res, { updated: result.count }, 'All notifications marked as read');
  }),
);

// =====================================================
// 5. DELETE /notifications/:id
// =====================================================
notificationRouter.delete(
  '/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const notif = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!notif) return sendError(res, Errors.notFound('Notification not found'));

    await prisma.notification.delete({ where: { id } });
    return sendSuccess(res, { id }, 'Notification deleted');
  }),
);

// =====================================================
// 6. GET /notifications/preferences
// =====================================================
notificationRouter.get(
  '/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());

    const row = await prisma.platformConfig.findUnique({
      where: { key: prefsKey(req.user.id) },
    });
    return sendSuccess(res, parsePrefs(row?.value ?? null), 'OK');
  }),
);

// =====================================================
// 7. PATCH /notifications/preferences
// =====================================================
const UpdatePreferencesSchema = z.object({
  email: z.boolean().optional(),
  push: z.boolean().optional(),
  sms: z.boolean().optional(),
  types: z.record(z.string(), z.boolean()).optional(),
});

notificationRouter.patch(
  '/preferences',
  validateBody(UpdatePreferencesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const body = req.body as z.infer<typeof UpdatePreferencesSchema>;

    const existing = await prisma.platformConfig.findUnique({
      where: { key: prefsKey(req.user.id) },
    });
    const current = parsePrefs(existing?.value ?? null);
    const next = {
      ...current,
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.push !== undefined ? { push: body.push } : {}),
      ...(body.sms !== undefined ? { sms: body.sms } : {}),
      ...(body.types !== undefined
        ? { types: { ...current.types, ...body.types } }
        : {}),
    };

    if (existing) {
      await prisma.platformConfig.update({
        where: { key: prefsKey(req.user.id) },
        data: { value: JSON.stringify(next) },
      });
    } else {
      await prisma.platformConfig.create({
        data: { key: prefsKey(req.user.id), value: JSON.stringify(next) },
      });
    }

    return sendSuccess(res, next, 'Preferences updated');
  }),
);
