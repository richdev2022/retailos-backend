import type { Response } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message: string, code = 'BAD_REQUEST', details?: unknown) =>
    new AppError(400, message, code, details),
  unauthorized: (message = 'Unauthorized', code = 'UNAUTHORIZED') =>
    new AppError(401, message, code),
  forbidden: (message = 'Forbidden', code = 'FORBIDDEN') =>
    new AppError(403, message, code),
  notFound: (message = 'Resource not found', code = 'NOT_FOUND') =>
    new AppError(404, message, code),
  conflict: (message = 'Conflict', code = 'CONFLICT') =>
    new AppError(409, message, code),
  unprocessable: (message: string, code = 'UNPROCESSABLE', details?: unknown) =>
    new AppError(422, message, code, details),
  insufficientStock: (message = 'Insufficient stock') =>
    new AppError(409, message, 'INSUFFICIENT_STOCK'),
  entitlement: (message = 'Plan limit exceeded') =>
    new AppError(403, message, 'ENTITLEMENT_EXCEEDED'),
  rateLimited: (message = 'Too many requests') =>
    new AppError(429, message, 'RATE_LIMITED'),
  internal: (message = 'Internal server error') =>
    new AppError(500, message, 'INTERNAL_ERROR'),
};

export function successResponse<T>(data: T, message = 'OK') {
  return { success: true, message, data };
}

export function errorResponse(message: string, code = 'INTERNAL_ERROR', errors: unknown[] = []) {
  return { success: false, message, code, errors };
}

export function sendSuccess<T>(res: Response, data: T, message = 'OK', status = 200) {
  return res.status(status).json(successResponse(data, message));
}

export function sendError(
  res: Response,
  err: unknown,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json(errorResponse(err.message, err.code, err.details ? [err.details] : []));
  }
  // Zod errors
  if (err && typeof err === 'object' && 'name' in err && (err as any).name === 'ZodError') {
    const z = err as any;
    return res.status(400).json(errorResponse('Validation failed', 'VALIDATION_ERROR', z.issues || z.errors));
  }
  // Prisma known errors
  if (err && typeof err === 'object' && 'code' in err && (err as any).code?.startsWith('P')) {
    const p = err as any;
    if (p.code === 'P2002') {
      return res.status(409).json(errorResponse('A record with this value already exists', 'DUPLICATE'));
    }
    if (p.code === 'P2025') {
      return res.status(404).json(errorResponse('Record not found', 'NOT_FOUND'));
    }
    return res.status(400).json(errorResponse(`Database error: ${p.code}`, 'DB_ERROR'));
  }
  // Unknown error
  return res.status(500).json(errorResponse('Internal server error', 'INTERNAL_ERROR'));
}

export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
