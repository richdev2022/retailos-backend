/**
 * @openapi
 * components:
 *   schemas:
 *     SupportTicket:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         subject: { type: string }
 *         description: { type: string }
 *         category: { type: string, nullable: true }
 *         priority: { type: string, enum: [LOW, NORMAL, HIGH, URGENT], default: NORMAL }
 *         status: { type: string, enum: [OPEN, IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, CLOSED] }
 *         createdById: { type: string, format: uuid }
 *         assignedToId: { type: string, format: uuid, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *         resolvedAt: { type: string, format: date-time, nullable: true }
 *         closedAt: { type: string, format: date-time, nullable: true }
 *     SupportMessage:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         ticketId: { type: string, format: uuid }
 *         senderId: { type: string, format: uuid }
 *         body: { type: string }
 *         attachmentUrl: { type: string, nullable: true }
 *         createdAt: { type: string, format: date-time }
 *
 * /support/tickets:
 *   post:
 *     tags: [Support]
 *     summary: Create a support ticket
 *     description: Regular users may include a businessId (if they belong to one) — admin users can also file platform-level tickets without a businessId.
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject, description]
 *             properties:
 *               subject: { type: string }
 *               description: { type: string }
 *               category: { type: string }
 *               priority: { type: string, enum: [LOW, NORMAL, HIGH, URGENT], default: NORMAL }
 *               businessId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Ticket created }
 *   get:
 *     tags: [Support]
 *     summary: List tickets
 *     description: Regular users see only their own tickets; admin users see all tickets. Filterable by status.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: status, schema: { type: string, enum: [OPEN, IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, CLOSED] } }
 *     responses:
 *       200: { description: Paginated list of tickets }
 *
 * /support/tickets/{id}:
 *   get:
 *     tags: [Support]
 *     summary: Get a single ticket with messages
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Ticket detail with messages }
 *       403: { description: Not authorised to view this ticket }
 *       404: { description: Ticket not found }
 *
 * /support/tickets/{id}/messages:
 *   post:
 *     tags: [Support]
 *     summary: Add a message to a ticket
 *     description: The ticket creator or the assigned admin can reply. Posting a message on a CLOSED ticket re-opens it.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *               attachmentUrl: { type: string }
 *     responses:
 *       201: { description: Message added }
 *       403: { description: Not authorised to reply on this ticket }
 *
 * /support/tickets/{id}/status:
 *   patch:
 *     tags: [Support]
 *     summary: Change a ticket's status
 *     description: The creator may close their own ticket; admin users can change to any status.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [OPEN, IN_PROGRESS, WAITING_FOR_CUSTOMER, RESOLVED, CLOSED] }
 *     responses:
 *       200: { description: Status updated }
 *       403: { description: Only the creator may close the ticket, or admin scope required }
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { type Prisma } from '@prisma/client';

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

export const supportRouter = Router();

// =====================================================
// Helpers / schemas
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

const TicketStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_FOR_CUSTOMER',
  'RESOLVED',
  'CLOSED',
]);

const PriorityEnum = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL');

const CreateTicketSchema = z.object({
  subject: z.string().min(3).max(200),
  description: z.string().min(3).max(10000),
  category: z.string().max(80).optional().nullable(),
  priority: PriorityEnum,
  businessId: z.string().uuid().optional().nullable(),
});

const CreateMessageSchema = z.object({
  body: z.string().min(1).max(10000),
  attachmentUrl: z.string().url().optional().nullable(),
});

const UpdateStatusSchema = z.object({
  status: TicketStatusEnum,
});

const ListQuerySchema = PaginationSchema.extend({
  status: TicketStatusEnum.optional(),
});

/** Is the current request from an admin scope? */
function isAdmin(req: Request): boolean {
  return req.user?.scope === 'admin';
}

/** Fire-and-forget audit log write. Never throws. */
function writeAudit(
  req: Request,
  opts: {
    action: string;
    resourceType: string;
    resourceId: string;
    change?: unknown;
    businessId?: string | null;
  },
) {
  prisma.auditLog
    .create({
      data: {
        businessId: opts.businessId ?? null,
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

/**
 * Authorise a regular (non-admin) user to view/modify a ticket.
 * Allowed if they are the ticket creator OR the assigned admin.
 */
async function canAccessTicket(
  req: Request,
  ticket: { createdById: string; assignedToId: string | null },
): Promise<boolean> {
  if (!req.user) return false;
  if (isAdmin(req)) return true;
  if (ticket.createdById === req.user.id) return true;
  if (ticket.assignedToId && ticket.assignedToId === req.user.id) return true;
  return false;
}

// =====================================================
// 1. POST /support/tickets — create a ticket
// =====================================================
supportRouter.post(
  '/tickets',
  validateBody(CreateTicketSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const body = req.body as z.infer<typeof CreateTicketSchema>;

    // Regular users may only attach a businessId they are a member of.
    if (body.businessId) {
      if (!isAdmin(req)) {
        const membership = await prisma.businessMember.findUnique({
          where: {
            businessId_userId: {
              businessId: body.businessId,
              userId: req.user.id,
            },
          },
        });
        if (!membership) {
          return sendError(
            res,
            Errors.forbidden('Not a member of this business', 'NOT_A_MEMBER'),
          );
        }
      }
      // Sanity: ensure the business exists.
      const biz = await prisma.business.findUnique({
        where: { id: body.businessId },
        select: { id: true },
      });
      if (!biz) return sendError(res, Errors.badRequest('Business not found', 'BUSINESS_NOT_FOUND'));
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        businessId: body.businessId ?? null,
        subject: body.subject,
        description: body.description,
        category: body.category ?? null,
        priority: body.priority,
        status: 'OPEN',
        createdById: req.user.id,
      },
    });

    // Auto-create the first message so the conversation thread has the body.
    await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: req.user.id,
        body: body.description,
      },
    });

    writeAudit(req, {
      action: 'support.ticket.create',
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      change: { subject: ticket.subject, priority: ticket.priority },
      businessId: body.businessId,
    });

    return sendSuccess(res, ticket, 'Ticket created', 201);
  }),
);

