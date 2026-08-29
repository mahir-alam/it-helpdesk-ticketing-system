import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { recordAudit } from '../services/auditLog.js';
import { sendTicketAlert } from '../services/webhook.js';

/**
 * SLA sweep — runs on a cron. For every open ticket past a due timestamp:
 *  - flips slaStatus to RESPONSE_BREACHED / RESOLVE_BREACHED
 *  - stamps escalatedAt and writes an SlaEvent + AuditLog entry
 *  - re-fires the Discord alert once, on the resolve breach
 */
export async function runSlaEscalationSweep(now = new Date()) {
  const open = await prisma.ticket.findMany({
    where: {
      status: { notIn: ['RESOLVED', 'CLOSED'] },
      slaStatus: { notIn: ['RESOLVE_BREACHED'] },
    },
  });

  let responseBreaches = 0;
  let resolveBreaches = 0;

  for (const ticket of open) {
    const pastResponse =
      ticket.slaResponseDueAt && !ticket.firstRespondedAt && now > ticket.slaResponseDueAt;
    const pastResolve = ticket.slaResolveDueAt && now > ticket.slaResolveDueAt;

    if (!pastResponse && !pastResolve) continue;

    const nextStatus = pastResolve ? 'RESOLVE_BREACHED' : 'RESPONSE_BREACHED';
    if (nextStatus === ticket.slaStatus) continue;

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { slaStatus: nextStatus, escalatedAt: ticket.escalatedAt ?? now },
    });
    await prisma.slaEvent.create({
      data: {
        ticketId: ticket.id,
        type: pastResolve ? 'RESOLVE_BREACH' : 'RESPONSE_BREACH',
        note: `Auto-detected by SLA sweep at ${now.toISOString()}`,
      },
    });
    await recordAudit({
      entityType: 'Ticket',
      entityId: ticket.id,
      action: 'SLA_BREACH',
      field: 'slaStatus',
      oldValue: ticket.slaStatus,
      newValue: nextStatus,
      actor: 'system:sla-monitor',
    });

    if (pastResolve) {
      resolveBreaches += 1;
      await sendTicketAlert(ticket, {
        event: 'ticket.sla_breached',
        reason: `Resolve SLA breached (due ${ticket.slaResolveDueAt?.toISOString()})`,
      }).catch(() => {});
    } else {
      responseBreaches += 1;
    }
  }

  if (responseBreaches || resolveBreaches) {
    logger.info(`SLA sweep: ${responseBreaches} response breach(es), ${resolveBreaches} resolve breach(es)`);
  }
  return { scanned: open.length, responseBreaches, resolveBreaches };
}
