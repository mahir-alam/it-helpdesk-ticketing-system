import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { isStaff, requireRole } from '../../middleware/rbac.js';
import { createWithNumber } from '../../lib/sequence.js';
import { recordAudit } from '../../services/auditLog.js';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  catalogItemId: z.string().cuid(),
  formData: z.record(z.any()).optional(),
  notes: z.string().max(2000).trim().optional(),
});

// Fulfilment workflow, distinct from break-fix incidents.
const TRANSITIONS = {
  SUBMITTED: ['PENDING_APPROVAL', 'IN_FULFILLMENT', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_FULFILLMENT', 'CANCELLED'],
  IN_FULFILLMENT: ['FULFILLED', 'CANCELLED'],
  REJECTED: [],
  FULFILLED: [],
  CANCELLED: [],
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (!isStaff(req.user)) where.requestedById = req.user.id;
    else if (req.query.mine) where.requestedById = req.user.id;

    const requests = await prisma.serviceRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        catalogItem: { select: { id: true, name: true, category: true, approvalRequired: true } },
        requestedBy: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        fulfilledBy: { select: { id: true, name: true } },
      },
    });
    res.json(requests);
  }),
);

router.post(
  '/',
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const item = await prisma.serviceCatalogItem.findUnique({ where: { id: req.body.catalogItemId } });
    if (!item || !item.isActive) throw badRequest('Catalog item not available');

    const request = await createWithNumber('serviceRequest', {
      catalogItemId: item.id,
      requestedById: req.user.id,
      formData: req.body.formData ?? undefined,
      notes: req.body.notes,
      status: item.approvalRequired ? 'PENDING_APPROVAL' : 'IN_FULFILLMENT',
    });
    await recordAudit({ entityType: 'ServiceRequest', entityId: request.id, action: 'CREATE', actor: req.user });
    res.status(201).json(request);
  }),
);

async function loadRequest(req, _res, next) {
  try {
    const request = await prisma.serviceRequest.findUnique({
      where: { id: req.params.id },
      include: {
        catalogItem: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true } },
        fulfilledBy: { select: { id: true, name: true } },
      },
    });
    if (!request) throw notFound('Service request not found');
    if (!isStaff(req.user) && request.requestedById !== req.user.id) throw forbidden('Not your request');
    req.serviceRequest = request;
    next();
  } catch (err) {
    next(err);
  }
}

router.get('/:id', loadRequest, (req, res) => res.json(req.serviceRequest));

router.post(
  '/:id/transition',
  loadRequest,
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({
    body: z.object({
      to: z.enum([
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'IN_FULFILLMENT',
        'FULFILLED',
        'CANCELLED',
      ]),
      note: z.string().max(1000).trim().optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const current = req.serviceRequest;
    const { to, note } = req.body;
    if (!TRANSITIONS[current.status]?.includes(to)) {
      throw badRequest(`Illegal transition ${current.status} → ${to}`);
    }
    if (['APPROVED', 'REJECTED'].includes(to) && req.user.role !== 'ADMIN') {
      throw badRequest('Only an admin can approve or reject service requests');
    }

    const data = { status: to };
    if (to === 'APPROVED') {
      data.approverId = req.user.id;
      data.approvedAt = new Date();
    }
    if (to === 'FULFILLED') {
      data.fulfilledById = req.user.id;
      data.fulfilledAt = new Date();
    }
    if (note) data.notes = note;

    const updated = await prisma.serviceRequest.update({ where: { id: current.id }, data });
    await recordAudit({
      entityType: 'ServiceRequest',
      entityId: current.id,
      action: 'STATUS_CHANGE',
      field: 'status',
      oldValue: current.status,
      newValue: to,
      actor: req.user,
    });
    res.json(updated);
  }),
);

// The requester may cancel their own pending request.
router.post(
  '/:id/cancel',
  loadRequest,
  asyncHandler(async (req, res) => {
    const current = req.serviceRequest;
    if (current.requestedById !== req.user.id && !isStaff(req.user)) throw forbidden('Not your request');
    if (['FULFILLED', 'REJECTED', 'CANCELLED'].includes(current.status)) {
      throw badRequest(`Cannot cancel a ${current.status} request`);
    }
    const updated = await prisma.serviceRequest.update({ where: { id: current.id }, data: { status: 'CANCELLED' } });
    await recordAudit({
      entityType: 'ServiceRequest',
      entityId: current.id,
      action: 'STATUS_CHANGE',
      field: 'status',
      oldValue: current.status,
      newValue: 'CANCELLED',
      actor: req.user,
    });
    res.json(updated);
  }),
);

export default router;