// =====================================================
// 2. GET /support/tickets — list tickets
// =====================================================
supportRouter.get(
  '/tickets',
  validateQuery(ListQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const q = req.query as unknown as z.infer<typeof ListQuerySchema>;

    // Regular users see only their own tickets; admins see all.
    const where: Prisma.SupportTicketWhereInput = {
      ...(isAdmin(req) ? {} : { createdById: req.user.id }),
      ...(q.status ? { status: q.status } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          assignedTo: { select: { id: true, fullName: true } },
          business: { select: { id: true, name: true } },
          _count: { select: { messages: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate({}, q),
      }),
    ]);

    return sendSuccess(res, { items, meta: pageMeta(total, q) }, 'OK');
  }),
);

// =====================================================
// 3. GET /support/tickets/:id — single ticket with messages
// =====================================================
supportRouter.get(
  '/tickets/:id',
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
        business: { select: { id: true, name: true } },
        messages: {
          include: {
            sender: { select: { id: true, fullName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!ticket) return sendError(res, Errors.notFound('Ticket not found'));

    const allowed = await canAccessTicket(req, ticket);
    if (!allowed) {
      return sendError(res, Errors.forbidden('Not authorised to view this ticket', 'TICKET_ACCESS_DENIED'));
    }

    return sendSuccess(res, ticket, 'OK');
  }),
);

// =====================================================
// 4. POST /support/tickets/:id/messages — add a message
// =====================================================
supportRouter.post(
  '/tickets/:id/messages',
  validateParams(IdParamsSchema),
  validateBody(CreateMessageSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const body = req.body as z.infer<typeof CreateMessageSchema>;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, createdById: true, assignedToId: true, status: true, businessId: true },
    });
    if (!ticket) return sendError(res, Errors.notFound('Ticket not found'));

    const allowed = await canAccessTicket(req, ticket);
    if (!allowed) {
      return sendError(
        res,
        Errors.forbidden('Only the ticket creator or assignee may reply', 'TICKET_ACCESS_DENIED'),
      );
    }

    const message = await prisma.supportMessage.create({
      data: {
        ticketId: ticket.id,
        senderId: req.user.id,
        body: body.body,
        attachmentUrl: body.attachmentUrl ?? null,
      },
      include: { sender: { select: { id: true, fullName: true } } },
    });

    // If the ticket was CLOSED or RESOLVED and the customer replies, re-open it.
    if (
      (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') &&
      req.user.id === ticket.createdById
    ) {
      await prisma.supportTicket.update({
        where: { id: ticket.id },
        data: { status: 'WAITING_FOR_CUSTOMER', closedAt: null, resolvedAt: null },
      });
    }

    writeAudit(req, {
      action: 'support.message.create',
      resourceType: 'support_message',
      resourceId: message.id,
      change: { ticketId: ticket.id },
      businessId: ticket.businessId,
    });

    return sendSuccess(res, message, 'Message added', 201);
  }),
);

// =====================================================
// 5. PATCH /support/tickets/:id/status — change status
// =====================================================
supportRouter.patch(
  '/tickets/:id/status',
  validateParams(IdParamsSchema),
  validateBody(UpdateStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const { status } = req.body as z.infer<typeof UpdateStatusSchema>;

    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { id: true, createdById: true, assignedToId: true, status: true, businessId: true },
    });
    if (!ticket) return sendError(res, Errors.notFound('Ticket not found'));

    const admin = isAdmin(req);
    const isCreator = ticket.createdById === req.user.id;

    // Creators may only CLOSE their own ticket; admins can change to any status.
    if (!admin) {
      if (!isCreator) {
        return sendError(
          res,
          Errors.forbidden('Only the ticket creator may close the ticket', 'TICKET_ACCESS_DENIED'),
        );
      }
      if (status !== 'CLOSED') {
        return sendError(
          res,
          Errors.forbidden('Non-admin creators may only close their tickets', 'TICKET_STATUS_DENIED'),
        );
      }
    }

    const now = new Date();
    const data: any = { status };
    if (status === 'CLOSED') data.closedAt = now;
    if (status === 'RESOLVED') data.resolvedAt = now;
    if (status === 'OPEN' || status === 'IN_PROGRESS' || status === 'WAITING_FOR_CUSTOMER') {
      data.resolvedAt = null;
      data.closedAt = null;
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data,
    });

    writeAudit(req, {
      action: 'support.ticket.status_change',
      resourceType: 'support_ticket',
      resourceId: ticket.id,
      change: { from: ticket.status, to: status },
      businessId: ticket.businessId,
    });

    return sendSuccess(res, updated, 'Status updated');
  }),
);
