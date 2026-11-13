/**
 * @openapi
 * components:
 *   schemas:
 *     StaffInvitation:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         email: { type: string, nullable: true }
 *         phone: { type: string, nullable: true }
 *         roleId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         invitedById: { type: string, format: uuid }
 *         status: { type: string, enum: [PENDING, ACCEPTED, EXPIRED, REVOKED] }
 *         acceptedByUserId: { type: string, format: uuid, nullable: true }
 *         expiresAt: { type: string, format: date-time }
 *         createdAt: { type: string, format: date-time }
 *         token: { type: string, description: "Raw invitation token — returned ONLY at creation time, never on subsequent reads." }
 *     BusinessMember:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         businessId: { type: string, format: uuid }
 *         userId: { type: string, format: uuid }
 *         roleId: { type: string, format: uuid }
 *         branchId: { type: string, format: uuid, nullable: true }
 *         invitedById: { type: string, format: uuid, nullable: true }
 *         status: { type: string, enum: [ACTIVE, PENDING, SUSPENDED, REVOKED] }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     Role:
 *       type: object
 *       properties:
 *         id: { type: string, format: uuid }
 *         name: { type: string }
 *         businessId: { type: string, format: uuid, nullable: true }
 *         scope: { type: string, enum: [BUSINESS, ADMIN] }
 *         description: { type: string, nullable: true }
 *         isSystem: { type: boolean }
 *         permissions: { type: array, items: { type: string } }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *
 * /staff/invitations:
 *   post:
 *     tags: [Staff]
 *     summary: Invite a staff member
 *     description: Generates a single-use invitation token, persists the invitation (hashed token, 7-day expiry), and notifies the invitee if they already have an account (matched by email or phone). The raw token is returned ONCE — the inviter must share it out-of-band.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId]
 *             properties:
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               roleId: { type: string, format: uuid }
 *               branchId: { type: string, format: uuid }
 *     responses:
 *       201: { description: Invitation created }
 *       400: { description: Neither email nor phone provided, or role not in this business }
 *   get:
 *     tags: [Staff]
 *     summary: List pending invitations
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: List of invitations }
 *
 * /staff/invitations/{id}/revoke:
 *   post:
 *     tags: [Staff]
 *     summary: Revoke a pending invitation
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Invitation revoked }
 *       404: { description: Invitation not found }
 *
 * /staff/accept-invitation:
 *   post:
 *     tags: [Staff]
 *     summary: Accept a staff invitation
 *     description: Validates the token (hash lookup, not expired, not used). If the invited user does not exist, creates them with the provided password. Otherwise attaches the membership. Returns a fresh access token (login).
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string }
 *               fullName: { type: string, description: "Required if creating a new user" }
 *               password: { type: string, description: "Required if creating a new user" }
 *     responses:
 *       200: { description: Membership attached; access token issued }
 *       400: { description: Invalid, expired, or already-used token }
 *
 * /staff/roles:
 *   get:
 *     tags: [Staff]
 *     summary: List available roles (system templates + business custom roles)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: List of roles }
 *   post:
 *     tags: [Staff]
 *     summary: Create a custom business role
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, permissions]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *     responses:
 *       201: { description: Role created }
 *
 * /staff/roles/{id}:
 *   patch:
 *     tags: [Staff]
 *     summary: Update a custom role's permissions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               permissions: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Role updated }
 *       403: { description: Cannot modify a system role }
 *
 * /staff/permissions:
 *   get:
 *     tags: [Staff]
 *     summary: List all permission codes grouped by module
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Permissions grouped by module }
 *
 * /staff:
 *   get:
 *     tags: [Staff]
 *     summary: List active staff
 *     description: Paginated list of active business members with role + branch info.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: query, name: page, schema: { type: integer, default: 1 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 20 } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [ACTIVE, SUSPENDED, REVOKED] } }
 *     responses:
 *       200: { description: Paginated staff list }
 *
 * /staff/{id}:
 *   get:
 *     tags: [Staff]
 *     summary: Get a single staff member with role + permissions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Staff detail }
 *       404: { description: Not found }
 *
 * /staff/{id}/role:
 *   patch:
 *     tags: [Staff]
 *     summary: Change a staff member's role
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [roleId]
 *             properties:
 *               roleId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Role updated }
 *
 * /staff/{id}/suspend:
 *   post:
 *     tags: [Staff]
 *     summary: Suspend a staff member and revoke their sessions
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Staff suspended }
 *
 * /staff/{id}/reactivate:
 *   post:
 *     tags: [Staff]
 *     summary: Reactivate a suspended staff member
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Staff reactivated }
 *
 * /staff/{id}/reset-access:
 *   post:
 *     tags: [Staff]
 *     summary: Revoke all of a staff member's sessions (forces re-login)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Sessions revoked }
 *
 * /staff/{id}/activity:
 *   get:
 *     tags: [Staff]
 *     summary: Recent audit log entries for this staff member
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: header, name: X-Business-Id, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *     responses:
 *       200: { description: Audit log entries }
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { type Prisma } from '@prisma/client';

import { prisma, type Tx } from '../../db/index.js';
import { config } from '../../config/index.js';
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
import { tenantContext } from '../../middleware/tenant.js';
import { requirePermission } from '../../middleware/auth.js';
import { generateToken, hashToken } from '../../utils/tokens.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken } from '../../utils/jwt.js';
import { PERM } from '../../utils/rbac.js';
import {
  paginate,
  pageMeta,
  PaginationSchema,
  searchClause,
} from '../../utils/pagination.js';

// =====================================================
// Router setup
// =====================================================

export const staffRouter = Router();

// All staff routes EXCEPT /accept-invitation are tenant-scoped.
// /accept-invitation is intentionally NOT tenant-scoped (a user accepting
// an invitation may not yet have an active business).
staffRouter.use((req: Request, res: Response, next: NextFunction) => {
  // The router-relative path (e.g. "/accept-invitation").
  if (req.path === '/accept-invitation' || req.path.startsWith('/accept-invitation/')) {
    return next();
  }
  return tenantContext(req, res, next);
});

// =====================================================
// Helpers
// =====================================================

const IdParamsSchema = z.object({ id: z.string().uuid() });

/** Fire-and-forget audit log write. Never throws. */
function writeAudit(
  req: Request,
  opts: {
    action: string;
    resourceType: string;
    resourceId: string;
    change?: unknown;
    businessId?: string;
  },
) {
  const businessId = opts.businessId ?? req.activeBusinessId;
  prisma.auditLog
    .create({
      data: {
        businessId: businessId ?? null,
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

/** Sanitize a user for response payloads (never leak passwordHash). */
function sanitizeUser(u: any) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    status: u.status,
    emailVerifiedAt: u.emailVerifiedAt,
    phoneVerifiedAt: u.phoneVerifiedAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/** Build the webapp invitation URL — out-of-band sharing handled by inviter. */
function invitationUrl(token: string): string {
  return `${config.urls.webapp}/invite?token=${encodeURIComponent(token)}`;
}

/** Strip the tokenHash from a StaffInvitation row before serialising. */
function stripTokenHash<T extends { tokenHash?: string }>(row: T): Omit<T, 'tokenHash'> {
  const { tokenHash: _th, ...rest } = row;
  return rest;
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// =====================================================
// Schemas
// =====================================================

const CreateInvitationSchema = z
  .object({
    email: z.string().email().optional().nullable(),
    phone: z.string().min(6).max(20).optional().nullable(),
    roleId: z.string().uuid(),
    branchId: z.string().uuid().optional().nullable(),
  })
  .refine((v) => v.email || v.phone, {
    message: 'At least one of email or phone must be provided',
    path: ['email'],
  });

const AcceptInvitationSchema = z.object({
  token: z.string().min(20),
  fullName: z.string().min(2).max(120).optional(),
  password: z.string().min(8).max(128).optional(),
});

const ListStaffQuerySchema = PaginationSchema.extend({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REVOKED', 'PENDING']).optional(),
});

const ActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const ChangeRoleSchema = z.object({
  roleId: z.string().uuid(),
});

const CreateRoleSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(z.string().min(2).max(80)).min(1),
});

const UpdateRoleSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(z.string().min(2).max(80)).optional(),
});

// =====================================================
// IMPORTANT: register named sub-paths (invitations, accept-invitation,
// roles, permissions) BEFORE the /:id wildcard routes, otherwise Express
// would match `/staff/roles` against `/staff/:id`.
// =====================================================

// =====================================================
// 1. POST /staff/invitations — invite a staff member
// =====================================================
staffRouter.post(
  '/invitations',
  requirePermission('staff:manage'),
  validateBody(CreateInvitationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateInvitationSchema>;

    // Validate role belongs to this business (or is a system role).
    const role = await prisma.role.findFirst({
      where: {
        id: body.roleId,
        OR: [{ businessId: bizId }, { isSystem: true, scope: 'BUSINESS' }],
      },
    });
    if (!role) {
      return sendError(res, Errors.badRequest('Role not found in this business', 'ROLE_NOT_FOUND'));
    }

    // Validate branch (if provided) belongs to this business.
    if (body.branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: body.branchId, businessId: bizId },
      });
      if (!branch) {
        return sendError(res, Errors.badRequest('Branch not found in this business', 'BRANCH_NOT_FOUND'));
      }
    }

    // Look up an existing user by email or phone — used for the in-app notification.
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email: body.email ?? undefined }, { phone: body.phone ?? undefined }],
      },
    });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = await prisma.staffInvitation.create({
      data: {
        businessId: bizId,
        email: body.email ?? null,
        phone: body.phone ?? null,
        roleId: role.id,
        branchId: body.branchId ?? null,
        invitedById: req.user!.id,
        tokenHash: hashToken(token),
        status: 'PENDING',
        expiresAt,
      },
      include: { role: true },
    });

    // Notify the invitee in-app if they already have an account.
    if (existingUser) {
      const business = await prisma.business.findUnique({
        where: { id: bizId },
        select: { name: true },
      });
      await prisma.notification
        .create({
          data: {
            businessId: bizId,
            userId: existingUser.id,
            type: 'staff_invitation',
            title: `Invitation to join ${business?.name ?? 'a business'}`,
            message: `You have been invited to join ${business?.name ?? 'a business'} as ${role.name}. Use the invitation link to accept.`,
            payload: {
              invitationId: invitation.id,
              roleName: role.name,
              inviteUrl: invitationUrl(token),
            },
          },
        })
        .catch(() => {
          /* non-critical */
        });
    }

    writeAudit(req, {
      action: 'staff.invitation.create',
      resourceType: 'staff_invitation',
      resourceId: invitation.id,
      change: { email: body.email, phone: body.phone, roleId: role.id, branchId: body.branchId },
    });

    return sendSuccess(
      res,
      {
        ...stripTokenHash(invitation),
        // Token is returned ONCE at creation — subsequent reads do not expose it.
        token,
        inviteUrl: invitationUrl(token),
      },
      'Invitation created',
      201,
    );
  }),
);

