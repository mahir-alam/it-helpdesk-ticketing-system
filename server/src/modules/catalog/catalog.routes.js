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
  description: z.string().min(1).max(2000).trim(),
  category: z.string().min(1).max(80).trim(),
  approvalRequired: z.boolean().default(true),
  fulfillmentSlaDays: z.number().int().min(1).max(90).default(3),
  isActive: z.boolean().default(true),
});

// Browsable by any authenticated user (the self-service catalog).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === 'true' && ['TECHNICIAN', 'ADMIN'].includes(req.user.role);
    const items = await prisma.serviceCatalogItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    res.json(items);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const item = await prisma.serviceCatalogItem.findUnique({ where: { id: req.params.id } });
    if (!item) throw notFound('Catalog item not found');
    res.json(item);
  }),
);

router.post(
  '/',
  requireRole('ADMIN'),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    const item = await prisma.serviceCatalogItem.create({ data: req.body });
    await recordAudit({ entityType: 'ServiceCatalogItem', entityId: item.id, action: 'CREATE', actor: req.user });
    res.status(201).json(item);
  }),
);

router.patch(
  '/:id',
  requireRole('ADMIN'),
  validate({ body: upsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    const item = await prisma.serviceCatalogItem.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit({ entityType: 'ServiceCatalogItem', entityId: item.id, action: 'UPDATE', actor: req.user });
    res.json(item);
  }),
);

export default router;
