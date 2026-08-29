import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler } from '../../lib/errors.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router();
router.use(requireAuth, requireRole('TECHNICIAN', 'ADMIN'));

/** Mean Time To Resolve (hours) over resolved/closed tickets in the range. */
async function meanTimeToResolve(since) {
  const rows = await prisma.ticket.findMany({
    where: { resolvedAt: { not: null }, createdAt: { gte: since } },
    select: { createdAt: true, resolvedAt: true, priority: true },
  });
  if (rows.length === 0) return { overallHours: 0, byPriority: {}, sampleSize: 0 };

  const byPriority = {};
  for (const r of rows) {
    const hrs = (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000;
    (byPriority[r.priority] ??= []).push(hrs);
  }
  const avg = (arr) => Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
  return {
    overallHours: avg(rows.map((r) => (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000)),
    byPriority: Object.fromEntries(Object.entries(byPriority).map(([k, v]) => [k, avg(v)])),
    sampleSize: rows.length,
  };
}

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 86_400_000);

    const [byStatus, byPriority, byCategory, bySource, mttr, slaAgg, csatAgg, openBreaching, createdInRange] =
      await Promise.all([
        prisma.ticket.groupBy({ by: ['status'], _count: true }),
        prisma.ticket.groupBy({ by: ['priority'], _count: true }),
        prisma.ticket.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
        prisma.ticket.groupBy({ by: ['source'], _count: true }),
        meanTimeToResolve(since),
        prisma.ticket.groupBy({ by: ['slaStatus'], _count: true }),
        prisma.csatRating.aggregate({ _avg: { score: true }, _count: true }),
        prisma.ticket.count({
          where: { status: { notIn: ['RESOLVED', 'CLOSED'] }, slaStatus: { in: ['RESPONSE_BREACHED', 'RESOLVE_BREACHED'] } },
        }),
        prisma.ticket.count({ where: { createdAt: { gte: since } } }),
      ]);

    const slaTotal = slaAgg.reduce((a, s) => a + s._count, 0) || 1;
    const slaMet = slaAgg.filter((s) => ['MET', 'ON_TRACK'].includes(s.slaStatus)).reduce((a, s) => a + s._count, 0);

    res.json({
      rangeDays: days,
      ticketsCreatedInRange: createdInRange,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count])),
      byPriority: Object.fromEntries(byPriority.map((r) => [r.priority, r._count])),
      byCategory: byCategory.map((r) => ({ category: r.category, count: r._count })),
      bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count])),
      mttr,
      sla: {
        breakdown: Object.fromEntries(slaAgg.map((r) => [r.slaStatus, r._count])),
        compliancePct: Math.round((slaMet / slaTotal) * 1000) / 10,
        openBreaching,
      },
      csat: { average: csatAgg._avg.score ? Math.round(csatAgg._avg.score * 100) / 100 : null, responses: csatAgg._count },
    });
  }),
);

/** Per-technician workload: open assigned, resolved-in-range, avg resolve hrs. */
router.get(
  '/technician-workload',
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days) || 30, 365);
    const since = new Date(Date.now() - days * 86_400_000);

    const techs = await prisma.user.findMany({
      where: { role: { in: ['TECHNICIAN', 'ADMIN'] }, isActive: true },
      select: { id: true, name: true, role: true, isOnCall: true },
      orderBy: { name: 'asc' },
    });

    const result = await Promise.all(
      techs.map(async (t) => {
        const [openCount, inProgress, resolved] = await Promise.all([
          prisma.ticket.count({ where: { assigneeId: t.id, status: { notIn: ['RESOLVED', 'CLOSED'] } } }),
          prisma.ticket.count({ where: { assigneeId: t.id, status: 'IN_PROGRESS' } }),
          prisma.ticket.findMany({
            where: { assigneeId: t.id, resolvedAt: { not: null, gte: since } },
            select: { createdAt: true, resolvedAt: true },
          }),
        ]);
        const avgResolveHours =
          resolved.length === 0
            ? 0
            : Math.round(
                (resolved.reduce((a, r) => a + (r.resolvedAt.getTime() - r.createdAt.getTime()) / 3_600_000, 0) /
                  resolved.length) *
                  10,
              ) / 10;
        return {
          technicianId: t.id,
          name: t.name,
          role: t.role,
          isOnCall: t.isOnCall,
          openAssigned: openCount,
          inProgress,
          resolvedInRange: resolved.length,
          avgResolveHours,
        };
      }),
    );
    res.json(result);
  }),
);

/** Ticket volume per day for a trend chart. */
router.get(
  '/volume-trend',
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days) || 30, 180);
    const since = new Date(Date.now() - days * 86_400_000);
    const tickets = await prisma.ticket.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, resolvedAt: true },
    });
    const buckets = {};
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      buckets[d] = { date: d, created: 0, resolved: 0 };
    }
    for (const t of tickets) {
      const c = t.createdAt.toISOString().slice(0, 10);
      if (buckets[c]) buckets[c].created += 1;
      if (t.resolvedAt) {
        const r = t.resolvedAt.toISOString().slice(0, 10);
        if (buckets[r]) buckets[r].resolved += 1;
      }
    }
    res.json(Object.values(buckets));
  }),
);

export default router;