// =====================================================
// 2. GET /staff/invitations — list pending invitations
// =====================================================
staffRouter.get(
  '/invitations',
  requirePermission('staff:manage'),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const invitations = await prisma.staffInvitation.findMany({
      where: { businessId: bizId, status: 'PENDING' },
      include: { role: true },
      orderBy: { createdAt: 'desc' },
    });
    // Never expose tokenHash or token on reads.
    const safe = invitations.map(stripTokenHash);
    return sendSuccess(res, safe, 'OK');
  }),
);

// =====================================================
// 3. POST /staff/invitations/:id/revoke
// =====================================================
staffRouter.post(
  '/invitations/:id/revoke',
  requirePermission('staff:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const invitation = await prisma.staffInvitation.findFirst({
      where: { id, businessId: bizId },
    });
    if (!invitation) return sendError(res, Errors.notFound('Invitation not found'));
    if (invitation.status !== 'PENDING') {
      return sendError(
        res,
        Errors.badRequest(`Invitation already ${invitation.status}`, 'INVITATION_NOT_PENDING'),
      );
    }

    const updated = await prisma.staffInvitation.update({
      where: { id },
      data: { status: 'REVOKED' },
      include: { role: true },
    });

    writeAudit(req, {
      action: 'staff.invitation.revoke',
      resourceType: 'staff_invitation',
      resourceId: id,
    });

    return sendSuccess(res, stripTokenHash(updated), 'Invitation revoked');
  }),
);

