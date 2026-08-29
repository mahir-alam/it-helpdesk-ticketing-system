import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { createWithNumber } from '../../lib/sequence.js';
import { recordAudit } from '../../services/auditLog.js';

const router = Router();
router.use(requireAuth, requireRole('TECHNICIAN', 'ADMIN'));

const createSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  rollbackPlan: z.string().min(1).max(5000).trim(),
  changeWindowStart: z.coerce.date().optional(),
  changeWindowEnd: z.coerce.date().optional(),
  assetIds: z.array(z.string().cuid()).max(50).default([]),
});

const updateSchema = z.object({
  title: z.string().min(3).max(200).trim().optional(),
  description: z.string().min(1).max(5000).trim().optional(),
  riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  rollbackPlan: z.string().min(1).max(5000).trim().optional(),
  changeWindowStart: z.coerce.date().nullable().optional(),
  changeWindowEnd: z.coerce.date().nullable().optional(),
});

// Change lifecycle. Approval is a distinct step; only an ADMIN can approve/reject.
const TRANSITIONS = {
  DRAFT: ['PENDING_APPROVAL'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'DRAFT'],
  APPROVED: ['SCHEDULED', 'IN_PROGRESS'],
  SCHEDULED: ['IN_PROGRESS', 'APPROVED'],
  IN_PROGRESS: ['COMPLETED', 'ROLLED_BACK'],
  REJECTED: ['DRAFT'],
  COMPLETED: [],
  ROLLED_BACK: [],
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, riskLevel } = req.query;
    const changes = await prisma.changeRequest.findMany({
      where: {
        ...(status ? { status: String(status) } : {}),
        ...(riskLevel ? { riskLevel: String(riskLevel) } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        requestedBy: { select: { id: true, name: true } },
        approvedBy: { select: { id: true, name: true } },
        _count: { select: { affectedAssets: true } },
      },
    });
    res.json(changes);
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const { assetIds, ...rest } = req.body;
    const change = await createWithNumber('changeRequest', {
      ...rest,
      status: 'DRAFT',
      requestedById: req.user.id,
      ...(assetIds.length ? { affectedAssets: { create: assetIds.map((assetId) => ({ assetId })) } } : {}),
    });
    await recordAudit({ entityType: 'ChangeRequest', entityId: change.id, action: 'CREATE', actor: req.user });
    res.status(201).json(change);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const change = await prisma.changeRequest.findUnique({
      where: { id: req.params.id },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true } },
        affectedAssets: { include: { asset: { select: { id: true, assetTag: true, name: true, type: true } } } },
      },
    });
    if (!change) throw notFound('Change request not found');
    res.json(change);
  }),
);

router.patch(
  '/:id',
  validate({ body: updateSchema }),
  asyncHandler(async (req, res) => {
    const before = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('Change request not found');
    if (!['DRAFT', 'PENDING_APPROVAL'].includes(before.status)) {
      throw badRequest('Only draft or pending changes can be edited');
    }
    const change = await prisma.changeRequest.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit({ entityType: 'ChangeRequest', entityId: change.id, action: 'UPDATE', actor: req.user });
    res.json(change);
  }),
);

// Status / approval transitions.
router.post(
  '/:id/transition',
  validate({
    body: z.object({
      to: z.enum([
        'DRAFT',
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'ROLLED_BACK',
      ]),
      note: z.string().max(1000).trim().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const change = await prisma.changeRequest.findUnique({ where: { id: req.params.id } });
    if (!change) throw notFound('Change request not found');

    const { to, note } = req.body;
    if (!TRANSITIONS[change.status]?.includes(to)) {
      throw badRequest(`Illegal change transition ${change.status} → ${to}`);
    }
    if (['APPROVED', 'REJECTED'].includes(to) && req.user.role !== 'ADMIN') {
      throw badRequest('Only an admin can approve or reject changes');
    }

    const data = { status: to };
    if (to === 'APPROVED') {
      data.approvedById = req.user.id;
      data.approvedAt = new Date();
    }
    if (to === 'REJECTED') {
      data.approvedById = req.user.id;
      data.approvedAt = null;
    }

    const updated = await prisma.changeRequest.update({ where: { id: change.id }, data });
    await recordAudit({
      entityType: 'ChangeRequest',
      entityId: change.id,
      action: 'STATUS_CHANGE',
      field: 'status',
      oldValue: change.status,
      newValue: to + (note ? ` — ${note}` : ''),
      actor: req.user,
    });
    res.json(updated);
  }),
);

export default router;
