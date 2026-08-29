import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export function toPrismaPage({ page, pageSize }) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildOrderBy({ sort, order }, allowed, fallback = { createdAt: 'desc' }) {
  if (sort && allowed.includes(sort)) return { [sort]: order };
  return fallback;
}

export function paginated(items, total, { page, pageSize }) {
  return {
    items,
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}
