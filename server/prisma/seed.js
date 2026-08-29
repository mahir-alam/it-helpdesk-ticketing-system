import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { evaluateTicketPriority } from '../src/modules/priority/priorityMatrix.js';
import { DEFAULT_SLA } from '../src/modules/sla/sla.service.js';
import {
  DEPARTMENTS,
  TECHNICIANS,
  END_USERS,
  TICKET_TEMPLATES,
  SOP_TEMPLATES,
  SERVICE_CATALOG,
  KB_ARTICLES,
  CHANGE_REQUESTS,
} from './seed.data.js';
import { TICKET_SCENARIOS } from './seed.tickets.js';

const prisma = new PrismaClient();
const HOUR = 3_600_000;
const now = Date.now();

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@helpdesk.local';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin!2345';
const defaultPassword = process.env.SEED_DEFAULT_PASSWORD ?? 'Passw0rd!';

function slaDue(priority, createdAt) {
  const p = DEFAULT_SLA[priority];
  return {
    slaResponseDueAt: new Date(createdAt.getTime() + p.responseMinutes * 60_000),
    slaResolveDueAt: new Date(createdAt.getTime() + p.resolveMinutes * 60_000),
  };
}

async function wipe() {
  // Delete in FK-safe order (children first).
  await prisma.$transaction([
    prisma.auditLog.deleteMany(),
    prisma.webhookDelivery.deleteMany(),
    prisma.csatRating.deleteMany(),
    prisma.slaEvent.deleteMany(),
    prisma.technicianAction.deleteMany(),
    prisma.checklistItem.deleteMany(),
    prisma.ticketComment.deleteMany(),
    prisma.ticketAsset.deleteMany(),
    prisma.changeAsset.deleteMany(),
    prisma.assetLink.deleteMany(),
    prisma.knowledgeArticle.deleteMany(),
    prisma.ticket.deleteMany(),
    prisma.problem.deleteMany(),
    prisma.changeRequest.deleteMany(),
    prisma.serviceRequest.deleteMany(),
    prisma.serviceCatalogItem.deleteMany(),
    prisma.sopTemplateItem.deleteMany(),
    prisma.sopTemplate.deleteMany(),
    prisma.ticketTemplate.deleteMany(),
    prisma.slaPolicy.deleteMany(),
    prisma.asset.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedSla() {
  await prisma.slaPolicy.createMany({
    data: Object.entries(DEFAULT_SLA).map(([priority, v]) => ({ priority, ...v })),
  });
}

async function seedUsers() {
  const hash = await bcrypt.hash(defaultPassword, 10);
  const adminHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.create({
    data: { email: adminEmail, passwordHash: adminHash, name: 'Alex Admin', role: 'ADMIN', department: 'IT' },
  });

  const technicians = [];
  for (const t of TECHNICIANS) {
    technicians.push(
      // eslint-disable-next-line no-await-in-loop
      await prisma.user.create({
        data: {
          email: t.email,
          passwordHash: hash,
          name: t.name,
          role: 'TECHNICIAN',
          department: 'IT',
          isOnCall: Boolean(t.isOnCall),
        },
      }),
    );
  }

  const endUsers = [];
  for (const u of END_USERS) {
    endUsers.push(
      // eslint-disable-next-line no-await-in-loop
      await prisma.user.create({
        data: { email: u.email, passwordHash: hash, name: u.name, role: 'END_USER', department: u.department },
      }),
    );
  }
  return { admin, technicians, endUsers };
}

async function seedCatalogsAndKb(authorId) {
  await prisma.ticketTemplate.createMany({ data: TICKET_TEMPLATES });

  for (const sop of SOP_TEMPLATES) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.sopTemplate.create({
      data: {
        category: sop.category,
        name: sop.name,
        items: { create: sop.items.map((label, i) => ({ label, order: i + 1 })) },
      },
    });
  }

  await prisma.serviceCatalogItem.createMany({ data: SERVICE_CATALOG });

  for (const [i, art] of KB_ARTICLES.entries()) {
    const slug = art.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    // eslint-disable-next-line no-await-in-loop
    await prisma.knowledgeArticle.create({
      data: {
        title: art.title,
        slug: `${slug}-${i}`,
        body: art.body,
        category: art.category,
        keywords: art.keywords,
        published: true,
        viewCount: Math.floor(Math.random() * 80),
        authorId,
      },
    });
  }
}

async function seedAssets(endUsers) {
  const mk = (data) => prisma.asset.create({ data });
  const pick = (i) => endUsers[i % endUsers.length];
  const daysAgo = (d) => new Date(now - d * 24 * HOUR);

  const laptops = [];
  for (let i = 1; i <= 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    laptops.push(
      await mk({
        assetTag: `LT-${String(1000 + i)}`,
        name: `${pick(i).name} — ThinkPad`,
        type: 'LAPTOP',
        status: i === 4 ? 'IN_REPAIR' : 'IN_USE',
        manufacturer: 'Lenovo',
        model: i % 2 ? 'ThinkPad T14 Gen 4' : 'ThinkPad X1 Carbon Gen 11',
        serialNumber: `PF${100000 + i}`,
        assignedToId: pick(i).id,
        location: `${(i % 5) + 1}F`,
        purchaseDate: daysAgo(300 + i * 10),
        warrantyExpiry: daysAgo(-400 + i * 10),
        osVersion: 'Windows 11 23H2',
        mdmEnrolled: true,
      }),
    );
  }

  const desktops = [];
  for (let i = 1; i <= 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    desktops.push(
      await mk({
        assetTag: `DT-${String(2000 + i)}`,
        name: `Accounts workstation ${i}`,
        type: 'DESKTOP',
        manufacturer: 'Dell',
        model: 'OptiPlex 7010',
        serialNumber: `DKT${200000 + i}`,
        assignedToId: pick(i + 3).id,
        location: '2F Finance',
        osVersion: 'Windows 11 23H2',
      }),
    );
  }

  const printServer = await mk({
    assetTag: 'SRV-PRINT-01',
    name: 'Print server',
    type: 'SERVER',
    manufacturer: 'Dell',
    model: 'PowerEdge R650',
    serialNumber: 'PSRV0001',
    location: 'DC Rack 4',
    osVersion: 'Windows Server 2022',
  });

  const printers = [];
  const floors = ['1F Reception', '2F HR', '3F', '4F Engineering'];
  for (let i = 1; i <= 8; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    printers.push(
      await mk({
        assetTag: `PR-${String(3000 + i)}`,
        name: `MFP ${floors[i % floors.length]} #${i}`,
        type: 'PRINTER',
        status: 'IN_USE',
        manufacturer: 'HP',
        model: 'LaserJet Enterprise MFP E77822',
        serialNumber: `HPPR${300000 + i}`,
        location: floors[i % floors.length],
        parentAssetId: printServer.id,
        driverVersion: '61.290.1.25914',
        firmwareVersion: i <= 3 ? '5.6.5.1' : '5.7.0.3',
        lastFirmwareUpdate: i <= 3 ? daysAgo(240) : daysAgo(30),
      }),
    );
  }

  const vcRooms = [];
  for (const room of ['Boardroom', 'Room 2B', 'Room 3A', 'Zoom Room 1']) {
    // eslint-disable-next-line no-await-in-loop
    vcRooms.push(
      await mk({
        assetTag: `VC-${room.replace(/\s+/g, '').toUpperCase()}`,
        name: `${room} VC kit`,
        type: 'VIDEO_CONFERENCING',
        manufacturer: 'Logitech',
        model: 'Rally Bar + Tap',
        location: room,
        osVersion: 'CollabOS 1.13',
      }),
    );
  }

  const mobiles = [];
  for (let i = 1; i <= 8; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    mobiles.push(
      await mk({
        assetTag: `MOB-${String(4000 + i)}`,
        name: `${pick(i).name} — ${i % 2 ? 'iPhone' : 'Pixel'}`,
        type: i % 2 ? 'MOBILE_IOS' : 'MOBILE_ANDROID',
        manufacturer: i % 2 ? 'Apple' : 'Google',
        model: i % 2 ? 'iPhone 15' : 'Pixel 8',
        serialNumber: `MOB${400000 + i}`,
        assignedToId: pick(i).id,
        osVersion: i % 2 ? 'iOS 17.5' : 'Android 14',
        mdmEnrolled: true,
      }),
    );
  }

  const mdm = await mk({
    assetTag: 'MDM-TENANT-01',
    name: 'MDM tenant (mobile device management)',
    type: 'MDM_DEVICE',
    manufacturer: 'Microsoft',
    model: 'Intune',
    location: 'Cloud',
  });
  await prisma.assetLink.createMany({
    data: mobiles.map((m) => ({ fromId: mdm.id, toId: m.id, type: 'DEPENDS_ON' })),
  });

  const coreSwitch = await mk({
    assetTag: 'NET-SW-4F',
    name: '4F access switch stack',
    type: 'NETWORK',
    manufacturer: 'Cisco',
    model: 'Catalyst 9300 stack',
    location: '4F IDF',
  });
  await prisma.assetLink.createMany({
    data: [
      ...laptops.slice(0, 4).map((l) => ({ fromId: l.id, toId: coreSwitch.id, type: 'CONNECTED_TO' })),
      { fromId: printServer.id, toId: coreSwitch.id, type: 'CONNECTED_TO' },
    ],
  });

  // A couple of dock CI links
  const dock = await mk({
    assetTag: 'DK-5001',
    name: `${pick(1).name} — dock`,
    type: 'PERIPHERAL',
    manufacturer: 'Lenovo',
    model: 'ThinkPad USB-C Dock Gen 2',
    assignedToId: pick(1).id,
    location: '2F',
  });
  await prisma.assetLink.create({ data: { fromId: dock.id, toId: laptops[0].id, type: 'DOCKED_TO' } });

  return { laptops, desktops, printers, vcRooms, mobiles, all: [...laptops, ...desktops, ...printers, ...vcRooms, ...mobiles] };
}

async function seedTickets({ technicians, endUsers }) {
  const sopByCategory = new Map(
    (await prisma.sopTemplate.findMany({ include: { items: true } })).map((s) => [s.category, s.items]),
  );
  let seq = 0;
  const audit = [];
  const created = [];

  for (const s of TICKET_SCENARIOS) {
    seq += 1;
    const number = `INC-${String(seq).padStart(6, '0')}`;
    const requester = endUsers[seq % endUsers.length];
    const createdAt = new Date(now - s.ageHours * HOUR);
    const evalResult = evaluateTicketPriority(s.impact, s.urgency);
    const due = slaDue(evalResult.priority, createdAt);
    const assignee = s.assign != null ? technicians[s.assign] : null;

    const resolvedAt =
      s.resolveAfterHours != null ? new Date(createdAt.getTime() + s.resolveAfterHours * HOUR) : null;
    const firstRespondedAt =
      s.status !== 'OPEN'
        ? new Date(createdAt.getTime() + Math.min(0.2, (s.resolveAfterHours ?? 2) / 4) * HOUR)
        : null;

    // Match what the SLA cron sweep would immediately compute for these dates.
    let slaStatus = 'ON_TRACK';
    if (resolvedAt) slaStatus = resolvedAt <= due.slaResolveDueAt ? 'MET' : 'RESOLVE_BREACHED';
    else if (new Date() > due.slaResolveDueAt) slaStatus = 'RESOLVE_BREACHED';
    else if (!firstRespondedAt && new Date() > due.slaResponseDueAt) slaStatus = 'RESPONSE_BREACHED';
    else if (firstRespondedAt && firstRespondedAt > due.slaResponseDueAt) slaStatus = 'RESPONSE_BREACHED';

    const sopItems = sopByCategory.get(s.category) ?? [];

    // eslint-disable-next-line no-await-in-loop
    const ticket = await prisma.ticket.create({
      data: {
        number,
        title: s.title,
        description: s.description,
        category: s.category,
        source: 'USER_SUBMITTED',
        status: s.status,
        impact: s.impact,
        urgency: s.urgency,
        priority: evalResult.priority,
        requesterId: requester.id,
        assigneeId: assignee?.id ?? null,
        slaResponseDueAt: due.slaResponseDueAt,
        slaResolveDueAt: due.slaResolveDueAt,
        slaStatus,
        firstRespondedAt,
        resolvedAt,
        closedAt: s.status === 'CLOSED' ? new Date((resolvedAt ?? createdAt).getTime() + 24 * HOUR) : null,
        createdAt,
        updatedAt: resolvedAt ?? createdAt,
        checklistItems: sopItems.length
          ? {
              create: sopItems.map((it, idx) => ({
                label: it.label,
                order: it.order,
                isDone: s.status === 'RESOLVED' || s.status === 'CLOSED' ? idx < sopItems.length - 1 || Math.random() > 0.3 : idx === 0 && Math.random() > 0.5,
                completedById:
                  (s.status === 'RESOLVED' || s.status === 'CLOSED') && assignee ? assignee.id : null,
                completedAt:
                  (s.status === 'RESOLVED' || s.status === 'CLOSED') && assignee ? resolvedAt : null,
              })),
            }
          : undefined,
        comments: s.comments?.length
          ? {
              create: s.comments.map((c, i) => ({
                body: c.body,
                isInternal: Boolean(c.staff && c.internal),
                authorId: c.staff ? (assignee?.id ?? technicians[0].id) : requester.id,
                createdAt: new Date(createdAt.getTime() + (i + 1) * 0.5 * HOUR),
              })),
            }
          : undefined,
        technicianActions: s.actions?.length
          ? {
              create: s.actions.map((a, i) => ({
                actionType: a.type,
                notes: a.notes,
                technicianId: assignee?.id ?? technicians[0].id,
                createdAt: new Date(createdAt.getTime() + (i + 1) * 0.4 * HOUR),
              })),
            }
          : undefined,
      },
    });
    created.push(ticket);

    audit.push(
      { entityType: 'Ticket', entityId: ticket.id, action: 'CREATE', actorId: requester.id, createdAt },
      {
        entityType: 'Ticket',
        entityId: ticket.id,
        action: 'PRIORITY_COMPUTED',
        field: 'priority',
        newValue: `${evalResult.priority} (impact=${s.impact}, urgency=${s.urgency})`,
        actorLabel: 'system:priority-engine',
        createdAt,
      },
    );
    if (assignee) {
      audit.push({
        entityType: 'Ticket',
        entityId: ticket.id,
        action: 'ASSIGNMENT_CHANGE',
        field: 'assigneeId',
        newValue: assignee.name,
        actorId: technicians[0].id,
        createdAt: new Date(createdAt.getTime() + 0.2 * HOUR),
      });
    }
    if (s.status !== 'OPEN') {
      audit.push({
        entityType: 'Ticket',
        entityId: ticket.id,
        action: 'STATUS_CHANGE',
        field: 'status',
        oldValue: 'OPEN',
        newValue: s.status,
        actorId: assignee?.id ?? technicians[0].id,
        createdAt: resolvedAt ?? new Date(createdAt.getTime() + HOUR),
      });
    }

    if (s.csat != null && (s.status === 'RESOLVED' || s.status === 'CLOSED')) {
      // eslint-disable-next-line no-await-in-loop
      await prisma.csatRating.create({
        data: {
          ticketId: ticket.id,
          score: s.csat,
          submittedById: requester.id,
          comment: s.csat >= 4 ? 'Quick and helpful, thanks.' : s.csat === 3 ? 'Resolved but took a while.' : 'Took too long to get sorted.',
          createdAt: new Date((resolvedAt ?? createdAt).getTime() + 2 * HOUR),
        },
      });
    }

    if (slaStatus === 'RESOLVE_BREACHED' || slaStatus === 'RESPONSE_BREACHED') {
      const isResolve = slaStatus === 'RESOLVE_BREACHED';
      const at = isResolve ? due.slaResolveDueAt : due.slaResponseDueAt;
      // eslint-disable-next-line no-await-in-loop
      await prisma.slaEvent.create({
        data: {
          ticketId: ticket.id,
          type: isResolve ? 'RESOLVE_BREACH' : 'RESPONSE_BREACH',
          note: `${isResolve ? 'Resolve' : 'Response'} SLA breached (seed)`,
          createdAt: at,
        },
      });
      audit.push({
        entityType: 'Ticket',
        entityId: ticket.id,
        action: 'SLA_BREACH',
        field: 'slaStatus',
        newValue: slaStatus,
        actorLabel: 'system:sla-monitor',
        createdAt: at,
      });
    }
  }

  // One system-generated ticket from the external integration path.
  seq += 1;
  const sysCreatedAt = new Date(now - 9 * HOUR);
  const sysEval = evaluateTicketPriority('DEPARTMENT', 'WORK_DEGRADED');
  const sysDue = slaDue(sysEval.priority, sysCreatedAt);
  const sysTicket = await prisma.ticket.create({
    data: {
      number: `INC-${String(seq).padStart(6, '0')}`,
      title: 'Forklift FL-22 exceeded maintenance-hour threshold',
      description:
        'Automated alert from the Fleet Asset Tracker: unit FL-22 has run 512 hours since last service ' +
        '(threshold 500). Utilisation 94% over the last 30 days. Schedule preventive maintenance.',
      category: 'System / Monitoring',
      source: 'SYSTEM_GENERATED',
      status: 'OPEN',
      impact: 'DEPARTMENT',
      urgency: 'WORK_DEGRADED',
      priority: sysEval.priority,
      externalSource: 'fleet-asset-tracker',
      externalRef: 'FLEET-FL22-2026-08',
      slaResponseDueAt: sysDue.slaResponseDueAt,
      slaResolveDueAt: sysDue.slaResolveDueAt,
      slaStatus: 'ON_TRACK',
      createdAt: sysCreatedAt,
    },
  });
  audit.push({
    entityType: 'Ticket',
    entityId: sysTicket.id,
    action: 'CREATE',
    actorLabel: 'system:fleet-asset-tracker',
    createdAt: sysCreatedAt,
  });
  created.push(sysTicket);

  await prisma.auditLog.createMany({ data: audit });
  return created;
}

async function seedChanges(technicians) {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  let seq = 0;
  for (const c of CHANGE_REQUESTS) {
    seq += 1;
    // eslint-disable-next-line no-await-in-loop
    await prisma.changeRequest.create({
      data: {
        number: `CHG-${String(seq).padStart(6, '0')}`,
        title: c.title,
        description: c.description,
        riskLevel: c.riskLevel,
        rollbackPlan: c.rollbackPlan,
        status: c.status,
        requestedById: technicians[seq % technicians.length].id,
        approvedById: ['APPROVED', 'SCHEDULED'].includes(c.status) ? admin.id : null,
        approvedAt: ['APPROVED', 'SCHEDULED'].includes(c.status) ? new Date(now - 48 * HOUR) : null,
        changeWindowStart: new Date(now + 24 * HOUR),
        changeWindowEnd: new Date(now + 30 * HOUR),
      },
    });
  }
}

async function seedServiceRequests(endUsers, technicians) {
  const items = await prisma.serviceCatalogItem.findMany();
  const byName = (n) => items.find((i) => i.name === n);
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const rows = [
    { item: 'New Laptop', status: 'PENDING_APPROVAL', u: 0 },
    { item: 'Software Install', status: 'FULFILLED', u: 1 },
    { item: 'VPN Access', status: 'APPROVED', u: 2 },
    { item: 'Monitor / Docking Station', status: 'IN_FULFILLMENT', u: 3 },
    { item: 'Mobile Device (MDM enrolled)', status: 'SUBMITTED', u: 4 },
    { item: 'Shared Mailbox', status: 'REJECTED', u: 5 },
  ];
  let seq = 0;
  for (const r of rows) {
    seq += 1;
    const it = byName(r.item);
    // eslint-disable-next-line no-await-in-loop
    await prisma.serviceRequest.create({
      data: {
        number: `REQ-${String(seq).padStart(6, '0')}`,
        catalogItemId: it.id,
        requestedById: endUsers[r.u].id,
        status: r.status,
        approverId: ['APPROVED', 'IN_FULFILLMENT', 'FULFILLED', 'REJECTED'].includes(r.status) ? admin.id : null,
        approvedAt: ['APPROVED', 'IN_FULFILLMENT', 'FULFILLED'].includes(r.status) ? new Date(now - 30 * HOUR) : null,
        fulfilledById: r.status === 'FULFILLED' ? technicians[1].id : null,
        fulfilledAt: r.status === 'FULFILLED' ? new Date(now - 6 * HOUR) : null,
        createdAt: new Date(now - 72 * HOUR),
      },
    });
  }
}

/** Lightweight port of the recurring-incident detector for seed time. */
async function detectProblems() {
  const STOP = new Set(['the', 'and', 'for', 'from', 'with', 'this', 'that', 'after', 'user', 'cannot', 'will', 'have']);
  const kw = (t) =>
    [...new Set(t.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w)))];
  const windowMs = 120 * 60_000;
  const threshold = 3;

  const tickets = await prisma.ticket.findMany({ where: { status: { not: 'CLOSED' }, problemId: null } });
  const byCategory = {};
  for (const t of tickets) (byCategory[t.category] ??= []).push(t);

  let seq = 0;
  for (const [category, group] of Object.entries(byCategory)) {
    group.sort((a, b) => a.createdAt - b.createdAt);
    for (const anchor of group) {
      const anchorKw = kw(`${anchor.title} ${anchor.description}`);
      const cluster = group.filter((t) => {
        if (Math.abs(t.createdAt - anchor.createdAt) > windowMs) return false;
        const shared = kw(`${t.title} ${t.description}`).filter((w) => anchorKw.includes(w));
        return shared.length >= 2;
      });
      if (cluster.length >= threshold && !cluster.some((t) => t.problemId)) {
        seq += 1;
        // eslint-disable-next-line no-await-in-loop
        const problem = await prisma.problem.create({
          data: {
            number: `PRB-${String(seq).padStart(6, '0')}`,
            title: `Potential linked outage — ${category}`,
            description: `Auto-detected: ${cluster.length} tickets in "${category}" within 120 minutes sharing keywords.`,
            status: 'INVESTIGATING',
            category,
            keywords: anchorKw.slice(0, 8),
            autoDetected: true,
          },
        });
        // eslint-disable-next-line no-await-in-loop
        await prisma.ticket.updateMany({
          where: { id: { in: cluster.map((t) => t.id) } },
          data: { problemId: problem.id },
        });
        // eslint-disable-next-line no-await-in-loop
        await prisma.auditLog.createMany({
          data: cluster.map((t) => ({
            entityType: 'Ticket',
            entityId: t.id,
            action: 'PROBLEM_LINKED',
            field: 'problemId',
            newValue: problem.number,
            actorLabel: 'system:problem-detection',
          })),
        });
        break;
      }
    }
  }
  return seq;
}

