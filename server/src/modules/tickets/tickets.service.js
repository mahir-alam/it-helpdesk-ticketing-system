import { prisma } from '../../lib/prisma.js';
import { createWithNumber } from '../../lib/sequence.js';
import { badRequest } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { evaluateTicketPriority } from '../priority/priorityMatrix.js';
import { computeSlaDueDates } from '../sla/sla.service.js';
import { recordAudit } from '../../services/auditLog.js';
import { sendTicketAlert } from '../../services/webhook.js';
import { detectRecurringProblem } from '../problems/problemDetection.service.js';

export const TICKET_DETAIL_INCLUDE = {
  requester: { select: { id: true, name: true, email: true, department: true } },
  assignee: { select: { id: true, name: true, email: true, role: true } },
  template: { select: { id: true, name: true } },
  problem: { select: { id: true, number: true, title: true, status: true } },
  comments: {
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true, role: true } } },
  },
  checklistItems: { orderBy: { order: 'asc' } },
  technicianActions: {
    orderBy: { createdAt: 'desc' },
    include: { technician: { select: { id: true, name: true } } },
  },
  slaEvents: { orderBy: { createdAt: 'desc' } },
  csatRating: true,
  affectedAssets: { include: { asset: { select: { id: true, assetTag: true, name: true, type: true } } } },
};

// Allowed status transitions. Reopen paths included for staff.
const TRANSITIONS = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'OPEN', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: ['IN_PROGRESS'],
};

export function assertTransition(from, to) {
  if (from === to) return;
  if (!TRANSITIONS[from]?.includes(to)) {
    throw badRequest(`Illegal status transition ${from} → ${to}`);
  }
}

async function pickOnCallTechnician() {
  return prisma.user.findFirst({
    where: { isOnCall: true, isActive: true, role: { in: ['TECHNICIAN', 'ADMIN'] } },
    orderBy: { updatedAt: 'asc' },
  });
}

async function seedChecklistFromSop(ticketId, category, tx = prisma) {
  const sop = await tx.sopTemplate.findUnique({ where: { category }, include: { items: true } });
  if (!sop || sop.items.length === 0) return 0;
  await tx.checklistItem.createMany({
    data: sop.items
      .sort((a, b) => a.order - b.order)
      .map((item) => ({ ticketId, label: item.label, order: item.order })),
  });
  return sop.items.length;
}

/**
 * Core ticket creation. `origin` is 'user' or 'system'. For system tickets,
 * `requester` may be null and `externalSource`/`externalRef` are set.
 */
export async function createTicket({ input, requester, origin = 'user' }) {
  const { title, description, category, impact, urgency, templateId, assetIds = [], externalSource, externalRef } = input;

  const evaluation = evaluateTicketPriority(impact, urgency);
  const now = new Date();
  const sla = await computeSlaDueDates(evaluation.priority, now);

  // P1 → auto-route to the on-call technician
  let assigneeId = null;
  let onCall = null;
  if (evaluation.requiresOnCallRouting) {
    onCall = await pickOnCallTechnician();
    assigneeId = onCall?.id ?? null;
  }

  const ticket = await createWithNumber('ticket', {
    title,
    description,
    category,
    impact,
    urgency,
    priority: evaluation.priority,
    source: origin === 'system' ? 'SYSTEM_GENERATED' : 'USER_SUBMITTED',
    status: 'OPEN',
    slaStatus: 'ON_TRACK',
    slaResponseDueAt: sla.slaResponseDueAt,
    slaResolveDueAt: sla.slaResolveDueAt,
    ...(requester ? { requesterId: requester.id } : {}),
    ...(externalSource ? { externalSource } : {}),
    ...(externalRef ? { externalRef } : {}),
    ...(templateId ? { templateId } : {}),
    ...(assigneeId ? { assigneeId } : {}),
    ...(assetIds.length
      ? { affectedAssets: { create: assetIds.map((assetId) => ({ assetId })) } }
      : {}),
  });

  const actor = requester ?? `system:${externalSource ?? 'unknown'}`;
  await recordAudit({ entityType: 'Ticket', entityId: ticket.id, action: 'CREATE', actor });
  await recordAudit({
    entityType: 'Ticket',
    entityId: ticket.id,
    action: 'PRIORITY_COMPUTED',
    field: 'priority',
    newValue: `${evaluation.priority} (impact=${impact}, urgency=${urgency})`,
    actor,
  });

  await seedChecklistFromSop(ticket.id, category);

  if (assigneeId) {
    await recordAudit({
      entityType: 'Ticket',
      entityId: ticket.id,
      action: 'ASSIGNMENT_CHANGE',
      field: 'assigneeId',
      newValue: `${onCall.name} (on-call auto-route)`,
      actor: 'system:priority-engine',
    });
  } else if (evaluation.requiresOnCallRouting) {
    logger.warn(`P1 ${ticket.number} created but no on-call technician is set`);
    await recordAudit({
      entityType: 'Ticket',
      entityId: ticket.id,
      action: 'ESCALATION_NOTE',
      newValue: 'P1 created with no on-call technician configured',
      actor: 'system:priority-engine',
    });
  }

  // Async alert for P1s — never blocks or fails ticket creation
  if (evaluation.requiresAlert) {
    sendTicketAlert(ticket, {
      event: 'ticket.p1_created',
      reason: evaluation.forcedCritical
        ? 'Impact=ENTIRE_COMPANY + Urgency=SYSTEM_DOWN forces P1'
        : 'Computed priority P1',
    }).catch((err) => logger.error(`P1 alert dispatch failed for ${ticket.number}: ${err.message}`));
  }

  // Best-effort recurring-incident detection (also runs on a cron sweep)
  detectRecurringProblem(ticket).catch((err) =>
    logger.error(`Problem detection failed for ${ticket.number}: ${err.message}`),
  );

  return prisma.ticket.findUnique({ where: { id: ticket.id }, include: TICKET_DETAIL_INCLUDE });
}

