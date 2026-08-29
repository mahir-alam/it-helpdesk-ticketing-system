// Client-side mirror of the backend ITIL matrix — used ONLY to preview the
// computed priority as the user picks Impact/Urgency. The backend remains the
// single source of truth; the server recomputes and stores priority on submit.

const MATRIX = {
  ENTIRE_COMPANY: { SYSTEM_DOWN: 'P1', WORK_DEGRADED: 'P2', WORKAROUND_AVAILABLE: 'P3' },
  DEPARTMENT: { SYSTEM_DOWN: 'P2', WORK_DEGRADED: 'P3', WORKAROUND_AVAILABLE: 'P3' },
  SINGLE_USER: { SYSTEM_DOWN: 'P3', WORK_DEGRADED: 'P4', WORKAROUND_AVAILABLE: 'P4' },
};

export const IMPACT_OPTIONS = [
  { value: 'SINGLE_USER', label: 'Single user' },
  { value: 'DEPARTMENT', label: 'A department / team' },
  { value: 'ENTIRE_COMPANY', label: 'Entire company' },
];

export const URGENCY_OPTIONS = [
  { value: 'WORKAROUND_AVAILABLE', label: 'Workaround available' },
  { value: 'WORK_DEGRADED', label: 'Work is degraded' },
  { value: 'SYSTEM_DOWN', label: 'System is down' },
];

export const PRIORITY_LABEL = {
  P1: 'P1 — Critical',
  P2: 'P2 — High',
  P3: 'P3 — Moderate',
  P4: 'P4 — Low',
};

export function previewPriority(impact, urgency) {
  if (!impact || !urgency) return null;
  return MATRIX[impact]?.[urgency] ?? null;
}
