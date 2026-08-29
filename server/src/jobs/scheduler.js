import cron from 'node-cron';
import { logger } from '../lib/logger.js';
import { runSlaEscalationSweep } from './slaEscalation.job.js';
import { sweepRecurringProblems } from '../modules/problems/problemDetection.service.js';
import { loadSlaPolicies } from '../modules/sla/sla.service.js';

let tasks = [];

async function guard(name, fn) {
  try {
    await fn();
  } catch (err) {
    logger.error(`Scheduled job "${name}" failed: ${err.message}`);
  }
}

export function startSchedulers() {
  loadSlaPolicies().catch((err) => logger.error(`Failed to preload SLA policies: ${err.message}`));

  // SLA escalation — every minute
  tasks.push(
    cron.schedule('* * * * *', () => guard('sla-escalation', runSlaEscalationSweep), { name: 'sla-escalation' }),
  );

  // Recurring-incident (Problem) detection sweep — every 5 minutes
  tasks.push(
    cron.schedule('*/5 * * * *', () => guard('problem-detection', sweepRecurringProblems), {
      name: 'problem-detection',
    }),
  );

  logger.info(`Registered ${tasks.length} scheduled jobs`);
}

export function stopSchedulers() {
  tasks.forEach((t) => t.stop());
  tasks = [];
}
