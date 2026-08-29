import { jest } from '@jest/globals';

// Mock the Prisma singleton so SLA math is tested without a database.
jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: { slaPolicy: { findMany: jest.fn().mockResolvedValue([]) } },
}));

const { computeSlaDueDates, DEFAULT_SLA, clearSlaCache } = await import('../src/modules/sla/sla.service.js');

beforeEach(() => clearSlaCache());

describe('computeSlaDueDates — fallback policy (no DB rows)', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');

  it('P1: response +15m, resolve +4h', async () => {
    const { slaResponseDueAt, slaResolveDueAt } = await computeSlaDueDates('P1', start);
    expect(slaResponseDueAt.toISOString()).toBe('2026-01-01T00:15:00.000Z');
    expect(slaResolveDueAt.toISOString()).toBe('2026-01-01T04:00:00.000Z');
  });

  it('P3: response +4h, resolve +24h', async () => {
    const { slaResponseDueAt, slaResolveDueAt } = await computeSlaDueDates('P3', start);
    expect(slaResponseDueAt.toISOString()).toBe('2026-01-01T04:00:00.000Z');
    expect(slaResolveDueAt.toISOString()).toBe('2026-01-02T00:00:00.000Z');
  });

  it('every priority has a response target sooner than its resolve target', async () => {
    for (const p of Object.keys(DEFAULT_SLA)) {
      const { slaResponseDueAt, slaResolveDueAt } = await computeSlaDueDates(p, start);
      expect(slaResponseDueAt.getTime()).toBeLessThan(slaResolveDueAt.getTime());
    }
  });

  it('tighter priorities have tighter resolve targets', async () => {
    const due = {};
    for (const p of ['P1', 'P2', 'P3', 'P4']) {
      // eslint-disable-next-line no-await-in-loop
      due[p] = (await computeSlaDueDates(p, start)).slaResolveDueAt.getTime();
    }
    expect(due.P1).toBeLessThan(due.P2);
    expect(due.P2).toBeLessThan(due.P3);
    expect(due.P3).toBeLessThan(due.P4);
  });
});
