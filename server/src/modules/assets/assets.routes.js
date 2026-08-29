import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, badRequest, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { recordAudit, recordFieldChanges } from '../../services/auditLog.js';

const router = Router();
router.use(requireAuth);

const ASSET_TYPES = [
  'DESKTOP',
  'LAPTOP',
  'PRINTER',
  'VIDEO_CONFERENCING',
  'MOBILE_IOS',
  'MOBILE_ANDROID',
  'MDM_DEVICE',
  'NETWORK',
  'SERVER',
  'PERIPHERAL',
];
const ASSET_STATUSES = ['IN_USE', 'IN_STOCK', 'IN_REPAIR', 'RETIRED'];
const LINK_TYPES = ['CONNECTED_TO', 'DEPENDS_ON', 'RELATED_EQUIPMENT', 'DOCKED_TO'];

const baseSchema = z.object({
  assetTag: z.string().min(1).max(60).trim(),
  name: z.string().min(1).max(200).trim(),
  type: z.enum(ASSET_TYPES),
  status: z.enum(ASSET_STATUSES).default('IN_USE'),
  manufacturer: z.string().max(120).trim().optional(),
  model: z.string().max(120).trim().optional(),
  serialNumber: z.string().max(120).trim().optional(),
  location: z.string().max(120).trim().optional(),
  purchaseDate: z.coerce.date().optional(),
  warrantyExpiry: z.coerce.date().optional(),
  assignedToId: z.string().cuid().nullable().optional(),
  parentAssetId: z.string().cuid().nullable().optional(),
  osVersion: z.string().max(80).trim().optional(),
  mdmEnrolled: z.boolean().optional(),
  driverVersion: z.string().max(80).trim().optional(),
  firmwareVersion: z.string().max(80).trim().optional(),
  lastFirmwareUpdate: z.coerce.date().optional(),
});

const assetInclude = {
  assignedTo: { select: { id: true, name: true, email: true, department: true } },
  parentAsset: { select: { id: true, assetTag: true, name: true, type: true } },
  childAssets: { select: { id: true, assetTag: true, name: true, type: true } },
  linksFrom: { include: { to: { select: { id: true, assetTag: true, name: true, type: true } } } },
  linksTo: { include: { from: { select: { id: true, assetTag: true, name: true, type: true } } } },
  _count: { select: { tickets: true, changes: true } },
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { type, status, assignedToId, q, firmwareStale } = req.query;
    const where = {};
    if (type) where.type = String(type);
    if (status) where.status = String(status);
    if (assignedToId) where.assignedToId = String(assignedToId);
    if (q) {
      where.OR = [
        { name: { contains: String(q), mode: 'insensitive' } },
        { assetTag: { contains: String(q), mode: 'insensitive' } },
        { serialNumber: { contains: String(q), mode: 'insensitive' } },
      ];
    }
    // Printer fleet: flag units whose firmware hasn't been touched in 180+ days.
    if (firmwareStale === 'true') {
      where.type = 'PRINTER';
      where.OR = [
        { lastFirmwareUpdate: null },
        { lastFirmwareUpdate: { lt: new Date(Date.now() - 180 * 86_400_000) } },
      ];
    }
    const assets = await prisma.asset.findMany({
      where,
      orderBy: { assetTag: 'asc' },
      include: {
        assignedTo: { select: { id: true, name: true } },
        _count: { select: { tickets: true, childAssets: true } },
      },
    });
    res.json(assets);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const asset = await prisma.asset.findUnique({ where: { id: req.params.id }, include: assetInclude });
    if (!asset) throw notFound('Asset not found');
    const tickets = await prisma.ticket.findMany({
      where: { affectedAssets: { some: { assetId: asset.id } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, number: true, title: true, status: true, priority: true, createdAt: true },
    });
    res.json({ ...asset, relatedTickets: tickets });
  }),
);

// Mutations are staff-only.
router.use(requireRole('TECHNICIAN', 'ADMIN'));

router.post(
  '/',
  validate({ body: baseSchema }),
  asyncHandler(async (req, res) => {
    const asset = await prisma.asset.create({ data: req.body });
    await recordAudit({ entityType: 'Asset', entityId: asset.id, action: 'CREATE', actor: req.user });
    res.status(201).json(asset);
  }),
);

router.patch(
  '/:id',
  validate({ body: baseSchema.partial() }),
  asyncHandler(async (req, res) => {
    const before = await prisma.asset.findUnique({ where: { id: req.params.id } });
    if (!before) throw notFound('Asset not found');
    if (req.body.parentAssetId && req.body.parentAssetId === req.params.id) {
      throw badRequest('An asset cannot be its own parent');
    }
    const after = await prisma.asset.update({ where: { id: req.params.id }, data: req.body });
    await recordFieldChanges({
      entityType: 'Asset',
      entityId: after.id,
      before,
      after,
      fields: ['status', 'assignedToId', 'parentAssetId', 'location', 'firmwareVersion', 'driverVersion', 'osVersion'],
      actor: req.user,
    });
    res.json(after);
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.asset.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

// ── CI relationship links ───────────────────────────────
router.post(
  '/:id/links',
  validate({ body: z.object({ toId: z.string().cuid(), type: z.enum(LINK_TYPES) }) }),
  asyncHandler(async (req, res) => {
    if (req.body.toId === req.params.id) throw badRequest('Cannot link an asset to itself');
    const link = await prisma.assetLink.create({
      data: { fromId: req.params.id, toId: req.body.toId, type: req.body.type },
    });
    await recordAudit({
      entityType: 'Asset',
      entityId: req.params.id,
      action: 'CI_LINK_ADDED',
      field: 'link',
      newValue: `${req.body.type} → ${req.body.toId}`,
      actor: req.user,
    });
    res.status(201).json(link);
  }),
);

router.delete(
  '/:id/links/:linkId',
  asyncHandler(async (req, res) => {
    await prisma.assetLink.delete({ where: { id: req.params.linkId } });
    res.status(204).end();
  }),
);

export default router;
