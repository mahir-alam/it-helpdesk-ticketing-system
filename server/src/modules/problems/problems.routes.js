import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { createWithNumber } from '../../lib/sequence.js';
import { recordAudit, recordFieldChanges } from '../../services/auditLog.js';
import { sweepRecurringProblems } from './problemDetection.service.js';

const router = Router();
router.use(requireAuth, requireRole('TECHNICIAN', 'ADMIN'));

const createSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  category: z.string().min(1).max(80).trim(),
  keywords: z.array(z.string().max(40)).max(20).default([]),
  workaround: z.string().max(3000).trim().optional(),
});

const updateSchema = z.object({
  status: z.enum(['OPEN', 'INVESTIGATING', 'KNOWN_ERROR', 'RESOLVED']).optional(),
  rootCause: z.string().max(5000).trim().optional(),
  workaround: z.string().max(3000).trim().optional(),
  title: z.string().min(3).max(200).trim().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status } = req.query;
    const problems = await prisma.problem.findMany({
      where: status ? { status: String(status) } : {},
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { linkedTickets: true, articles: true } } },
    });
    res.json(problems);
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const problem = await createWithNumber('problem', {
      ...req.body,
      status: 'OPEN',
      autoDetected: false,
      reportedById: req.user.id,
    });
    await recordAudit({ entityType: 'Problem', entityId: problem.id, action: 'CREATE', actor: req.user });
    res.status(201).json(problem);
  }),
);

// Manually trigger a detection sweep (also runs on cron).
router.post(
  '/detect',
  asyncHandler(async (_req, res) => {
    const result = await sweepRecurringProblems();
    res.json(result);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const problem = await prisma.problem.findUnique({
      where: { id: req.params.id },
      include: {
        reportedBy: { select: { id: true, name: true } },
        linkedTickets: {
          orderBy: { createdAt: 'desc' },
          select: { id: true, number: true, title: true, status: true, priority: true, createdAt: true },
        },
        articles: { select: { id: true, title: true, slug: true } },
      },
    });
    if (!problem) throw notFound('Problem not found');
    res.json(problem);
  }),
);

router.patch(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const before = await prisma.problem.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('Problem not found');

    const data = { ...req.body };
    if (req.body.status === 'RESOLVED' && before.status !== 'RESOLVED') data.resolvedAt = new Date();

    const after = await prisma.problem.update({ where: { id: req.params.id }, data });
    await recordFieldChanges({
      entityType: 'Problem',
      entityId: after.id,
      before,
      after,
      fields: ['status', 'rootCause', 'workaround', 'title'],
      actor: req.user,
    });
    res.json(after);
  }),
);

// Link / unlink an incident to a problem.
router.post(
  '/:id/link/:ticketId',
  asyncHandler(async (req, res) => {
    const problem = await prisma.problem.findUnique({ where: { id: req.params.id } });
    if (!problem) throw notFound('Problem not found');
    await prisma.ticket.update({ where: { id: req.params.ticketId }, data: { problemId: problem.id } });
    await recordAudit({
      entityType: 'Ticket',
      entityId: req.params.ticketId,
      action: 'PROBLEM_LINKED',
      field: 'problemId',
      newValue: problem.number,
      actor: req.user,
    });
    res.json({ ok: true });
  }),
);

router.delete(
  '/:id/link/:ticketId',
  asyncHandler(async (req, res) => {
    await prisma.ticket.update({ where: { id: req.params.ticketId }, data: { problemId: null } });
    await recordAudit({
      entityType: 'Ticket',
      entityId: req.params.ticketId,
      action: 'PROBLEM_UNLINKED',
      field: 'problemId',
      actor: req.user,
    });
    res.json({ ok: true });
  }),
);

export default router;
