import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAudit } from '../../services/auditLog.js';

// Mounted at /api/tickets/:id/checklist — req.ticket is set by the parent loader.
const router = Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await prisma.checklistItem.findMany({
      where: { ticketId: req.ticket.id },
      orderBy: { order: 'asc' },
      include: { completedBy: { select: { id: true, name: true } } },
    });
    res.json(items);
  }),
);

// Staff can add ad-hoc checklist items beyond the seeded SOP steps.
router.post(
  '/',
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({ body: z.object({ label: z.string().min(1).max(300).trim() }) }),
  asyncHandler(async (req, res) => {
    const max = await prisma.checklistItem.aggregate({
      where: { ticketId: req.ticket.id },
      _max: { order: true },
    });
    const item = await prisma.checklistItem.create({
      data: { ticketId: req.ticket.id, label: req.body.label, order: (max._max.order ?? 0) + 1 },
    });
    await recordAudit({ entityType: 'Ticket', entityId: req.ticket.id, action: 'CHECKLIST_ITEM_ADDED', actor: req.user });
    res.status(201).json(item);
  }),
);

router.patch(
  '/:itemId',
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({ body: z.object({ isDone: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const existing = await prisma.checklistItem.findFirst({
      where: { id: req.params.itemId, ticketId: req.ticket.id },
    });
    if (!existing) throw notFound('Checklist item not found on this ticket');

    const item = await prisma.checklistItem.update({
      where: { id: existing.id },
      data: {
        isDone: req.body.isDone,
        completedById: req.body.isDone ? req.user.id : null,
        completedAt: req.body.isDone ? new Date() : null,
      },
    });
    await recordAudit({
      entityType: 'Ticket',
      entityId: req.ticket.id,
      action: req.body.isDone ? 'CHECKLIST_ITEM_DONE' : 'CHECKLIST_ITEM_REOPENED',
      field: 'checklist',
      newValue: existing.label,
      actor: req.user,
    });
    res.json(item);
  }),
);

router.delete(
  '/:itemId',
  requireRole('TECHNICIAN', 'ADMIN'),
  asyncHandler(async (req, res) => {
    const existing = await prisma.checklistItem.findFirst({
      where: { id: req.params.itemId, ticketId: req.ticket.id },
    });
    if (!existing) throw notFound('Checklist item not found on this ticket');
    await prisma.checklistItem.delete({ where: { id: existing.id } });
    res.status(204).end();
  }),
);

export default router;
