import { requireRole, requireMinRole, isStaff, isAdmin, ROLES } from '../src/middleware/rbac.js';
import { ApiError } from '../src/lib/errors.js';

function run(mw, user) {
  return new Promise((resolve) => {
    const req = { user };
    const next = (err) => resolve(err);
    mw(req, {}, next);
  });
}

describe('requireRole — backend enforcement', () => {
  it('passes when the user has one of the allowed roles', async () => {
    const err = await run(requireRole('TECHNICIAN', 'ADMIN'), { role: 'TECHNICIAN' });
    expect(err).toBeUndefined();
  });

  it('403s when the role is not allowed', async () => {
    const err = await run(requireRole('TECHNICIAN', 'ADMIN'), { role: 'END_USER' });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
  });

  it('401s when there is no authenticated user', async () => {
    const err = await run(requireRole('ADMIN'), undefined);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
  });

  it('an END_USER can never reach an ADMIN-only route', async () => {
    const err = await run(requireRole('ADMIN'), { role: 'END_USER' });
    expect(err.status).toBe(403);
  });

  it('a TECHNICIAN can never reach an ADMIN-only route', async () => {
    const err = await run(requireRole('ADMIN'), { role: 'TECHNICIAN' });
    expect(err.status).toBe(403);
  });
});

describe('requireMinRole — rank ladder', () => {
  it('ADMIN satisfies a TECHNICIAN minimum', async () => {
    expect(await run(requireMinRole('TECHNICIAN'), { role: 'ADMIN' })).toBeUndefined();
  });
  it('TECHNICIAN satisfies a TECHNICIAN minimum', async () => {
    expect(await run(requireMinRole('TECHNICIAN'), { role: 'TECHNICIAN' })).toBeUndefined();
  });
  it('END_USER fails a TECHNICIAN minimum', async () => {
    const err = await run(requireMinRole('TECHNICIAN'), { role: 'END_USER' });
    expect(err.status).toBe(403);
  });
  it('TECHNICIAN fails an ADMIN minimum', async () => {
    const err = await run(requireMinRole('ADMIN'), { role: 'TECHNICIAN' });
    expect(err.status).toBe(403);
  });
});

describe('role predicates', () => {
  it('isStaff is true for TECHNICIAN and ADMIN only', () => {
    expect(isStaff({ role: ROLES.TECHNICIAN })).toBe(true);
    expect(isStaff({ role: ROLES.ADMIN })).toBe(true);
    expect(isStaff({ role: ROLES.END_USER })).toBe(false);
    expect(isStaff(undefined)).toBe(false);
  });
  it('isAdmin is true for ADMIN only', () => {
    expect(isAdmin({ role: ROLES.ADMIN })).toBe(true);
    expect(isAdmin({ role: ROLES.TECHNICIAN })).toBe(false);
  });
});
