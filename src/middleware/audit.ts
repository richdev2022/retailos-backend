import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/index.js';

/** Write an audit log entry. Non-blocking (fire-and-forget). */
export function audit(opts: {
  action: string;
  resourceType?: string;
  resourceId?: string;
  change?: unknown;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    (res as any).onFinishAudit = () =>
      prisma.auditLog
        .create({
          data: {
            businessId: req.activeBusinessId ?? null,
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
        .catch(() => {/* never throw from audit */});
    next();
  };
}

export interface AuditOnFinish {
  onFinishAudit?: () => Promise<void>;
}

// patch express response type
declare module 'express-serve-static-core' {
  interface Response extends AuditOnFinish {}
}

export function registerAuditFinishHook(req: Request, res: Response) {
  res.on('finish', () => {
    if ((res as any).onFinishAudit) {
      (res as any).onFinishAudit().catch(() => {});
    }
  });
}
