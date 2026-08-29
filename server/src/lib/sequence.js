import { prisma } from './prisma.js';

const PREFIXES = {
  ticket: 'INC',
  changeRequest: 'CHG',
  serviceRequest: 'REQ',
  problem: 'PRB',
};

/**
 * Generate the next human-friendly record number for a model, e.g. "INC-000123".
 * Count-based; the caller should create inside a retry loop (see `createWithNumber`)
 * because two concurrent creates can briefly collide on the unique `number`.
 */
export async function nextNumber(modelName) {
  const prefix = PREFIXES[modelName];
  if (!prefix) throw new Error(`No number prefix registered for model "${modelName}"`);
  const count = await prisma[modelName].count();
  return `${prefix}-${String(count + 1).padStart(6, '0')}`;
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
