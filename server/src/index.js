import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { startSchedulers } from './jobs/scheduler.js';

const app = createApp();

const server = app.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  if (env.enableCron) {
    startSchedulers();
    logger.info('Background schedulers started (SLA escalation, problem detection)');
  } else {
    logger.info('Background schedulers disabled (ENABLE_CRON=false or test env)');
  }
});

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
