import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAudit, recordFieldChanges } from '../../services/auditLog.js';
import { publicUser, hashPassword } from '../auth/auth.service.js';

const router = Router();
router.use(requireAuth);

const updateSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  department: z.string().max(120).trim().nullable().optional(),
  role: z.enum(['END_USER', 'TECHNICIAN', 'ADMIN']).optional(),
  isOnCall: z.boolean().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const createSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  name: z.string().min(1).max(120).trim(),
  password: z.string().min(8),
  role: z.enum(['END_USER', 'TECHNICIAN', 'ADMIN']).default('END_USER'),
  department: z.string().max(120).trim().optional(),
  isOnCall: z.boolean().optional(),
});

// Technicians + admins: needed by ticket-assignment UI. Returns minimal fields.
router.get(
  '/assignable',
  requireRole('TECHNICIAN', 'ADMIN'),
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { role: { in: ['TECHNICIAN', 'ADMIN'] }, isActive: true },
      select: { id: true, name: true, email: true, role: true, isOnCall: true },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  }),
);

// ── Admin-only user management ───────────────────────────
router.use(requireRole('ADMIN'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { role, q } = req.query;
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: String(role) } : {}),
        ...(q ? { OR: [{ name: { contains: String(q), mode: 'insensitive' } }, { email: { contains: String(q), mode: 'insensitive' } }] } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users.map(publicUser));
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.body;
    const user = await prisma.user.create({ data: { ...rest, passwordHash: await hashPassword(password) } });
    await recordAudit({ entityType: 'User', entityId: user.id, action: 'CREATE', actor: req.user });
    res.status(201).json(publicUser(user));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) throw notFound('User not found');
    res.json(publicUser(user));
  }),
);

router.patch(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const before = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('User not found');

    const { password, ...rest } = req.body;
    const data = { ...rest };
    if (password) data.passwordHash = await hashPassword(password);

    const after = await prisma.user.update({ where: { id: req.params.id }, data });
    await recordFieldChanges({
      entityType: 'User',
      entityId: after.id,
      before,
      after,
      fields: ['role', 'department', 'isOnCall', 'isActive', 'name'],
      actor: req.user,
    });
    if (password) {
      await recordAudit({ entityType: 'User', entityId: after.id, action: 'PASSWORD_RESET', actor: req.user });
    }
    res.json(publicUser(after));
  }),
);

export default router;
