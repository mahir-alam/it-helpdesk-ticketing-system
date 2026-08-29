import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock the Prisma singleton so the route is exercised without a database.
let currentUser = null;
const ticketFindUnique = jest.fn();
const ticketDelete = jest.fn();
const auditCreate = jest.fn();

jest.unstable_mockModule('../src/lib/prisma.js', () => ({
  prisma: {
    user: { findUnique: jest.fn(async () => currentUser) },
    ticket: { findUnique: ticketFindUnique, delete: ticketDelete },
    auditLog: { create: auditCreate },
  },
}));

const { createApp } = await import('../src/app.js');
const app = createApp();

const SECRET = process.env.JWT_SECRET || 'test-secret';
function authAs(role) {
  currentUser = { id: 'u1', name: 'Test', role, email: 'u@test.local', isActive: true };
  return `Bearer ${jwt.sign({ sub: 'u1', role, email: 'u@test.local' }, SECRET)}`;
}

beforeEach(() => {
  jest.clearAllMocks();
  ticketDelete.mockResolvedValue({});
  auditCreate.mockResolvedValue({});
});

describe('DELETE /api/tickets/:id — ADMIN only', () => {
  it('rejects an END_USER with 403 and never touches the ticket', async () => {
    const res = await request(app).delete('/api/tickets/abc').set('Authorization', authAs('END_USER'));
    expect(res.status).toBe(403);
    expect(ticketFindUnique).not.toHaveBeenCalled();
    expect(ticketDelete).not.toHaveBeenCalled();
  });

  it('rejects a TECHNICIAN with 403', async () => {
    const res = await request(app).delete('/api/tickets/abc').set('Authorization', authAs('TECHNICIAN'));
    expect(res.status).toBe(403);
    expect(ticketDelete).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).delete('/api/tickets/abc');
    expect(res.status).toBe(401);
  });

  it('lets an ADMIN delete: writes a DELETE audit entry, then removes the ticket, 204', async () => {
    ticketFindUnique.mockResolvedValueOnce({ id: 'abc', number: 'INC-000009', title: 'Printer down' });

    const res = await request(app).delete('/api/tickets/abc').set('Authorization', authAs('ADMIN'));

    expect(res.status).toBe(204);
    // audit recorded before the delete, with an identifiable label
    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(auditCreate.mock.calls[0][0].data).toMatchObject({
      entityType: 'Ticket',
      entityId: 'abc',
      action: 'DELETE',
      oldValue: 'INC-000009 — Printer down',
      actorId: 'u1',
    });
    // audit write happens before the row is removed
    expect(auditCreate.mock.invocationCallOrder[0]).toBeLessThan(ticketDelete.mock.invocationCallOrder[0]);
    expect(ticketDelete).toHaveBeenCalledWith({ where: { id: 'abc' } });
  });

  it('returns 404 for an ADMIN when the ticket does not exist', async () => {
    ticketFindUnique.mockResolvedValueOnce(null);
    const res = await request(app).delete('/api/tickets/missing').set('Authorization', authAs('ADMIN'));
    expect(res.status).toBe(404);
    expect(ticketDelete).not.toHaveBeenCalled();
  });
});
