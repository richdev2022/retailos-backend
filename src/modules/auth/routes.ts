import { Router, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { prisma } from '../../db/index.js';
import { config } from '../../config/index.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt.js';
import { generateToken, hashToken } from '../../utils/tokens.js';
import { Errors, asyncHandler, sendSuccess, sendError } from '../../utils/errors.js';
import { validateBody } from '../../middleware/validate.js';
import { seedRbac, BUSINESS_ROLE_TEMPLATES } from '../../utils/rbac.js';
import { ref } from '../../utils/refs.js';

export const authRouter = Router();

// ---- rate limit (separate from global) ----
const authLimiter = rateLimit({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many auth attempts, please try again later.', code: 'RATE_LIMITED', errors: [] },
});
authRouter.use(authLimiter);

// =====================================================
// POST /auth/register
// Body: { fullName, email?, phone, password, acceptedTerms: true }
// =====================================================
const RegisterSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().optional().nullable(),
  phone: z.string().min(6).max(20),
  password: z.string().min(8).max(128),
  acceptedTerms: z.literal(true),
});

authRouter.post(
  '/register',
  validateBody(RegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { fullName, email, phone, password } = req.body as z.infer<typeof RegisterSchema>;

    // Unique email/phone
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email: email ?? undefined }, { phone }] },
    });
    if (existing) {
      return sendError(res, Errors.conflict('A user with this email or phone already exists', 'DUPLICATE_USER'));
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        fullName,
        email: email ?? null,
        phone,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    // Issue tokens
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });
    const accessToken = signAccessToken({ sub: user.id, email: user.email ?? undefined, phone: user.phone ?? undefined, sid: session.id, scope: 'business' });
    const refreshToken = signRefreshToken({ sub: user.id, sid: session.id });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    setRefreshCookie(res, refreshToken);

    return sendSuccess(res, {
      user: sanitizeUser(user),
      accessToken,
      expiresIn: 15 * 60,
    }, 'Account created', 201);
  }),
);

// =====================================================
// POST /auth/login
// Body: { identifier: emailOrPhone, password }
// =====================================================
const LoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(1).max(128),
});

authRouter.post(
  '/login',
  validateBody(LoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { identifier, password } = req.body as z.infer<typeof LoginSchema>;

    const user = await prisma.user.findFirst({
      where: { OR: [{ email: identifier }, { phone: identifier }] },
    });
    if (!user) return sendError(res, Errors.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS'));
    if (user.status !== 'ACTIVE') return sendError(res, Errors.forbidden('Account suspended', 'ACCOUNT_SUSPENDED'));

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) return sendError(res, Errors.unauthorized('Invalid credentials', 'INVALID_CREDENTIALS'));

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent: req.headers['user-agent'] ?? null,
        ipAddress: req.ip ?? null,
      },
    });
    const accessToken = signAccessToken({ sub: user.id, email: user.email ?? undefined, phone: user.phone ?? undefined, sid: session.id, scope: 'business' });
    const refreshToken = signRefreshToken({ sub: user.id, sid: session.id });
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    setRefreshCookie(res, refreshToken);
    return sendSuccess(res, {
      user: sanitizeUser(user),
      accessToken,
      expiresIn: 15 * 60,
    }, 'Login successful');
  }),
);

// =====================================================
// POST /auth/refresh
// =====================================================
authRouter.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const cookieName = config.cookies.refreshTokenName;
    const refreshToken = (req.cookies?.[cookieName] as string) || (req.body?.refreshToken as string);
    if (!refreshToken) return sendError(res, Errors.unauthorized('No refresh token', 'NO_REFRESH_TOKEN'));

    let payload: ReturnType<typeof verifyRefreshToken>;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return sendError(res, Errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN'));
    }
    if (payload.type !== 'refresh') return sendError(res, Errors.unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN'));

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (!stored) return sendError(res, Errors.unauthorized('Refresh token not recognized', 'INVALID_REFRESH_TOKEN'));
    if (stored.revokedAt) return sendError(res, Errors.unauthorized('Refresh token revoked', 'TOKEN_REVOKED'));
    if (stored.expiresAt < new Date()) return sendError(res, Errors.unauthorized('Refresh token expired', 'TOKEN_EXPIRED'));

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const newRefresh = signRefreshToken({ sub: payload.sub, sid: payload.sid });
    await prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        sessionId: payload.sid,
        tokenHash: hashToken(newRefresh),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        rotatedFrom: stored.id,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return sendError(res, Errors.unauthorized('User not found'));
    if (user.status !== 'ACTIVE') return sendError(res, Errors.forbidden('Account suspended'));

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email ?? undefined,
      phone: user.phone ?? undefined,
      sid: payload.sid,
      scope: 'business',
    });

    setRefreshCookie(res, newRefresh);
    return sendSuccess(res, { accessToken, expiresIn: 15 * 60 }, 'Token refreshed');
  }),
);

