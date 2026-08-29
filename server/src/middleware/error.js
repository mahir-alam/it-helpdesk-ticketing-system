import { ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Request validation failed',
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: err.name,
      message: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Prisma "record not found" on update/delete
  if (err?.code === 'P2025') {
    return res.status(404).json({ error: 'NotFound', message: 'Record not found' });
  }
  // Prisma unique constraint
  if (err?.code === 'P2002') {
    return res.status(409).json({
      error: 'Conflict',
      message: `A record with that ${err.meta?.target?.join(', ') ?? 'value'} already exists`,
    });
  }

  logger.error('Unhandled error:', err);
  return res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'NotFound', message: `No route for ${req.method} ${req.originalUrl}` });
}
