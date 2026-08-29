import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const PRIORITY_COLORS = {
  P1: 0xd7263d, // red
  P2: 0xf46036, // orange
  P3: 0x2e86ab, // blue
  P4: 0x6c757d, // grey
};

/**
 * Fire an alert to the configured Discord webhook. Never throws — the caller's
 * flow (creating a P1 ticket) must not fail because an alert channel is down or
 * unconfigured. Every attempt is persisted to WebhookDelivery for verifiability.
 */
export async function sendTicketAlert(ticket, { event = 'ticket.p1_created', reason } = {}) {
  const title =
    event === 'ticket.sla_breached'
      ? `🚨 SLA BREACH — ${ticket.priority} ${ticket.number}`
      : `🚨 ${ticket.priority} incident raised — ${ticket.number}`;

  const payload = {
    username: 'Help Desk Ops',
    embeds: [
      {
        title,
        description: ticket.title,
        color: PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.P3,
        fields: [
          { name: 'Priority', value: ticket.priority, inline: true },
          { name: 'Impact', value: ticket.impact, inline: true },
          { name: 'Urgency', value: ticket.urgency, inline: true },
          { name: 'Category', value: ticket.category ?? 'n/a', inline: true },
          { name: 'Source', value: ticket.source, inline: true },
          {
            name: 'Resolve by (SLA)',
            value: ticket.slaResolveDueAt ? new Date(ticket.slaResolveDueAt).toISOString() : 'n/a',
            inline: true,
          },
          ...(reason ? [{ name: 'Trigger', value: reason }] : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const delivery = await prisma.webhookDelivery.create({
    data: { event, targetUrl: env.discordWebhookUrl || '(not configured)', payload, status: 'PENDING' },
  });

  if (!env.discordWebhookUrl) {
    logger.warn(`DISCORD_WEBHOOK_URL not set — alert for ${ticket.number} logged only (delivery ${delivery.id})`);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', error: 'DISCORD_WEBHOOK_URL not configured' },
    });
    return { delivered: false, deliveryId: delivery.id };
  }

  try {
    const res = await fetch(env.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: res.ok ? 'SUCCESS' : 'FAILED',
        responseCode: res.status,
        error: res.ok ? null : `HTTP ${res.status}`,
      },
    });
    if (!res.ok) logger.warn(`Discord alert for ${ticket.number} returned HTTP ${res.status}`);
    return { delivered: res.ok, deliveryId: delivery.id };
  } catch (err) {
    logger.error(`Discord alert for ${ticket.number} failed: ${err.message}`);
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: { status: 'FAILED', error: err.message },
    });
    return { delivered: false, deliveryId: delivery.id };
  }
}
