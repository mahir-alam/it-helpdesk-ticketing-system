import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAudit } from '../../services/auditLog.js';
import { markFirstResponse } from '../tickets/tickets.service.js';

// Mounted at /api/tickets/:id/actions — req.ticket set by parent loader.
const router = Router({ mergeParams: true });

const ACTION_TYPES = [
  'PASSWORD_RESET',
  'ACCOUNT_UNLOCK',
  'NETWORK_DIAGNOSTIC',
  'REMOTE_SESSION_STARTED',
  'REMOTE_SESSION_ENDED',
  'SOFTWARE_REINSTALL',
  'HARDWARE_SWAP',
  'ESCALATED',
  'NOTE',
];

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const actions = await prisma.technicianAction.findMany({
      where: { ticketId: req.ticket.id },
      orderBy: { createdAt: 'desc' },
      include: { technician: { select: { id: true, name: true } } },
    });
    res.json(actions);
  }),
);

// Log a technician action. These don't perform anything system-level — they
// record that a technician did the thing, with who + when, mirroring a real
// technician action panel.
router.post(
  '/',
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({
    body: z.object({
      actionType: z.enum(ACTION_TYPES),
      notes: z.string().max(2000).trim().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const action = await prisma.technicianAction.create({
      data: {
        ticketId: req.ticket.id,
        technicianId: req.user.id,
        actionType: req.body.actionType,
        notes: req.body.notes,
      },
      include: { technician: { select: { id: true, name: true } } },
    });
    await recordAudit({
      entityType: 'Ticket',
      entityId: req.ticket.id,
      action: 'TECH_ACTION',
      field: 'action',
      newValue: req.body.actionType,
      actor: req.user,
    });
    await markFirstResponse(req.ticket, req.user);
    res.status(201).json(action);
  }),
);

export default router;