// =====================================================
// 4. POST /staff/accept-invitation — accept invitation (auth only, no tenant)
// =====================================================
staffRouter.post(
  '/accept-invitation',
  validateBody(AcceptInvitationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const { token, fullName, password } = req.body as z.infer<typeof AcceptInvitationSchema>;

    // Validate token by hash.
    const invitation = await prisma.staffInvitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { role: true },
    });
    if (!invitation) return sendError(res, Errors.badRequest('Invalid invitation token', 'INVALID_TOKEN'));
    if (invitation.status === 'ACCEPTED')
      return sendError(res, Errors.badRequest('Invitation already used', 'INVITATION_USED'));
    if (invitation.status === 'REVOKED')
      return sendError(res, Errors.badRequest('Invitation revoked', 'INVITATION_REVOKED'));
    if (invitation.expiresAt < new Date()) {
      // Mark expired for hygiene.
      await prisma.staffInvitation
        .update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } })
        .catch(() => {});
      return sendError(res, Errors.badRequest('Invitation has expired', 'INVITATION_EXPIRED'));
    }

    // Resolve the user: existing account (matched by email/phone) OR the currently-authenticated user.
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: req.user.id },
          { email: invitation.email ?? undefined },
          { phone: invitation.phone ?? undefined },
        ],
      },
    });

    // If the invited user does not exist, create them now.
    // Requires fullName + password (the inviter shared the token out-of-band,
    // and the invitee provides their own credentials on acceptance).
    if (!user) {
      if (!fullName || !password) {
        return sendError(
          res,
          Errors.badRequest(
            'fullName and password are required to create a new account',
            'NEW_USER_DETAILS_REQUIRED',
          ),
        );
      }
      const passwordHash = await hashPassword(password);
      user = await prisma.user.create({
        data: {
          fullName,
          email: invitation.email ?? null,
          phone: invitation.phone ?? null,
          passwordHash,
          status: 'ACTIVE',
        },
      });
    }

    // Idempotency: if a membership already exists, just re-activate it.
    const existingMembership = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: invitation.businessId, userId: user.id } },
    });

    const result = await prisma.$transaction(async (tx: Tx) => {
      const membership = existingMembership
        ? await tx.businessMember.update({
            where: { id: existingMembership.id },
            data: {
              roleId: invitation.roleId,
              branchId: invitation.branchId,
              status: 'ACTIVE',
              invitedById: invitation.invitedById,
            },
          })
        : await tx.businessMember.create({
            data: {
              businessId: invitation.businessId,
              userId: user!.id,
              roleId: invitation.roleId,
              branchId: invitation.branchId,
              invitedById: invitation.invitedById,
              status: 'ACTIVE',
            },
          });

      const updatedInvitation = await tx.staffInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED', acceptedByUserId: user!.id },
      });

      return { membership, updatedInvitation };
    });

    // Issue a fresh session + access token for the (possibly just-created) user.
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      sid: session.id,
      scope: 'business',
      biz: invitation.businessId,
      branch: invitation.branchId ?? undefined,
    });
    const refreshToken = signRefreshToken({ sub: user.id, sid: session.id });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.user
      .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {
        /* non-critical */
      });

    // Fire-and-forget audit logs (one for the membership creation, one for invitation acceptance).
    prisma.auditLog
      .create({
        data: {
          businessId: invitation.businessId,
          actorId: req.user.id,
          action: 'staff.member.create',
          resourceType: 'business_member',
          resourceId: result.membership.id,
          change: { userId: user.id, roleId: invitation.roleId },
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      })
      .catch(() => {});
    prisma.auditLog
      .create({
        data: {
          businessId: invitation.businessId,
          actorId: req.user.id,
          action: 'staff.invitation.accept',
          resourceType: 'staff_invitation',
          resourceId: invitation.id,
          ipAddress: req.ip ?? null,
          userAgent: req.headers['user-agent'] ?? null,
        },
      })
      .catch(() => {});

    return sendSuccess(
      res,
      {
        user: sanitizeUser(user),
        membership: result.membership,
        businessId: invitation.businessId,
        accessToken,
        refreshToken,
        expiresIn: 15 * 60,
      },
      'Invitation accepted',
    );
  }),
);

