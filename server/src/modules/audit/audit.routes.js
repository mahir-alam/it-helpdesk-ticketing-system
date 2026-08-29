import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();
router.use(requireAuth, requireRole('TECHNICIAN', 'ADMIN'));

const querySchema = z.object({
  entityType: z.string().max(40).optional(),
  entityId: z.string().max(60).optional(),
  action: z.string().max(60).optional(),
  actorId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

router.get(
  '/',
  validate({ query: querySchema }),
  asyncHandler(async (req, res) => {
    const { entityType, entityId, action, actorId, page, pageSize } = req.query;
    const where = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;

    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { actor: { select: { id: true, name: true, role: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  }),
);

export default router;
