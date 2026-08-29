import { jest } from '@jest/globals';
import {
  computePriority,
  isCriticalCombination,
  evaluateTicketPriority,
  InvalidMatrixInputError,
  IMPACT,
  URGENCY,
} from '../src/modules/priority/priorityMatrix.js';

describe('computePriority — ITIL Impact × Urgency matrix', () => {
  // The full, explicit 3×3 expectation table. If a cell changes, this must change.
  const EXPECTED = {
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

  for (const impact of IMPACT) {
    for (const urgency of URGENCY) {
      it(`${impact} × ${urgency} → ${EXPECTED[impact][urgency]}`, () => {
        expect(computePriority(impact, urgency)).toBe(EXPECTED[impact][urgency]);
      });
    }
  }

  it('covers all 9 combinations with no gaps', () => {
    const results = IMPACT.flatMap((i) => URGENCY.map((u) => computePriority(i, u)));
    expect(results).toHaveLength(9);
    expect(results.every((p) => ['P1', 'P2', 'P3', 'P4'].includes(p))).toBe(true);
  });

  it('only ENTIRE_COMPANY + SYSTEM_DOWN yields P1', () => {
    const p1s = IMPACT.flatMap((i) =>
      URGENCY.filter((u) => computePriority(i, u) === 'P1').map((u) => `${i}/${u}`),
    );
    expect(p1s).toEqual(['ENTIRE_COMPANY/SYSTEM_DOWN']);
  });
});

describe('input validation', () => {
  it('rejects an unknown impact', () => {
    expect(() => computePriority('WHOLE_PLANET', 'SYSTEM_DOWN')).toThrow(InvalidMatrixInputError);
  });
  it('rejects an unknown urgency', () => {
    expect(() => computePriority('DEPARTMENT', 'ON_FIRE')).toThrow(InvalidMatrixInputError);
  });
  it('rejects a user-supplied priority string (priority is never an input)', () => {
    expect(() => computePriority('P1', 'P1')).toThrow(InvalidMatrixInputError);
  });
});

describe('isCriticalCombination', () => {
  it('is true only for ENTIRE_COMPANY + SYSTEM_DOWN', () => {
    expect(isCriticalCombination('ENTIRE_COMPANY', 'SYSTEM_DOWN')).toBe(true);
    expect(isCriticalCombination('DEPARTMENT', 'SYSTEM_DOWN')).toBe(false);
    expect(isCriticalCombination('ENTIRE_COMPANY', 'WORK_DEGRADED')).toBe(false);
  });
});

describe('evaluateTicketPriority — escalation flags', () => {
  it('P1 requires on-call routing and an alert', () => {
    const r = evaluateTicketPriority('ENTIRE_COMPANY', 'SYSTEM_DOWN');
    expect(r).toMatchObject({
      priority: 'P1',
      isCritical: true,
      forcedCritical: true,
      requiresOnCallRouting: true,
      requiresAlert: true,
    });
  });

  it('P2 does not trigger on-call routing or an alert', () => {
    const r = evaluateTicketPriority('DEPARTMENT', 'SYSTEM_DOWN');
    expect(r.priority).toBe('P2');
    expect(r.requiresOnCallRouting).toBe(false);
    expect(r.requiresAlert).toBe(false);
  });

  it('a P1 reached without the forced combination still alerts but is not "forcedCritical"', () => {
    // No such combination exists today, but the flag semantics must hold:
    const r = evaluateTicketPriority('ENTIRE_COMPANY', 'SYSTEM_DOWN');
    expect(r.forcedCritical).toBe(true);
    const r2 = evaluateTicketPriority('SINGLE_USER', 'WORKAROUND_AVAILABLE');
    expect(r2.forcedCritical).toBe(false);
    expect(r2.requiresAlert).toBe(false);
  });
});

// Guard against accidental console noise from the module under test.
afterAll(() => jest.restoreAllMocks());
