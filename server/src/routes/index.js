import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import ticketsRoutes from '../modules/tickets/tickets.routes.js';
import templatesRoutes from '../modules/templates/templates.routes.js';
import changesRoutes from '../modules/changes/changes.routes.js';
import catalogRoutes from '../modules/catalog/catalog.routes.js';
import serviceRequestsRoutes from '../modules/service-requests/serviceRequests.routes.js';
import assetsRoutes from '../modules/assets/assets.routes.js';
import knowledgeRoutes from '../modules/knowledge-base/knowledge.routes.js';
import problemsRoutes from '../modules/problems/problems.routes.js';
import auditRoutes from '../modules/audit/audit.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';

const router = Router();

router.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/tickets', ticketsRoutes);
router.use('/ticket-templates', templatesRoutes);
router.use('/changes', changesRoutes);
router.use('/catalog', catalogRoutes);
router.use('/service-requests', serviceRequestsRoutes);
router.use('/assets', assetsRoutes);
router.use('/knowledge-base', knowledgeRoutes);
router.use('/problems', problemsRoutes);
router.use('/audit', auditRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
