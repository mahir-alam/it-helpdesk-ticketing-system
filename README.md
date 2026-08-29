# IT Help Desk Ticket Tracker

A hand-coded, single-purpose implementation of **ServiceNow-style core IT Service Management**:
Incident Management with an ITIL priority engine, plus Change, Problem, Service Catalog,
Asset (CMDB) and Knowledge Management — with backend-enforced RBAC, SLA timers, and a
real-time alerting pipeline.

> **Honest framing:** this is a simplified re-implementation of the *concepts* real ITSM
> platforms are built on. The Impact × Urgency priority matrix is literally how ServiceNow
> calculates priority out of the box. It is **not** an enterprise platform — there is no
> Flow Designer, no multi-tenant architecture, no module marketplace. It is the core
> incident-management logic, coded from scratch, with the surrounding ITIL modules that make
> it recognisable as genuine ITSM rather than a generic CRUD app.

---

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React (Vite), react-router-dom, Recharts |
| Backend | Node.js, Express |
| Database | PostgreSQL (hosted on Supabase) |
| ORM | Prisma |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs`, backend-enforced role checks |
| Background jobs | `node-cron` — SLA escalation + recurring-incident sweeps |
| Alerting | async POST to a Discord webhook (PagerDuty-style ops alert) |
| Tests | Jest — priority matrix, RBAC, SLA math, keyword detection |
| Infra | Docker + docker-compose, GitHub Actions CI |

Monorepo with npm workspaces: [`server/`](./server) and [`client/`](./client).

---

## The priority engine (core feature)

A requester supplies **Impact** and **Urgency** only. They can never pick a priority.
The backend derives **P1–P4** from the ITIL matrix and stores it on the ticket:

| Impact ↓ / Urgency → | Workaround available | Work degraded | System down |
| --- | --- | --- | --- |
| **Entire company** | P3 | P2 | **P1** |
| **Department** | P3 | P3 | P2 |
| **Single user** | P4 | P4 | P3 |

`ENTIRE_COMPANY + SYSTEM_DOWN` is forced to **P1‑Critical** and triggers:

1. **SLA timers** — response + resolve due-dates computed from the priority's `SlaPolicy`.
2. **On-call routing** — the ticket is auto-assigned to the technician flagged `isOnCall`.
3. **Real-time alert** — an async POST to the Discord webhook (logged to `WebhookDelivery`
   for verifiability, and never allowed to fail the ticket creation).

The matrix is a pure function ([`server/src/modules/priority/priorityMatrix.js`](./server/src/modules/priority/priorityMatrix.js))
with no database dependency, exhaustively unit-tested.

---

## Features

### Incident Management
- Submit / search / filter tickets; status workflow `OPEN → IN_PROGRESS → RESOLVED → CLOSED`
  with validated transitions and reopen paths
- Ticket templates (password reset, printer offline, VPN failure…) that pre-fill
  category / impact / urgency and seed a checklist
- Full timeline: comments (public vs internal notes), technician actions, SLA events, audit
- SLA sweep (`node-cron`, every minute) flips `RESPONSE_BREACHED` / `RESOLVE_BREACHED`,
  writes an `SlaEvent` + audit entry, and re-alerts on resolve breach

### Priority & SLA
- ITIL Impact × Urgency → P1–P4 (see above), recomputed — never set directly — on reprioritise
- Per-priority `SlaPolicy` (P1 15m/4h · P2 30m/8h · P3 4h/24h · P4 8h/72h), wall-clock so
  breaches and escalations are visible in a short demo

### Access control & interfaces
- Three roles, **enforced on the backend** (`requireRole` middleware), not just hidden UI:
  **End-User** (own tickets), **Technician** (queue, assign, resolve), **Admin** (users, audit, reports)
- Two distinct interfaces on separate route trees: a simple **self-service portal**
  (`/portal`) and a **technician workspace** (`/workspace`)

### Change Management
- Separate record type — risk level, scheduled change window, rollback plan, and an
  approval lifecycle (`DRAFT → PENDING_APPROVAL → APPROVED/REJECTED → SCHEDULED → IN_PROGRESS → COMPLETED/ROLLED_BACK`);
  approve/reject is admin-only

### Service Catalog
- Requestable items ("New Laptop", "VPN Access", "Software Install") with their own
  approval + fulfilment workflow, distinct from break-fix tickets

### Problem Management
- **Recurring-incident detection**: when `PROBLEM_DETECTION_THRESHOLD` (default 3) or more
  tickets in the same category share ≥ 2 content keywords within a time window, a `Problem`
  record is auto-created ("potential linked outage") and the incidents are linked to it.
  Runs best-effort on ticket creation and on a 5-minute cron sweep.

### Technician tooling
- SOP checklists seeded per category (e.g. AD lockout → verify identity → check logs → unlock)
- Technician action panel — logs "Password Reset", "Remote Session Started/Ended",
  "Network Diagnostic"… with actor + timestamp (records the action, performs nothing system-level)

### Asset & Knowledge Management
- CMDB: assets typed (desktop, laptop, printer, video-conferencing, iOS/Android mobile,
  MDM device, network, server, peripheral), with parent/child hierarchy and typed CI links
  (`CONNECTED_TO`, `DEPENDS_ON`, `RELATED_EQUIPMENT`, `DOCKED_TO`)
- Printer fleet: driver + firmware version tracking with a "firmware 180d+ stale" filter
- Knowledge base with slugs, full-text-ish search, publish state, optional link to a Problem

### Engineering quality
- Audit log on every status / priority / assignment change (who, what, when) — machine
  actors recorded as `system:<name>`
- CSAT 1–5 prompt when a ticket resolves/closes
- Analytics (Recharts): MTTR overall + by priority, ticket volume by category,
  open-by-priority, created-vs-resolved trend, per-technician workload, SLA compliance %
- Jest suite (39 tests) — runs with **no database**, so CI needs no services

---

## External integration endpoint

Built for a separate project (a Fleet Asset Tracker) to open tickets via a real HTTP call,
independent of the interactive user flow:

```
POST /api/tickets/auto-create
X-Api-Key: <INTEGRATION_API_KEY>
Content-Type: application/json

