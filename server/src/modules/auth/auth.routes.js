import { Router } from 'express';
import { asyncHandler } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, signToken } from '../../middleware/auth.js';
import { loginSchema, registerSchema } from './auth.validation.js';
import { publicUser, registerUser, verifyCredentials } from './auth.service.js';
import { recordAudit } from '../../services/auditLog.js';
import { loginRateLimiter, registerRateLimiter } from '../../middleware/rateLimit.js';

const router = Router();

router.post(
  '/register',
  registerRateLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const user = await registerUser(req.body);
    await recordAudit({ entityType: 'User', entityId: user.id, action: 'CREATE', actor: user });
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.post(
  '/login',
  loginRateLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const user = await verifyCredentials(req.body);
    res.json({ token: signToken(user), user: publicUser(user) });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) });
  }),
);

export default router;
