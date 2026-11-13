import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, AccessTokenPayload } from '../utils/jwt.js';
import { Errors } from '../utils/errors.js';
import { prisma } from '../db/index.js';

declare global {
  // eslint-disable-next-line no-var
  var __auth: undefined;
}

// Augment Express Request to carry the authenticated user
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    activeBusinessId?: string;
    activeBranchId?: string;
  }
}

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  phone?: string | null;
  fullName: string;
  status: string;
  scope?: 'business' | 'admin';
  sessionId?: string;
}

/**
 * Bearer token auth. Reads Authorization: Bearer <access-token>.
 * Optionally accepts the active business id via X-Business-Id header
 * or `biz` claim in the token.
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const m = /^Bearer\s+(.+)$/i.exec(header);
    if (!m) return next(Errors.unauthorized('Missing bearer token'));
    const token = m[1];

    let payload: AccessTokenPayload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      return next(Errors.unauthorized('Invalid or expired token'));
    }
    if (payload.type !== 'access') return next(Errors.unauthorized('Wrong token type'));

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return next(Errors.unauthorized('User not found'));
    if (user.status !== 'ACTIVE') return next(Errors.unauthorized('Account suspended or deactivated'));

    req.user = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      status: user.status,
      scope: payload.scope,
      sessionId: payload.sid,
    };

    // Active business: header first, then token claim
    const bizHeader = req.headers['x-business-id'] as string | undefined;
    req.activeBusinessId = bizHeader || payload.biz;
    const branchHeader = req.headers['x-branch-id'] as string | undefined;
    req.activeBranchId = branchHeader || payload.branch;

    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth — attaches user if token present, but does not fail. */
export async function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(header);
  if (!m) return next();
  try {
    const payload = verifyAccessToken(m[1]);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (user && user.status === 'ACTIVE') {
      req.user = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        fullName: user.fullName,
        status: user.status,
        scope: payload.scope,
      };
      req.activeBusinessId = payload.biz;
      req.activeBranchId = payload.branch;
    }
  } catch {
    // ignore
  }
  next();
}

/** Require a specific permission in the active business context. */
export function requirePermission(permCode: string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(Errors.unauthorized());
      const biz = req.activeBusinessId;
      if (!biz) return next(Errors.badRequest('No active business. Set X-Business-Id header.', 'NO_ACTIVE_BUSINESS'));

      const member = await prisma.businessMember.findUnique({
        where: { businessId_userId: { businessId: biz, userId: req.user.id } },
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      });
      if (!member || member.status !== 'ACTIVE') {
        return next(Errors.forbidden('Not a member of this business', 'NOT_A_MEMBER'));
      }

      const codes = member.role.permissions.map((rp) => rp.permission.code);
      const has =
        codes.includes(permCode) ||
        codes.includes('admin:*') ||
        codes.some((c) => c.endsWith(':*') && permCode.startsWith(c.slice(0, -1)));

      if (!has) return next(Errors.forbidden(`Missing permission: ${permCode}`, 'MISSING_PERMISSION'));

      // Branch scoping: if branch header set, ensure member has access
      if (req.activeBranchId && member.branchId && member.branchId !== req.activeBranchId) {
        return next(Errors.forbidden('Not assigned to this branch', 'BRANCH_NOT_ALLOWED'));
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Require admin scope (admin portal access). */
export function requireAdmin(permCode = 'admin:*') {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.user) return next(Errors.unauthorized());
      if (req.user.scope !== 'admin') return next(Errors.forbidden('Admin scope required', 'ADMIN_REQUIRED'));

      // Look up admin role membership (user is a member of a synthetic business=platform? Or use a separate table)
      // For simplicity, we store admin role on user via BusinessMember with businessId = null.
      const adminMembership = await prisma.businessMember.findFirst({
        where: { userId: req.user.id, business: { id: '__platform__' as any } },
      }).catch(() => null);

      // Lightweight admin check: stored in PlatformConfig as JSON list
      const adminConfig = await prisma.platformConfig.findUnique({ where: { key: 'admin_users' } });
      const adminUserIds: string[] = adminConfig ? JSON.parse(adminConfig.value) : [];
      if (!adminUserIds.includes(req.user.id)) {
        return next(Errors.forbidden('Not an administrator', 'NOT_ADMIN'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Require active business to be set on the request. */
export function requireActiveBusiness(req: Request, _res: Response, next: NextFunction) {
  if (!req.activeBusinessId) {
    return next(Errors.badRequest('No active business. Set X-Business-Id header.', 'NO_ACTIVE_BUSINESS'));
  }
  next();
}
