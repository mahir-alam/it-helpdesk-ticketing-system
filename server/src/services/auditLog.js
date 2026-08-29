import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Append an audit-log entry. `actor` is either a User object (logged-in action)
 * or a string label like "system:fleet-asset-tracker" for machine actions.
 *
 * Audit writes must never break the request they describe, so failures are logged
 * and swallowed.
 */
export async function recordAudit({ entityType, entityId, action, field, oldValue, newValue, actor }) {
  const data = {
    entityType,
    entityId,
    action,
    field: field ?? null,
    oldValue: oldValue == null ? null : String(oldValue),
    newValue: newValue == null ? null : String(newValue),
  };
  if (actor && typeof actor === 'object' && actor.id) data.actorId = actor.id;
  else if (typeof actor === 'string') data.actorLabel = actor;

  try {
    await prisma.auditLog.create({ data });
  } catch (err) {
    logger.error('Failed to write audit log', { entityType, entityId, action, err: err.message });
  }
}

/**
 * Diff two objects across the given fields and emit one audit entry per change.
 */
export async function recordFieldChanges({ entityType, entityId, before, after, fields, actor, actionByField = {} }) {
  const jobs = [];
  for (const field of fields) {
    const oldValue = before?.[field];
    const newValue = after?.[field];
    if (String(oldValue ?? '') === String(newValue ?? '')) continue;
    jobs.push(
      recordAudit({
        entityType,
        entityId,
        action: actionByField[field] ?? `${field.toUpperCase()}_CHANGE`,
        field,
        oldValue,
        newValue,
        actor,
      }),
    );
  }
  await Promise.all(jobs);
}
