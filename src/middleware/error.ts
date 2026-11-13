import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/errors.js';

/** 404 handler */
export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'Not found', code: 'NOT_FOUND', errors: [] });
}

/** Central error handler. Must be registered last. */
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // Log unexpected errors in dev
  if (process.env.NODE_ENV !== 'production' && !(err.statusCode && err.statusCode < 500)) {
    // eslint-disable-next-line no-console
    console.error('[error]', err);
  }
  return sendError(res, err);
}
