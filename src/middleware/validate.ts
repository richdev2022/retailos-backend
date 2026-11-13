import type { Request, Response, NextFunction } from 'express';
import { ZodError, ZodSchema } from 'zod';
import { sendError } from '../utils/errors.js';

/** Validate body against a Zod schema. */
export function validateBody(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return sendError(res, result.error);
    }
    req.body = result.data;
    next();
  };
}

/** Validate query params. */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return sendError(res, result.error);
    }
    req.query = result.data as any;
    next();
  };
}

/** Validate path params. */
export function validateParams(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return sendError(res, result.error);
    }
    req.params = result.data as any;
    next();
  };
}
