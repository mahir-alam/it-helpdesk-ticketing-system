import { prisma } from './prisma.js';

const PREFIXES = {
  ticket: 'INC',
  changeRequest: 'CHG',
  serviceRequest: 'REQ',
  problem: 'PRB',
};

/**
 * Generate the next human-friendly record number for a model, e.g. "INC-000123".
 *
 * Derived from the highest existing number, not the row count. A count-based
 * scheme reuses a number as soon as any row is deleted, and that number then
 * collides forever against the unique `number` column. Numbers are fixed-width
 * zero-padded, so the lexically-greatest row is also the numerically-greatest.
 *
 * Two concurrent creates can still land on the same value; the caller creates
 * inside a retry loop (see `createWithNumber`) and the retry re-reads the max.
 */
export async function nextNumber(modelName) {
  const prefix = PREFIXES[modelName];
  if (!prefix) throw new Error(`No number prefix registered for model "${modelName}"`);
  const last = await prisma[modelName].findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const lastSeq = last ? Number.parseInt(last.number.slice(prefix.length + 1), 10) : 0;
  const next = Number.isFinite(lastSeq) ? lastSeq + 1 : 1;
  return `${prefix}-${String(next).padStart(6, '0')}`;
}

/**
 * Create a record, assigning `number` automatically and retrying on a unique
 * collision (Prisma error P2002) so concurrent inserts still succeed.
 */
export async function createWithNumber(modelName, data, options = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = await nextNumber(modelName);
    try {
      return await prisma[modelName].create({ data: { ...data, number }, ...options });
    } catch (err) {
      if (err?.code === 'P2002' && attempt < 4) continue;
      throw err;
    }
  }
  throw new Error(`Could not allocate a unique number for ${modelName} after retries`);
}