// =====================================================
// 5. GET /staff/roles — list available roles
// =====================================================
staffRouter.get(
  '/roles',
  requirePermission('staff:view'),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;

    const roles = await prisma.role.findMany({
      where: {
        scope: 'BUSINESS',
        OR: [{ businessId: bizId }, { isSystem: true }],
      },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    const safe = roles.map((r) => ({
      id: r.id,
      name: r.name,
      businessId: r.businessId,
      scope: r.scope,
      description: r.description,
      isSystem: r.isSystem,
      permissions: r.permissions.map((rp) => rp.permission.code),
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return sendSuccess(res, safe, 'OK');
  }),
);

// =====================================================
// 6. POST /staff/roles — create custom role
// =====================================================
staffRouter.post(
  '/roles',
  requirePermission('staff:manage'),
  validateBody(CreateRoleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const body = req.body as z.infer<typeof CreateRoleSchema>;

    // Validate permission codes exist.
    const perms = await prisma.permission.findMany({
      where: { code: { in: body.permissions } },
    });
    const foundCodes = new Set(perms.map((p) => p.code));
    const missing = body.permissions.filter((c) => !foundCodes.has(c));
    if (missing.length > 0) {
      return sendError(
        res,
        Errors.badRequest(`Unknown permission codes: ${missing.join(', ')}`, 'UNKNOWN_PERMISSIONS'),
      );
    }

    const role = await prisma.role.create({
      data: {
        businessId: bizId,
        name: body.name,
        description: body.description ?? null,
        scope: 'BUSINESS',
        isSystem: false,
        permissions: {
          create: perms.map((p) => ({ permissionId: p.id })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    writeAudit(req, {
      action: 'staff.role.create',
      resourceType: 'role',
      resourceId: role.id,
      change: { name: body.name, permissions: body.permissions },
    });

    return sendSuccess(
      res,
      {
        ...role,
        permissions: role.permissions.map((rp) => rp.permission.code),
      },
      'Role created',
      201,
    );
  }),
);

// =====================================================
// 7. PATCH /staff/roles/:id — update role permissions
// =====================================================
staffRouter.patch(
  '/roles/:id',
  requirePermission('staff:manage'),
  validateParams(IdParamsSchema),
  validateBody(UpdateRoleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const body = req.body as z.infer<typeof UpdateRoleSchema>;

    const role = await prisma.role.findFirst({ where: { id, businessId: bizId } });
    if (!role) return sendError(res, Errors.notFound('Role not found'));
    if (role.isSystem) {
      return sendError(
        res,
        Errors.forbidden('System roles cannot be modified', 'CANNOT_MODIFY_SYSTEM_ROLE'),
      );
    }

    // Validate new permission codes if provided.
    let permIds: string[] | undefined;
    if (body.permissions) {
      const perms = await prisma.permission.findMany({
        where: { code: { in: body.permissions } },
      });
      const foundCodes = new Set(perms.map((p) => p.code));
      const missing = body.permissions.filter((c) => !foundCodes.has(c));
      if (missing.length > 0) {
        return sendError(
          res,
          Errors.badRequest(`Unknown permission codes: ${missing.join(', ')}`, 'UNKNOWN_PERMISSIONS'),
        );
      }
      permIds = perms.map((p) => p.id);
    }

    const updated = await prisma.$transaction(async (tx: Tx) => {
      if (permIds) {
        // Replace all role permissions.
        await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
        await tx.rolePermission.createMany({
          data: permIds.map((pid) => ({ roleId: role.id, permissionId: pid })),
        });
      }
      return tx.role.update({
        where: { id: role.id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
        },
      });
    });

    writeAudit(req, {
      action: 'staff.role.update',
      resourceType: 'role',
      resourceId: role.id,
      change: body,
    });

    return sendSuccess(res, updated, 'Role updated');
  }),
);

// =====================================================
// 8. GET /staff/permissions — permission codes grouped by module
// =====================================================
staffRouter.get(
  '/permissions',
  requirePermission('staff:view'),
  asyncHandler(async (_req: Request, res: Response) => {
    const perms = await prisma.permission.findMany({
      where: { module: { not: 'admin' } },
      orderBy: { code: 'asc' },
    });

    const grouped: Record<string, Array<{ code: string; description: string | null }>> = {};
    for (const p of perms) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push({ code: p.code, description: p.description });
    }

    // Fall back to the static PERM map if the permissions table is empty (e.g. pre-seed).
    if (perms.length === 0) {
      for (const code of Object.values(PERM)) {
        const mod = code.split(':')[0];
        if (!grouped[mod]) grouped[mod] = [];
        grouped[mod].push({ code, description: code });
      }
    }

    return sendSuccess(res, grouped, 'OK');
  }),
);

// =====================================================
// 9. GET /staff — list active staff
// =====================================================
staffRouter.get(
  '/',
  requirePermission('staff:view'),
  validateQuery(ListStaffQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const q = req.query as unknown as z.infer<typeof ListStaffQuerySchema>;

    const where: Prisma.BusinessMemberWhereInput = {
      businessId: bizId,
      ...(q.status ? { status: q.status } : { status: { in: ['ACTIVE', 'SUSPENDED'] } }),
      ...(q.search
        ? searchClause(q.search, ['user.fullName', 'user.email', 'user.phone'])
        : {}),
    };

    const [total, members] = await Promise.all([
      prisma.businessMember.count({ where }),
      prisma.businessMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              status: true,
              lastLoginAt: true,
            },
          },
          role: { select: { id: true, name: true, isSystem: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        ...paginate({}, q),
      }),
    ]);

    return sendSuccess(res, { items: members, meta: pageMeta(total, q) }, 'OK');
  }),
);

// =====================================================
// 10. GET /staff/:id — single staff member with role + permissions
// =====================================================
staffRouter.get(
  '/:id',
  requirePermission('staff:view'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const member = await prisma.businessMember.findFirst({
      where: { id, businessId: bizId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
          },
        },
        role: { include: { permissions: { include: { permission: true } } } },
        branch: { select: { id: true, name: true } },
      },
    });
    if (!member) return sendError(res, Errors.notFound('Staff member not found'));

    return sendSuccess(
      res,
      {
        ...member,
        role: {
          ...member.role,
          permissions: member.role.permissions.map((rp) => rp.permission.code),
        },
      },
      'OK',
    );
  }),
);

