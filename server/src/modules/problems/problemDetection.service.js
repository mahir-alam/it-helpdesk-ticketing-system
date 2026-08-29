import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { createWithNumber } from '../../lib/sequence.js';
import { extractKeywords, sharedKeywordCount } from '../../lib/keywords.js';
import { recordAudit } from '../../services/auditLog.js';
import { sendTicketAlert } from '../../services/webhook.js';

const MIN_SHARED_KEYWORDS = 2;

/**
 * ITIL Problem Management — recurring-incident detection.
 *
 * When THRESHOLD+ tickets in the same category, sharing >= 2 content keywords,
 * arrive inside the configured window, flag a Problem record linking them
 * ("potential linked outage"). Runs best-effort on ticket creation and on a
 * cron sweep.
 *
 * @returns {Promise<{problemId: string, linked: number, created: boolean} | null>}
 */
export async function detectRecurringProblem(ticket) {
  const { threshold, windowMinutes } = env.problemDetection;
  if (ticket.problemId) return null;

  const since = new Date(Date.now() - windowMinutes * 60_000);
  const keywords = extractKeywords(ticket.title, ticket.description);
  if (keywords.length === 0) return null;

  const candidates = await prisma.ticket.findMany({
    where: {
      id: { not: ticket.id },
      category: ticket.category,
      createdAt: { gte: since },
      status: { not: 'CLOSED' },
    },
    select: { id: true, number: true, title: true, description: true, problemId: true },
  });

  const similar = candidates.filter(
    (c) => sharedKeywordCount(keywords, extractKeywords(c.title, c.description)) >= MIN_SHARED_KEYWORDS,
  );

  // this ticket + similar ones
  if (similar.length + 1 < threshold) return null;

  // Reuse an existing open auto-detected Problem for this cluster if one exists.
  const existingProblemId = similar.map((s) => s.problemId).find(Boolean);
  let problem;
  let created = false;

  if (existingProblemId) {
    problem = await prisma.problem.findUnique({ where: { id: existingProblemId } });
  }
  if (!problem) {
    const clusterKeywords = keywords.slice(0, 8);
    problem = await createWithNumber('problem', {
      title: `Potential linked outage — ${ticket.category}`,
      description:
        `Auto-detected by recurring-incident analysis: ${similar.length + 1} tickets in category ` +
        `"${ticket.category}" within ${windowMinutes} minutes sharing keywords [${clusterKeywords.join(', ')}].`,
      status: 'OPEN',
      category: ticket.category,
      keywords: clusterKeywords,
      autoDetected: true,
    });
    created = true;
    await recordAudit({
      entityType: 'Problem',
      entityId: problem.id,
      action: 'CREATE',
      newValue: 'auto-detected recurring incident cluster',
      actor: 'system:problem-detection',
    });
  }

  const toLink = [ticket.id, ...similar.filter((s) => s.problemId !== problem.id).map((s) => s.id)];
  await prisma.ticket.updateMany({ where: { id: { in: toLink } }, data: { problemId: problem.id } });
  await Promise.all(
    toLink.map((id) =>
      recordAudit({
        entityType: 'Ticket',
        entityId: id,
        action: 'PROBLEM_LINKED',
        field: 'problemId',
        newValue: problem.number,
        actor: 'system:problem-detection',
      }),
    ),
  );

  logger.info(
    `Problem detection: ${created ? 'created' : 'reused'} ${problem.number}, linked ${toLink.length} tickets`,
  );

  if (created) {
    sendTicketAlert(
      { ...ticket, title: `${problem.number}: ${problem.title}`, priority: ticket.priority ?? 'P2' },
      { event: 'ticket.p1_created', reason: `Recurring-incident cluster detected (${toLink.length} tickets)` },
    ).catch(() => {});
  }

  return { problemId: problem.id, linked: toLink.length, created };
}

/** Cron sweep: run detection over recent unlinked, non-closed tickets. */
export async function sweepRecurringProblems() {
  const { windowMinutes } = env.problemDetection;
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const recent = await prisma.ticket.findMany({
    where: { problemId: null, status: { not: 'CLOSED' }, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
  });
  let clusters = 0;
  for (const ticket of recent) {
    const result = await detectRecurringProblem(ticket).catch((err) => {
      logger.error(`sweep detection failed for ${ticket.number}: ${err.message}`);
      return null;
    });
    if (result?.created) clusters += 1;
  }
  return { scanned: recent.length, newClusters: clusters };
}
