import { prisma } from '../../lib/prisma.js';

// Fallback SLA targets (minutes) if SlaPolicy rows are missing. Seeded to match.
export const DEFAULT_SLA = {
  P1: { responseMinutes: 15, resolveMinutes: 240 },
  P2: { responseMinutes: 30, resolveMinutes: 480 },
  P3: { responseMinutes: 240, resolveMinutes: 1440 },
  P4: { responseMinutes: 480, resolveMinutes: 4320 },
};

let cache = null;

export async function loadSlaPolicies() {
  const rows = await prisma.slaPolicy.findMany();
  cache = {};
  for (const priority of Object.keys(DEFAULT_SLA)) {
    const row = rows.find((r) => r.priority === priority);
    cache[priority] = row
      ? { responseMinutes: row.responseMinutes, resolveMinutes: row.resolveMinutes }
      : DEFAULT_SLA[priority];
  }
  return cache;
}

export async function getSlaPolicy(priority) {
  if (!cache) await loadSlaPolicies();
  return cache[priority] ?? DEFAULT_SLA[priority];
}

export function clearSlaCache() {
  cache = null;
}

/**
 * Compute SLA due timestamps from a start time and priority.
 * Wall-clock minutes (not business hours) — deliberate, so the demo shows
 * breaches and escalations within a short window.
 */
export async function computeSlaDueDates(priority, startedAt = new Date()) {
  const policy = await getSlaPolicy(priority);
  const start = startedAt instanceof Date ? startedAt : new Date(startedAt);
  return {
    slaResponseDueAt: new Date(start.getTime() + policy.responseMinutes * 60_000),
    slaResolveDueAt: new Date(start.getTime() + policy.resolveMinutes * 60_000),
  };
}
