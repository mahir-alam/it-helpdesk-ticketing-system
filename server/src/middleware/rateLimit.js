import rateLimit from 'express-rate-limit';

function limitHandler(message) {
  // Clear, consistent 429 body matching the rest of the API's error shape.
  return (_req, res) => res.status(429).json({ error: 'TooManyRequests', message });
}

const loginConfig = () => ({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // per IP, per window
  skipSuccessfulRequests: true, // only FAILED logins count — never throttle a normal sign-in
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('Too many failed login attempts. Please wait 15 minutes and try again.'),
});

const registerConfig = () => ({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // per IP, per window — anti account-creation spam
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('Too many accounts created from this network. Please try again later.'),
});

/** Factories — used by tests so each case gets an isolated in-memory store. */
export const makeLoginRateLimiter = (overrides = {}) => rateLimit({ ...loginConfig(), ...overrides });
export const makeRegisterRateLimiter = (overrides = {}) => rateLimit({ ...registerConfig(), ...overrides });

/** Singletons wired into the auth routes. */
export const loginRateLimiter = makeLoginRateLimiter();
export const registerRateLimiter = makeRegisterRateLimiter();
