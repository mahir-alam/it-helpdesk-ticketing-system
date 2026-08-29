import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, forbidden } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { recordAudit } from '../../services/auditLog.js';

// Mounted at /api/tickets/:id/csat — req.ticket set by parent loader.
const router = Router({ mergeParams: true });

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rating = await prisma.csatRating.findUnique({ where: { ticketId: req.ticket.id } });
    res.json(rating ?? null);
  }),
);

// The requester rates satisfaction once the ticket is resolved or closed.
router.post(
  '/',
  validate({
    body: z.object({
      score: z.coerce.number().int().min(1).max(5),
      comment: z.string().max(2000).trim().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (req.ticket.requesterId && req.ticket.requesterId !== req.user.id) {
      throw forbidden('Only the requester can rate this ticket');
    }
    if (!['RESOLVED', 'CLOSED'].includes(req.ticket.status)) {
      throw badRequest('CSAT can only be submitted once a ticket is resolved or closed');
    }
    const existing = await prisma.csatRating.findUnique({ where: { ticketId: req.ticket.id } });
    if (existing) throw badRequest('This ticket has already been rated');

    const rating = await prisma.csatRating.create({
      data: {
        ticketId: req.ticket.id,
        score: req.body.score,
        comment: req.body.comment,
        submittedById: req.user.id,
      },
    });
    await recordAudit({
      entityType: 'Ticket',
      entityId: req.ticket.id,
      action: 'CSAT_SUBMITTED',
      field: 'csat',
      newValue: String(req.body.score),
      actor: req.user,
    });
    res.status(201).json(rating);
  }),
);

export default router;
