import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, forbidden, notFound, unauthorized } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole, isStaff } from '../../middleware/rbac.js';
import { recordAudit } from '../../services/auditLog.js';
import {
  createTicketSchema,
  autoCreateTicketSchema,
  listTicketsSchema,
  updateTicketSchema,
  reprioritizeSchema,
  assignSchema,
  commentSchema,
} from './tickets.validation.js';
import {
  createTicket,
  changeStatus,
  reprioritize,
  markFirstResponse,
  TICKET_DETAIL_INCLUDE,
} from './tickets.service.js';
import checklistRoutes from '../checklists/checklists.routes.js';
import technicianActionRoutes from '../technician-actions/technicianActions.routes.js';
import csatRoutes from '../csat/csat.routes.js';

const router = Router();

/* ─── External integration endpoint ──────────────────────────────────────
 * POST /api/tickets/auto-create
 * Called by external systems (e.g. the Fleet Asset Tracker) to open a ticket
 * that did not originate from a logged-in user. Auth is a shared API key, not
 * a JWT. Kept deliberately separate from the interactive POST /api/tickets.
 */
router.post(
  '/auto-create',
  validate({ body: autoCreateTicketSchema }),
  asyncHandler(async (req, res) => {
    if (env.integrationApiKey) {
      if (req.get('x-api-key') !== env.integrationApiKey) throw unauthorized('Invalid or missing X-Api-Key');
    } else {
      logger.warn('INTEGRATION_API_KEY not set — /tickets/auto-create is unauthenticated');
    }

    const { assetTag, ...payload } = req.body;
    let assetIds;
    if (assetTag) {
      const asset = await prisma.asset.findUnique({ where: { assetTag } });
      if (asset) assetIds = [asset.id];
    }

    const ticket = await createTicket({
      input: { ...payload, assetIds },
      requester: null,
      origin: 'system',
    });
    res.status(201).json(ticket);
  }),
);

// Everything below requires a logged-in user
router.use(requireAuth);

/* ─── List ───────────────────────────────────────────────────────────── */
router.get(
  '/',
  validate({ query: listTicketsSchema }),
  asyncHandler(async (req, res) => {
    const { status, priority, category, source, assigneeId, mine, unassigned, breached, q, page, pageSize, sort, order } =
      req.query;

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (category) where.category = category;
    if (source) where.source = source;
    if (assigneeId) where.assigneeId = assigneeId;
    if (unassigned) where.assigneeId = null;
    if (breached) where.slaStatus = { in: ['RESPONSE_BREACHED', 'RESOLVE_BREACHED'] };
    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { number: { contains: q, mode: 'insensitive' } },
      ];
    }

    // End-users are scoped to their own tickets, always.
    if (!isStaff(req.user)) where.requesterId = req.user.id;
    else if (mine) where.assigneeId = req.user.id;

    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          requester: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true } },
          _count: { select: { comments: true, checklistItems: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    res.json({
      items,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    });
  }),
);

/* ─── Create (interactive) ──────────────────────────────────────────── */
router.post(
  '/',
  validate({ body: createTicketSchema }),
  asyncHandler(async (req, res) => {
    if (req.body.templateId) {
      const tpl = await prisma.ticketTemplate.findUnique({ where: { id: req.body.templateId } });
      if (!tpl) throw badRequest('Unknown templateId');
    }
    const ticket = await createTicket({ input: req.body, requester: req.user, origin: 'user' });
    res.status(201).json(ticket);
  }),
);

/* ─── Load + visibility guard for :id routes ────────────────────────── */
async function loadTicket(req, _res, next) {
  try {
    const ticket = await prisma.ticket.findUnique({
      where: { id: req.params.id },
      include: TICKET_DETAIL_INCLUDE,
    });
    if (!ticket) throw notFound('Ticket not found');
    if (!isStaff(req.user) && ticket.requesterId !== req.user.id) {
      throw forbidden('You can only view your own tickets');
    }
    req.ticket = ticket;
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/:id', loadTicket, (req, res) => res.json(req.ticket));

router.get(
  '/:id/audit',
  loadTicket,
  asyncHandler(async (req, res) => {
    const entries = await prisma.auditLog.findMany({
      where: { entityType: 'Ticket', entityId: req.ticket.id },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, name: true } } },
    });
    res.json(entries);
  }),
);

