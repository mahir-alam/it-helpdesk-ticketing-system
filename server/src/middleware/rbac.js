import { forbidden, unauthorized } from '../lib/errors.js';

export const ROLES = {
  END_USER: 'END_USER',
  TECHNICIAN: 'TECHNICIAN',
  ADMIN: 'ADMIN',
};

// Higher number = more privilege. Used for "at least this role" checks.
const RANK = { END_USER: 1, TECHNICIAN: 2, ADMIN: 3 };

/**
 * Backend-enforced role gate. Pass one or more allowed roles.
 *   router.get('/queue', requireAuth, requireRole('TECHNICIAN', 'ADMIN'), handler)
 */
export function requireRole(...allowed) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(forbidden(`Requires role: ${allowed.join(' or ')}`));
    }
    next();
  };
}

/** Require a role rank >= the given minimum. */
export function requireMinRole(minRole) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if ((RANK[req.user.role] ?? 0) < RANK[minRole]) {
      return next(forbidden(`Requires ${minRole} or higher`));
    }
    next();
  };
}

export const isStaff = (user) => user?.role === ROLES.TECHNICIAN || user?.role === ROLES.ADMIN;
export const isAdmin = (user) => user?.role === ROLES.ADMIN;
