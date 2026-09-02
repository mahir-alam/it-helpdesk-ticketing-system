import { jest } from '@jest/globals';

// Mock the Prisma singleton so number allocation is tested without a database.
const findFirst = jest.fn();
const create = jest.fn();

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: { ticket: { findFirst, create } },
}));

const { nextNumber, createWithNumber } = await import('../src/lib/sequence.js');

beforeEach(() => jest.clearAllMocks());

describe('nextNumber', () => {
  it('starts at 000001 when the table is empty', async () => {
    findFirst.mockResolvedValueOnce(null);
    expect(await nextNumber('ticket')).toBe('INC-000001');
  });

  it('is one past the highest existing number', async () => {
    findFirst.mockResolvedValueOnce({ number: 'INC-000073' });
    expect(await nextNumber('ticket')).toBe('INC-000074');
    expect(findFirst).toHaveBeenCalledWith({ orderBy: { number: 'desc' }, select: { number: true } });
  });

  it('does not reuse a number after a lower-numbered row is deleted', async () => {
    // A row was deleted so COUNT(*) would now say 72, but the max is still 73.
    findFirst.mockResolvedValueOnce({ number: 'INC-000073' });
    expect(await nextNumber('ticket')).toBe('INC-000074');
  });

  it('throws for a model with no registered prefix', async () => {
    await expect(nextNumber('nope')).rejects.toThrow(/prefix/);
  });
});

describe('createWithNumber', () => {
  it('retries on a unique collision and advances to the next number', async () => {
    findFirst
      .mockResolvedValueOnce({ number: 'INC-000010' }) // attempt 1 -> INC-000011
      .mockResolvedValueOnce({ number: 'INC-000011' }); // attempt 2 -> INC-000012
    const p2002 = Object.assign(new Error('unique constraint'), { code: 'P2002' });
    create
      .mockRejectedValueOnce(p2002)
      .mockResolvedValueOnce({ id: 't1', number: 'INC-000012' });

    const row = await createWithNumber('ticket', { title: 'x' });

    expect(row).toEqual({ id: 't1', number: 'INC-000012' });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data.number).toBe('INC-000011');
    expect(create.mock.calls[1][0].data.number).toBe('INC-000012');
  });

  it('gives up after 5 attempts on a persistent collision', async () => {
    findFirst.mockResolvedValue({ number: 'INC-000005' });
    const p2002 = Object.assign(new Error('unique'), { code: 'P2002' });
    create.mockRejectedValue(p2002);
    await expect(createWithNumber('ticket', { title: 'x' })).rejects.toBe(p2002);
    expect(create).toHaveBeenCalledTimes(5);
  });
});