/* ─── Update status / category / assignee (staff) ───────────────────── */
router.patch(
  '/:id',
  loadTicket,
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({ body: updateTicketSchema }),
  asyncHandler(async (req, res) => {
    const { status, category, assigneeId } = req.body;
    let current = req.ticket;

    if (category && category !== current.category) {
      await prisma.ticket.update({ where: { id: current.id }, data: { category } });
      await recordAudit({
        entityType: 'Ticket',
        entityId: current.id,
        action: 'CATEGORY_CHANGE',
        field: 'category',
        oldValue: current.category,
        newValue: category,
        actor: req.user,
      });
    }

    if (assigneeId !== undefined && assigneeId !== current.assigneeId) {
      if (assigneeId) {
        const tech = await prisma.user.findUnique({ where: { id: assigneeId } });
        if (!tech || !['TECHNICIAN', 'ADMIN'].includes(tech.role)) throw badRequest('Assignee must be a technician or admin');
      }
      await prisma.ticket.update({ where: { id: current.id }, data: { assigneeId } });
      await recordAudit({
        entityType: 'Ticket',
        entityId: current.id,
        action: 'ASSIGNMENT_CHANGE',
        field: 'assigneeId',
        oldValue: current.assigneeId,
        newValue: assigneeId,
        actor: req.user,
      });
    }

    if (status && status !== current.status) {
      current = await prisma.ticket.findUnique({ where: { id: current.id } });
      await changeStatus({ ticket: current, to: status, actor: req.user });
    }

    const fresh = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: TICKET_DETAIL_INCLUDE });
    res.json(fresh);
  }),
);

/* ─── Assign (staff) ───────────────────────────────────────────────── */
router.post(
  '/:id/assign',
  loadTicket,
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({ body: assignSchema }),
  asyncHandler(async (req, res) => {
    const { assigneeId } = req.body;
    if (assigneeId) {
      const tech = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!tech || !['TECHNICIAN', 'ADMIN'].includes(tech.role)) throw badRequest('Assignee must be a technician or admin');
    }
    await prisma.ticket.update({ where: { id: req.ticket.id }, data: { assigneeId } });
    await recordAudit({
      entityType: 'Ticket',
      entityId: req.ticket.id,
      action: 'ASSIGNMENT_CHANGE',
      field: 'assigneeId',
      oldValue: req.ticket.assigneeId,
      newValue: assigneeId ?? '(unassigned)',
      actor: req.user,
    });
    const fresh = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: TICKET_DETAIL_INCLUDE });
    res.json(fresh);
  }),
);

/* ─── Reprioritise (staff) — recompute from impact × urgency ────────── */
router.post(
  '/:id/reprioritize',
  loadTicket,
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({ body: reprioritizeSchema }),
  asyncHandler(async (req, res) => {
    await reprioritize({ ticket: req.ticket, ...req.body, actor: req.user });
    const fresh = await prisma.ticket.findUnique({ where: { id: req.params.id }, include: TICKET_DETAIL_INCLUDE });
    res.json(fresh);
  }),
);

/* ─── Comments (requester or staff) ────────────────────────────────── */
router.post(
  '/:id/comments',
  loadTicket,
  validate({ body: commentSchema }),
  asyncHandler(async (req, res) => {
    const staff = isStaff(req.user);
    const isInternal = staff && req.body.isInternal;
    const comment = await prisma.ticketComment.create({
      data: { ticketId: req.ticket.id, authorId: req.user.id, body: req.body.body, isInternal },
      include: { author: { select: { id: true, name: true, role: true } } },
    });
    await recordAudit({
      entityType: 'Ticket',
      entityId: req.ticket.id,
      action: isInternal ? 'INTERNAL_NOTE_ADDED' : 'COMMENT_ADDED',
      actor: req.user,
    });
    if (staff) await markFirstResponse(req.ticket, req.user);
    res.status(201).json(comment);
  }),
);

/* ─── Nested resources ─────────────────────────────────────────────── */
router.use('/:id/checklist', loadTicket, checklistRoutes);
router.use('/:id/actions', loadTicket, technicianActionRoutes);
router.use('/:id/csat', loadTicket, csatRoutes);

export default router;
