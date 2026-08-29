import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { unauthorized } from '../lib/errors.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/**
 * Require a valid Bearer token. Loads the fresh user record so role changes and
 * deactivation take effect immediately (RBAC is never trusted from the token alone).
 */
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw unauthorized('Missing bearer token');

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch {
      throw unauthorized('Invalid or expired token');
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) throw unauthorized('Account not found or disabled');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Optional auth: attaches req.user when a valid token is present, never rejects. */
export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user?.isActive) req.user = user;
    } catch {
      /* ignore — treated as anonymous */
    }
  }
  next();
}