/** Apply a status change with the side effects each transition implies. */
export async function changeStatus({ ticket, to, actor }) {
  assertTransition(ticket.status, to);
  const data = { status: to };
  const nowStamp = new Date();

  if (to === 'IN_PROGRESS' && !ticket.firstRespondedAt) data.firstRespondedAt = nowStamp;
  if (to === 'RESOLVED') {
    data.resolvedAt = nowStamp;
    if (!['RESPONSE_BREACHED', 'RESOLVE_BREACHED'].includes(ticket.slaStatus)) data.slaStatus = 'MET';
  }
  if (to === 'CLOSED') data.closedAt = ticket.closedAt ?? nowStamp;
  if ((to === 'IN_PROGRESS' || to === 'OPEN') && ticket.status === 'RESOLVED') {
    data.resolvedAt = null; // reopened
  }

  const updated = await prisma.ticket.update({ where: { id: ticket.id }, data });
  await recordAudit({
    entityType: 'Ticket',
    entityId: ticket.id,
    action: 'STATUS_CHANGE',
    field: 'status',
    oldValue: ticket.status,
    newValue: to,
    actor,
  });
  return updated;
}

export async function markFirstResponse(ticket, actor) {
  if (ticket.firstRespondedAt) return ticket;
  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: { firstRespondedAt: new Date() },
  });
  await recordAudit({
    entityType: 'Ticket',
    entityId: ticket.id,
    action: 'FIRST_RESPONSE',
    field: 'firstRespondedAt',
    newValue: updated.firstRespondedAt.toISOString(),
    actor,
  });
  return updated;
}

/** Recompute priority + SLA from new impact/urgency. Priority is never set directly. */
export async function reprioritize({ ticket, impact, urgency, reason, actor }) {
  const evaluation = evaluateTicketPriority(impact, urgency);
  const sla = await computeSlaDueDates(evaluation.priority, ticket.createdAt);

  const updated = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      impact,
      urgency,
      priority: evaluation.priority,
      slaResponseDueAt: sla.slaResponseDueAt,
      slaResolveDueAt: sla.slaResolveDueAt,
    },
  });

  await recordAudit({
    entityType: 'Ticket',
    entityId: ticket.id,
    action: 'PRIORITY_CHANGE',
    field: 'priority',
    oldValue: ticket.priority,
    newValue: `${evaluation.priority} (impact=${impact}, urgency=${urgency})${reason ? ` — ${reason}` : ''}`,
    actor,
  });

  if (evaluation.priority === 'P1' && ticket.priority !== 'P1') {
    sendTicketAlert(updated, { event: 'ticket.p1_created', reason: 'Reprioritised to P1' }).catch(() => {});
  }
  return updated;
}
