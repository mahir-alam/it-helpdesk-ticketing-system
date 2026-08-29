/**
 * ITIL-standard Impact × Urgency priority matrix.
 *
 * This is the core "engineering logic" of the tracker: a requester supplies
 * Impact and Urgency only — they can NEVER pick a priority directly. Priority
 * (P1–P4) is derived here, on the backend, and stored on the ticket.
 *
 *                       Urgency
 *                | Workaround | Degraded | System Down |
 *   Impact  -----+------------+----------+-------------+
 *   Entire Co.   |    P3      |   P2     |   P1        |
 *   Department   |    P3      |   P3     |   P2        |
 *   Single User  |    P4      |   P4     |   P3        |
 *
 * Hard rule: ENTIRE_COMPANY + SYSTEM_DOWN is always P1-Critical and triggers
 * SLA timer start + on-call auto-assignment + the Discord alert.
 */

export const IMPACT = ['SINGLE_USER', 'DEPARTMENT', 'ENTIRE_COMPANY'];
export const URGENCY = ['WORKAROUND_AVAILABLE', 'WORK_DEGRADED', 'SYSTEM_DOWN'];
export const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

const MATRIX = {
  ENTIRE_COMPANY: {
    SYSTEM_DOWN: 'P1',
    WORK_DEGRADED: 'P2',
    WORKAROUND_AVAILABLE: 'P3',
  },
  DEPARTMENT: {
    SYSTEM_DOWN: 'P2',
    WORK_DEGRADED: 'P3',
    WORKAROUND_AVAILABLE: 'P3',
  },
  SINGLE_USER: {
    SYSTEM_DOWN: 'P3',
    WORK_DEGRADED: 'P4',
    WORKAROUND_AVAILABLE: 'P4',
  },
};

export const PRIORITY_LABELS = {
  P1: 'P1 — Critical',
  P2: 'P2 — High',
  P3: 'P3 — Moderate',
  P4: 'P4 — Low',
};

export class InvalidMatrixInputError extends Error {
  constructor(field, value) {
    super(`Invalid ${field}: "${value}"`);
    this.name = 'InvalidMatrixInputError';
    this.field = field;
  }
}

/**
 * @param {'SINGLE_USER'|'DEPARTMENT'|'ENTIRE_COMPANY'} impact
 * @param {'WORKAROUND_AVAILABLE'|'WORK_DEGRADED'|'SYSTEM_DOWN'} urgency
 * @returns {'P1'|'P2'|'P3'|'P4'}
 */
export function computePriority(impact, urgency) {
  if (!IMPACT.includes(impact)) throw new InvalidMatrixInputError('impact', impact);
  if (!URGENCY.includes(urgency)) throw new InvalidMatrixInputError('urgency', urgency);
  return MATRIX[impact][urgency];
}

/** True when this combination must be forced to P1 with full escalation. */
export function isCriticalCombination(impact, urgency) {
  return impact === 'ENTIRE_COMPANY' && urgency === 'SYSTEM_DOWN';
}

/** Full computed result including whether escalation must fire. */
export function evaluateTicketPriority(impact, urgency) {
  const priority = computePriority(impact, urgency);
  return {
    priority,
    label: PRIORITY_LABELS[priority],
    isCritical: priority === 'P1',
    forcedCritical: isCriticalCombination(impact, urgency),
    requiresOnCallRouting: priority === 'P1',
    requiresAlert: priority === 'P1',
  };
}
