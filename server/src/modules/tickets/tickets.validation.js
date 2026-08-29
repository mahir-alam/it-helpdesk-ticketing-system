import { z } from 'zod';

const impact = z.enum(['SINGLE_USER', 'DEPARTMENT', 'ENTIRE_COMPANY']);
const urgency = z.enum(['WORKAROUND_AVAILABLE', 'WORK_DEGRADED', 'SYSTEM_DOWN']);

export const createTicketSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  category: z.string().min(1).max(80).trim(),
  impact,
  urgency,
  templateId: z.string().cuid().optional(),
  assetIds: z.array(z.string().cuid()).max(20).optional(),
});

// NOTE: no `priority` field anywhere — priority is always derived from impact × urgency.
export const autoCreateTicketSchema = z.object({
  title: z.string().min(3).max(200).trim(),
  description: z.string().min(1).max(5000).trim(),
  category: z.string().min(1).max(80).trim().default('System / Monitoring'),
  impact: impact.default('DEPARTMENT'),
  urgency: urgency.default('WORK_DEGRADED'),
  externalSource: z.string().min(1).max(120).trim(),
  externalRef: z.string().max(200).trim().optional(),
  assetTag: z.string().max(120).trim().optional(),
});

export const listTicketsSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['P1', 'P2', 'P3', 'P4']).optional(),
  category: z.string().max(80).optional(),
  source: z.enum(['USER_SUBMITTED', 'SYSTEM_GENERATED']).optional(),
  assigneeId: z.string().optional(),
  mine: z.coerce.boolean().optional(),
  unassigned: z.coerce.boolean().optional(),
  breached: z.coerce.boolean().optional(),
  q: z.string().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['createdAt', 'updatedAt', 'priority', 'status', 'slaResolveDueAt']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
    category: z.string().min(1).max(80).trim().optional(),
    assigneeId: z.string().cuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const reprioritizeSchema = z.object({
  impact,
  urgency,
  reason: z.string().max(500).trim().optional(),
});

export const assignSchema = z.object({
  assigneeId: z.string().cuid().nullable(),
});

export const commentSchema = z.object({
  body: z.string().min(1).max(5000).trim(),
  isInternal: z.boolean().default(false),
});