// =====================================================
// 11. PATCH /staff/:id/role — change role
// =====================================================
staffRouter.patch(
  '/:id/role',
  requirePermission('staff:manage'),
  validateParams(IdParamsSchema),
  validateBody(ChangeRoleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const { roleId } = req.body as z.infer<typeof ChangeRoleSchema>;

    const member = await prisma.businessMember.findFirst({
      where: { id, businessId: bizId },
    });
    if (!member) return sendError(res, Errors.notFound('Staff member not found'));

    const role = await prisma.role.findFirst({
      where: {
        id: roleId,
        OR: [{ businessId: bizId }, { isSystem: true, scope: 'BUSINESS' }],
      },
    });
    if (!role)
      return sendError(res, Errors.badRequest('Role not found in this business', 'ROLE_NOT_FOUND'));

    const updated = await prisma.businessMember.update({
      where: { id },
      data: { roleId },
      include: { role: { select: { id: true, name: true } } },
    });

    writeAudit(req, {
      action: 'staff.role.update',
      resourceType: 'business_member',
      resourceId: id,
      change: { fromRoleId: member.roleId, toRoleId: roleId },
    });

    return sendSuccess(res, updated, 'Role updated');
  }),
);

// =====================================================
// 12. POST /staff/:id/suspend — suspend + revoke sessions
// =====================================================
staffRouter.post(
  '/:id/suspend',
  requirePermission('staff:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const member = await prisma.businessMember.findFirst({
      where: { id, businessId: bizId },
    });
    if (!member) return sendError(res, Errors.notFound('Staff member not found'));
    if (member.status === 'SUSPENDED') {
      return sendError(res, Errors.badRequest('Staff member is already suspended', 'ALREADY_SUSPENDED'));
    }

    await prisma.$transaction([
      prisma.businessMember.update({
        where: { id },
        data: { status: 'SUSPENDED' },
      }),
      // Revoke all active sessions for this user.
      prisma.session.updateMany({
        where: { userId: member.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: member.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    writeAudit(req, {
      action: 'staff.suspend',
      resourceType: 'business_member',
      resourceId: id,
    });

    return sendSuccess(res, { id, status: 'SUSPENDED' }, 'Staff member suspended');
  }),
);

// =====================================================
// 13. POST /staff/:id/reactivate — reactivate
// =====================================================
staffRouter.post(
  '/:id/reactivate',
  requirePermission('staff:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const member = await prisma.businessMember.findFirst({
      where: { id, businessId: bizId },
    });
    if (!member) return sendError(res, Errors.notFound('Staff member not found'));

    const updated = await prisma.businessMember.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    writeAudit(req, {
      action: 'staff.reactivate',
      resourceType: 'business_member',
      resourceId: id,
    });

    return sendSuccess(res, updated, 'Staff member reactivated');
  }),
);

