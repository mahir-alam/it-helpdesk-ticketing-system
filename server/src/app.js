import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import apiRoutes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export function createApp() {
  const app = express();

  // Behind a single hosting proxy (Render/Vercel) — required so req.ip is the
  // real client address and per-IP rate limiting buckets correctly.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.clientUrl === '*' ? true : env.clientUrl.split(','), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  if (!env.isTest) app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.get('/', (_req, res) => res.json({ name: 'IT Help Desk Ticket Tracker API', docs: '/api/health' }));
  app.use('/api', apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
