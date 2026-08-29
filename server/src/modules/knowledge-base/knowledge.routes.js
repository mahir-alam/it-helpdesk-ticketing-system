import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { asyncHandler, notFound } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { isStaff, requireRole } from '../../middleware/rbac.js';
import { recordAudit } from '../../services/auditLog.js';

const router = Router();
router.use(requireAuth);

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const upsertSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  body: z.string().min(1).max(20000),
  category: z.string().min(1).max(80).trim(),
  keywords: z.array(z.string().max(40)).max(25).default([]),
  published: z.boolean().default(true),
  problemId: z.string().cuid().nullable().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, category } = req.query;
    const where = {};
    if (!isStaff(req.user)) where.published = true;
    if (category) where.category = String(category);
    if (q) {
      where.OR = [
        { title: { contains: String(q), mode: 'insensitive' } },
        { body: { contains: String(q), mode: 'insensitive' } },
        { keywords: { has: String(q).toLowerCase() } },
      ];
    }
    const articles = await prisma.knowledgeArticle.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        keywords: true,
        published: true,
        viewCount: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
      },
    });
    res.json(articles);
  }),
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const article = await prisma.knowledgeArticle.findUnique({
      where: { slug: req.params.slug },
      include: { author: { select: { id: true, name: true } }, problem: { select: { id: true, number: true, title: true } } },
    });
    if (!article) throw notFound('Article not found');
    if (!article.published && !isStaff(req.user)) throw notFound('Article not found');
    await prisma.knowledgeArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } });
    res.json(article);
  }),
);

// Authoring is staff-only.
router.post(
  '/',
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({ body: upsertSchema }),
  asyncHandler(async (req, res) => {
    let slug = slugify(req.body.title);
    if (await prisma.knowledgeArticle.findUnique({ where: { slug } })) slug = `${slug}-${Date.now().toString(36)}`;
    const article = await prisma.knowledgeArticle.create({
      data: { ...req.body, slug, authorId: req.user.id },
    });
    await recordAudit({ entityType: 'KnowledgeArticle', entityId: article.id, action: 'CREATE', actor: req.user });
    res.status(201).json(article);
  }),
);

router.patch(
  '/:id',
  requireRole('TECHNICIAN', 'ADMIN'),
  validate({ body: upsertSchema.partial() }),
  asyncHandler(async (req, res) => {
    const article = await prisma.knowledgeArticle.update({ where: { id: req.params.id }, data: req.body });
    await recordAudit({ entityType: 'KnowledgeArticle', entityId: article.id, action: 'UPDATE', actor: req.user });
    res.json(article);
  }),
);

router.delete(
  '/:id',
  requireRole('ADMIN'),
  asyncHandler(async (req, res) => {
    await prisma.knowledgeArticle.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }),
);

export default router;