// =====================================================
// 14. POST /staff/:id/reset-access — revoke all sessions
// =====================================================
staffRouter.post(
  '/:id/reset-access',
  requirePermission('staff:manage'),
  validateParams(IdParamsSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;

    const member = await prisma.businessMember.findFirst({
      where: { id, businessId: bizId },
    });
    if (!member) return sendError(res, Errors.notFound('Staff member not found'));

    const result = await prisma.$transaction([
      prisma.session.updateMany({
        where: { userId: member.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: member.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    writeAudit(req, {
      action: 'staff.reset_access',
      resourceType: 'business_member',
      resourceId: id,
      change: { sessionsRevoked: result[0].count },
    });

    return sendSuccess(res, { id, sessionsRevoked: result[0].count }, 'All sessions revoked');
  }),
);

// =====================================================
// 15. GET /staff/:id/activity — recent audit log entries
// =====================================================
staffRouter.get(
  '/:id/activity',
  requirePermission('staff:view'),
  validateParams(IdParamsSchema),
  validateQuery(ActivityQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const bizId = req.activeBusinessId!;
    const { id } = req.params as z.infer<typeof IdParamsSchema>;
    const { limit } = req.query as unknown as z.infer<typeof ActivityQuerySchema>;

    // Resolve the member to get userId for filtering audit logs.
    const member = await prisma.businessMember.findFirst({
      where: { id, businessId: bizId },
      select: { userId: true },
    });
    if (!member) return sendError(res, Errors.notFound('Staff member not found'));

    const entries = await prisma.auditLog.findMany({
      where: { businessId: bizId, actorId: member.userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return sendSuccess(res, entries, 'OK');
  }),
);
