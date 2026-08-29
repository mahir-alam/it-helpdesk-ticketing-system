import express from 'express';
import request from 'supertest';
import { makeLoginRateLimiter, makeRegisterRateLimiter } from '../src/middleware/rateLimit.js';

// Each test builds its own limiter so the in-memory store is isolated.
// `validate: false` just silences express-rate-limit's proxy/header advisories
// in the test runner — it does not change the limiting behaviour.
function appWith(limiter, finalHandler) {
  const app = express();
  app.use(express.json());
  app.post('/x', limiter, finalHandler);
  return app;
}

describe('login rate limiter', () => {
  it('allows 10 failed attempts, then 429s the 11th with a clear message', async () => {
    const app = appWith(makeLoginRateLimiter({ validate: false }), (_req, res) =>
      res.status(401).json({ error: 'Unauthorized' }),
    );

    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/x').send({});
      expect(res.status).toBe(401);
    }

    const blocked = await request(app).post('/x').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ error: 'TooManyRequests' });
    expect(blocked.body.message).toMatch(/failed login attempts/i);
  });

  it('does not count successful logins toward the limit', async () => {
    const app = appWith(makeLoginRateLimiter({ validate: false }), (_req, res) => res.json({ ok: true }));

    for (let i = 0; i < 15; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/x').send({});
      expect(res.status).toBe(200);
    }
  });
});

describe('register rate limiter', () => {
  it('allows 5 registrations, then 429s the 6th', async () => {
    const app = appWith(makeRegisterRateLimiter({ validate: false }), (_req, res) =>
      res.status(201).json({ ok: true }),
    );

    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app).post('/x').send({});
      expect(res.status).toBe(201);
    }

    const blocked = await request(app).post('/x').send({});
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ error: 'TooManyRequests' });
    expect(blocked.body.message).toMatch(/accounts created/i);
  });
});