async function main() {
  console.log('⏳ Wiping existing data…');
  await wipe();

  console.log('▶ SLA policies');
  await seedSla();

  console.log('▶ Users (1 admin, 5 technicians, 15 end-users)');
  const users = await seedUsers();

  console.log('▶ Templates, SOPs, service catalog, knowledge base');
  await seedCatalogsAndKb(users.technicians[0].id);

  console.log('▶ Assets + CI relationships');
  await seedAssets(users.endUsers);

  console.log(`▶ Tickets (${TICKET_SCENARIOS.length} user-submitted + 1 system-generated)`);
  await seedTickets(users);

  console.log('▶ Change requests');
  await seedChanges(users.technicians);

  console.log('▶ Service requests');
  await seedServiceRequests(users.endUsers, users.technicians);

  console.log('▶ Running recurring-incident (Problem) detection');
  const problemCount = await detectProblems();

  const [tickets, problems, changes, assets, kb] = await Promise.all([
    prisma.ticket.count(),
    prisma.problem.count(),
    prisma.changeRequest.count(),
    prisma.asset.count(),
    prisma.knowledgeArticle.count(),
  ]);

  console.log('\n✅ Seed complete');
  console.table({
    users: 1 + users.technicians.length + users.endUsers.length,
    tickets,
    problems,
    changeRequests: changes,
    assets,
    knowledgeArticles: kb,
    problemClustersDetected: problemCount,
  });
  console.log(`\n  Admin login:      ${adminEmail} / ${adminPassword}`);
  console.log(`  Technician login: ${users.technicians[0].email} / ${defaultPassword}`);
  console.log(`  End-user login:   ${users.endUsers[0].email} / ${defaultPassword}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
