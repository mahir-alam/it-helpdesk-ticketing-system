import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAudit } from '../../services/auditLog.js';

const router = Router();
router.use(requireAuth);

const upsertSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  category: z.string().min(1).max(80).trim(),
  defaultImpact: z.enum(['SINGLE_USER', 'DEPARTMENT', 'ENTIRE_COMPANY']),
  defaultUrgency: z.enum(['WORKAROUND_AVAILABLE', 'WORK_DEGRADED', 'SYSTEM_DOWN']),
  bodyTemplate: z.string().min(1).max(5000),
  checklist: z.array(z.string().max(300)).max(30).default([]),
});

// Any authenticated user can read templates (used to pre-fill the submit form).
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const templates = await prisma.ticketTemplate.findMany({ orderBy: { name: 'asc' } });
    res.json(templates);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tpl = await prisma.ticketTemplate.findUnique({ where: { id: req.params.id } });
    if (!tpl) throw notFound('Template not found');
    res.json(tpl);
  }),
);

// Mutations are admin-only.
router.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const tpl = await prisma.ticketTemplate.create({ data: req.body });
    await recordAudit({ entityType: 'TicketTemplate', entityId: tpl.id, action: 'CREATE', actor: req.user });
    res.status(201).json(tpl);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ body: upsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    const tpl = await prisma.ticketTemplate.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit({ entityType: 'TicketTemplate', entityId: tpl.id, action: 'UPDATE', actor: req.user });
    res.json(tpl);
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.ticketTemplate.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

export default router;