{
  "title": "Forklift FL-22 exceeded maintenance-hour threshold",
  "description": "512 hours since last service (threshold 500)",
  "category": "System / Monitoring",
  "impact": "DEPARTMENT",
  "urgency": "WORK_DEGRADED",
  "externalSource": "fleet-asset-tracker",
  "externalRef": "FLEET-FL22-2026-08",
  "assetTag": "FL-22"
}
```

Creates a ticket with `source = SYSTEM_GENERATED` and no logged-in requester; priority,
SLA and problem-detection all run exactly as for a user-submitted ticket.

---

## Local setup

```bash
git clone <repo>
cd it-helpdesk-ticketing-system
npm install

cp server/.env.example server/.env      # then fill in the values below

npm run prisma:migrate                   # apply migrations to your database
npm run prisma:seed                      # 65 realistic tickets, assets, KB, problems

npm run dev                              # server :4000  +  client :5173
```

### Environment (`server/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled Postgres URL (Supabase pgbouncer, port 6543) — used at runtime |
| `DIRECT_URL` | Direct Postgres URL (port 5432) — used by Prisma for migrations |
| `JWT_SECRET` | Signing secret for auth tokens |
| `DISCORD_WEBHOOK_URL` | P1 / SLA-breach alert target (blank = alert path logs only) |
| `INTEGRATION_API_KEY` | Shared secret required by `POST /api/tickets/auto-create` |
| `ENABLE_CRON` | `true` to run the SLA + problem-detection schedulers |
| `PROBLEM_DETECTION_THRESHOLD` / `_WINDOW_MINUTES` | Recurring-incident sensitivity |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` / `SEED_DEFAULT_PASSWORD` | Seed credentials |

`server/.env` is gitignored.

### Seeded demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@helpdesk.local` | `Admin!2345` |
| Technician (on-call) | `priya.nair@helpdesk.local` | `Passw0rd!` |
| End-user | `robert.tran@corp.local` | `Passw0rd!` |

---

## Tests

```bash
npm test --workspace server
```

Covers the priority matrix (all 9 cells + invalid inputs + escalation flags), RBAC
(`requireRole` / `requireMinRole` — 401 vs 403, role ladder), SLA due-date math, and the
keyword extraction behind problem detection.

---

## Docker

```bash
docker compose up --build     # db :5432 · api :4000 · client :8080
```

`server/Dockerfile` runs `prisma migrate deploy` on start. In production the client is a
static Vercel deploy (`client/vercel.json` rewrites `/api/*` to the API) and the API runs
on Render from `render.yaml`, against the Supabase database.

---

## Project layout

```
server/
  prisma/schema.prisma        # 20 models, 12 enums
  prisma/seed*.js             # realistic corporate-IT dataset
  src/
    modules/priority/         # pure ITIL matrix (unit-tested)
    modules/sla/              # policies + due-date computation
    modules/tickets/          # create, workflow, auto-create endpoint
    modules/problems/         # recurring-incident detection
    modules/{changes,catalog,service-requests,assets,knowledge-base,audit,analytics}/
    middleware/{auth,rbac,validate,error}.js
    jobs/                     # node-cron scheduler + SLA/problem sweeps
    services/{auditLog,webhook}.js
  tests/                      # jest — no DB required
client/
  src/pages/portal/           # self-service portal
  src/pages/workspace/        # technician + admin workspace
  src/components/, src/auth/, src/layouts/
```