// =====================================================
// POST /auth/logout — revokes current session
// =====================================================
authRouter.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const cookieName = config.cookies.refreshTokenName;
    const refreshToken = (req.cookies?.[cookieName] as string) || (req.body?.refreshToken as string);
    if (refreshToken) {
      const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(refreshToken) } });
      if (stored) {
        await prisma.refreshToken.update({
          where: { id: stored.id },
          data: { revokedAt: new Date() },
        });
        await prisma.session.update({
          where: { id: stored.sessionId },
          data: { revokedAt: new Date() },
        }).catch(() => {/* session may already be revoked */});
      }
    }
    res.clearCookie(cookieName);
    return sendSuccess(res, null, 'Logged out');
  }),
);

// =====================================================
// POST /auth/logout-all — revokes all sessions for this user
// =====================================================
authRouter.post(
  '/logout-all',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    await prisma.session.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await prisma.refreshToken.updateMany({
      where: { userId: req.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    res.clearCookie(config.cookies.refreshTokenName);
    return sendSuccess(res, null, 'All sessions revoked');
  }),
);

// =====================================================
// POST /auth/forgot-password
// =====================================================
const ForgotSchema = z.object({ identifier: z.string().min(3) });
authRouter.post(
  '/forgot-password',
  validateBody(ForgotSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { identifier } = req.body as z.infer<typeof ForgotSchema>;
    const user = await prisma.user.findFirst({ where: { OR: [{ email: identifier }, { phone: identifier }] } });
    if (!user) {
      // do not leak existence
      return sendSuccess(res, null, 'If the account exists, a reset link has been sent.');
    }
    const token = generateToken();
    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1h
      },
    });
    // No email provider configured; return token in dev (in prod, send via email/SMS)
    if (config.isDev) {
      return sendSuccess(res, { resetToken: token, message: 'DEV: token returned (would be emailed in prod)' }, 'Reset link generated');
    }
    return sendSuccess(res, null, 'If the account exists, a reset link has been sent.');
  }),
);

// =====================================================
// POST /auth/reset-password
// Body: { token, newPassword }
// =====================================================
const ResetSchema = z.object({
  token: z.string().min(20),
  newPassword: z.string().min(8).max(128),
});
authRouter.post(
  '/reset-password',
  validateBody(ResetSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body as z.infer<typeof ResetSchema>;
    const stored = await prisma.passwordReset.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      return sendError(res, Errors.badRequest('Invalid or expired token', 'INVALID_RESET_TOKEN'));
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      prisma.session.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return sendSuccess(res, null, 'Password updated. Please log in again.');
  }),
);

// =====================================================
// GET /auth/me — current user + memberships
// =====================================================
authRouter.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        memberships: {
          include: {
            business: true,
            role: true,
            branch: true,
          },
        },
      },
    });
    if (!user) return sendError(res, Errors.notFound('User not found'));
    return sendSuccess(res, {
      user: sanitizeUser(user),
      memberships: user.memberships.map((m) => ({
        id: m.id,
        businessId: m.businessId,
        businessName: m.business.name,
        roleId: m.roleId,
        roleName: m.role.name,
        branchId: m.branchId,
        branchName: m.branch?.name ?? null,
        status: m.status,
      })),
    }, 'OK');
  }),
);

// =====================================================
// POST /auth/change-password
// =====================================================
const ChangeSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8).max(128),
});
authRouter.post(
  '/change-password',
  validateBody(ChangeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const { currentPassword, newPassword } = req.body as z.infer<typeof ChangeSchema>;
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return sendError(res, Errors.notFound());
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) return sendError(res, Errors.unauthorized('Current password is incorrect', 'INVALID_CURRENT_PASSWORD'));
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return sendSuccess(res, null, 'Password updated');
  }),
);

// =====================================================
// GET /auth/sessions — list active sessions
// =====================================================
authRouter.get(
  '/sessions',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const sessions = await prisma.session.findMany({
      where: { userId: req.user.id, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
    return sendSuccess(res, sessions, 'OK');
  }),
);

// =====================================================
// DELETE /auth/sessions/:id — revoke a specific session
// =====================================================
authRouter.delete(
  '/sessions/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) return sendError(res, Errors.unauthorized());
    const session = await prisma.session.findUnique({ where: { id: req.params.id } });
    if (!session || session.userId !== req.user.id) {
      return sendError(res, Errors.notFound('Session not found'));
    }
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    await prisma.refreshToken.updateMany({
      where: { sessionId: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return sendSuccess(res, null, 'Session revoked');
  }),
);

// =====================================================
// Helpers
// =====================================================
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

function setRefreshCookie(res: Response, token: string) {
  res.cookie(config.cookies.refreshTokenName, token, {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

// Re-export for app.ts
export { ref };
export { BUSINESS_ROLE_TEMPLATES, seedRbac };
