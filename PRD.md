# Hammerline: Product Requirements Document

> **Maintenance & downtime tracking for the plant floor.**
> Version 1.0 · 2026-11-28 · Owner: Eric Mignardi

---

## 1. Summary

Hammerline is a web app that helps a manufacturing plant **report machine breakdowns, coordinate repairs, and measure downtime**. Operators report a problem from a tablet next to their machine. Supervisors triage the report and assign a technician. Technicians log their work and resolve the job. Everyone sees machine status change live. The dashboard turns that history into the maintenance metrics plant managers care about: downtime, MTTR, MTBF and availability.

Hammerline is a portfolio project aimed at Hamilton, Ontario's manufacturing sector, the city's largest industry. It is deployed publicly with one-click demo logins and seeded with a fictional plant, **Bayfront Metal Works**.

## 2. Problem

In many small and mid-sized plants, breakdowns are still reported by shouting across the floor, by radio, or on paper. As a result:

- **Response is slow and unclear.** No one knows whether a breakdown has been reported, who is handling it, or how long it has been down.
- **Knowledge gets lost.** What was fixed, which parts were used and how long it took are never captured.
- **Downtime goes unmeasured.** Without timestamps, the plant can't calculate MTTR or MTBF, so it can't tell which machines are chronic problems or justify spending on them.

Large plants use enterprise maintenance systems (CMMS) such as SAP PM, Maximo, Fiix or MaintainX. Those are expensive and heavy. Hammerline focuses on the one workflow that matters most, **the breakdown loop**, and does it well.

## 3. Users and roles

| Role | Who they are | Primary device | Main jobs |
|---|---|---|---|
| **Operator** | Runs a machine on a production line | Shared tablet at the line | Report a problem in under 30 seconds; see whether their machine is being handled |
| **Technician** | Maintenance tradesperson (millwright, electrician) | Tablet or phone, sometimes desktop | See assigned work; start, log and resolve jobs |
| **Supervisor** | Maintenance or plant lead | Desktop | Triage and assign; verify and close; manage machines and users; watch metrics |

Supervisors also do admin work. There is no separate Admin role.

**Secondary audience:** recruiters and hiring managers visiting the live demo. They must be able to try every role within 10 seconds, with no sign-up.

## 4. Goals and non-goals

### Goals
1. Complete the breakdown loop end to end with role-appropriate screens.
2. Reflect status changes live on every connected screen in about one second.
3. Produce honest, explainable maintenance metrics derived from event data.
4. Be a professional-grade codebase: typed end to end, tested, CI/CD, containerized, documented, deployed.
5. Make the demo frictionless: one-click role logins, realistic seed data, a graceful cold start.

### Non-goals (MVP)
- Multiple plants, multiple companies (multi-tenancy) or billing
- Native mobile apps (responsive web covers tablets and phones)
- Integration with real machine controllers (PLCs or other industrial hardware)
- Preventive maintenance, parts inventory, notifications, attachments, OEE (all v2)

## 5. Core workflow: the breakdown loop

```
Operator reports issue ──► Work order OPEN ──► Supervisor assigns ──► ASSIGNED
  ("machine stopped?")         │                                       │
  machine → DOWN / DEGRADED    │                          Technician starts ▼
  (live on all screens)        │                                  IN_PROGRESS
                               │                                       │
                               │                Technician resolves ▼  (logs work)
                               │                                    RESOLVED
                               │           machine → RUNNING, downtime event closed
                               │                                       │
                               │       Supervisor verifies ──► CLOSED   │
                               │       Supervisor rejects  ──► IN_PROGRESS
                               └── Supervisor cancels (duplicate) ──► CANCELLED
```

### Work order state machine (enforced on the server)

| From | Action | To | Allowed by | Side effects |
|---|---|---|---|---|
| — | `report` | OPEN | Operator, Supervisor | Machine status recomputed; DowntimeEvent opened if `machineStopped` and none is open |
| OPEN | `assign` | ASSIGNED | Supervisor | Sets `assignedToId`, `assignedAt` |
| ASSIGNED / IN_PROGRESS | `reassign` | (same) | Supervisor | Changes `assignedToId` |
| ASSIGNED | `start` | IN_PROGRESS | Assigned technician | Sets `startedAt` |
| IN_PROGRESS | `resolve` | RESOLVED | Assigned technician | Requires a resolution note; sets `resolvedAt`; machine status recomputed; DowntimeEvent closed if no other active stopping work order |
| RESOLVED | `close` | CLOSED | Supervisor | Sets `closedAt` |
| RESOLVED | `reject` | IN_PROGRESS | Supervisor | Requires a note; machine status recomputed; a new DowntimeEvent opens if `machineStopped` |
| OPEN / ASSIGNED | `cancel` | CANCELLED | Supervisor | Requires a note; machine status recomputed |

Every action writes a **WorkOrderEvent** (actor, action, from status, to status, note, timestamp).

### Machine status rule
A machine's status is **recomputed from its active work orders** (OPEN, ASSIGNED or IN_PROGRESS):
- **DOWN** if any active work order has `machineStopped = true`
- **DEGRADED** if it has active work orders but none of them stop the machine
- **RUNNING** otherwise

A machine has at most **one open DowntimeEvent** at a time. It opens when the machine becomes DOWN and closes when it stops being DOWN.

## 6. User stories and acceptance criteria

IDs are referenced by PLAN.md.

### Authentication & accounts

**AUTH-1. Sign in.** As any user, I can sign in with email and password.
- Valid credentials set httpOnly `Secure` `SameSite=Lax` cookies (access token, 15 minutes; refresh token, 7 days) and redirect to my role's home screen.
- Invalid credentials show a generic "Email or password is incorrect" message and never reveal which field was wrong.
- After 5 failed attempts in 15 minutes from the same IP, further attempts get HTTP 429 with a friendly message.
- Deactivated users cannot sign in.

**AUTH-2. Demo login.** As a visitor, I can click "Try as Operator / Technician / Supervisor" on the sign-in page and be signed in as that demo user.
- Only available when `DEMO_MODE=true`.
- Demo users cannot change their password, cannot be deactivated, and cannot have their role changed.

**AUTH-3. Stay signed in.** As a user, my session refreshes silently while I use the app.
- An expired access token is refreshed automatically once, and the original request is retried.
- Refresh tokens rotate on every use. Reusing an already-used refresh token revokes that whole chain of tokens and forces a new sign-in.

**AUTH-4. Sign out.** As a user, I can sign out. My refresh token is revoked and the cookies are cleared.

**AUTH-5. Role-based access.** As the system, I enforce role permissions on every API route and every socket event.
- Calling a route without the required role returns 403 with the standard error shape.
- Navigating to a page my role can't access shows a 403 page. Navigation only shows links my role can use.

**USER-1. Manage users.** As a supervisor, I can list, create, edit (name, role) and deactivate or reactivate users.
- Email must be unique. New users get a temporary password set by the supervisor.
- A supervisor cannot deactivate themselves.
- The list supports search by name or email and filtering by role and active status.

### Plant & machines

**MACH-1. View machines.** As any user, I can view a list of machines grouped or filtered by line, with status, asset tag and type.
- Search by name or asset tag. Filter by line and status. Sort by name or status. Paginated.
- Archived machines are hidden unless a supervisor toggles "Show archived".

**MACH-2. Machine detail.** As any user, I can open a machine and see its current status, its active work orders, its recent work order history, and its downtime in the last 30 days.

**MACH-3. Manage lines and machines.** As a supervisor, I can create and edit lines and machines, and archive or restore machines.
- Asset tags are unique.
- A machine with active work orders cannot be archived (the API returns 409 with an explanation).

**BOARD-1. Live status board.** As any user, I see a grid of all active machines, grouped by line, showing RUNNING / DEGRADED / DOWN with colour, icon and text label.
- DOWN tiles show how long the machine has been down (a live timer) and the linked work order number.
- Selecting a tile opens the machine detail.
- Summary counts per status appear at the top.
- A "wall display" mode (`?display=wall`) hides navigation and uses larger type for a line-side TV.

### Work orders

**WO-1. Report an issue.** As an operator, I can report an issue in three steps or fewer from a tablet.
- Fields: machine (searchable, can be pre-filled from the board or machine page), "Is the machine stopped?" (yes/no, required), category (Mechanical / Electrical / Hydraulic / Pneumatic / Safety / Other), suggested priority (Low / Medium / High / Critical), title, and an optional description.
- If the machine already has an active work order, I see a warning that links to it before I submit. I can still submit.
- On success I see confirmation with the work order number (e.g. `WO-1042`), and the machine status updates everywhere.
- Validation errors appear inline next to the field, from the same Zod schema the API uses.

**WO-2. My reports.** As an operator, I can see the work orders I reported and their current status.

**WO-3. Triage and assign.** As a supervisor, I can see OPEN work orders sorted by priority and age, change priority, and assign, reassign or cancel.
- Assigning requires choosing an active technician. The picker shows each technician's current number of active assignments.
- Cancelling requires a note.

**WO-4. My assignments.** As a technician, I see my ASSIGNED and IN_PROGRESS work orders, sorted by priority then age, and can start or resolve them.
- Only the assigned technician sees Start and Resolve buttons, and the API rejects anyone else with 403.
- Resolve requires a resolution note.

**WO-5. Work log.** As the assigned technician, I can add work log entries (note, minutes spent, parts used as free text) while a job is IN_PROGRESS.
- Minutes must be a positive integer up to 1440 (24 hours).
- The work order shows total logged minutes.

**WO-6. Verify, close or reject.** As a supervisor, I can close a RESOLVED work order, or reject it back to IN_PROGRESS with a required note.

**WO-7. Work order detail.** As any user, I can open a work order and see its fields, machine, people involved, work logs, and a chronological **audit timeline** of every action.
- Available actions are shown based on my role and the current status.

**WO-8. Find work orders.** As any user, I can search, filter (status, priority, line, machine, assignee, category, date range) and sort (number, priority, reported date, status) a paginated work order list.
- Filters, sort order and page number live in the URL, so a filtered view is shareable and the back button works.

### Real-time

**RT-1. Live updates.** As any signed-in user, my open screens update within about a second, without refreshing, when machine status or work orders change.
- Covers the status board, work order lists and detail pages, my assignments, and dashboard KPIs.
- A small indicator shows Live / Reconnecting / Offline. After reconnecting, data is refreshed.
- The socket connection is authenticated with a single-use ticket that expires in 30 seconds.
- Supervisors see a toast when a machine goes DOWN (e.g. "STP-PR-03 is DOWN, WO-1043 reported by Jordan Lee"), linking to the work order.

### Dashboard & metrics

**DASH-1. KPI summary.** As a supervisor, I see KPIs for a selected date range (default: last 30 days) and an optional line filter: total downtime (hours), MTTR, MTBF, availability %, number of breakdowns, and open work orders by priority.

**DASH-2. Charts.** As a supervisor, I see:
- downtime trend per day (line chart)
- top 10 machines by downtime (bar chart)
- downtime by line (bar chart)
- breakdowns by category (bar chart)
- Every chart has an accessible table alternative ("View as table") and handles empty ranges gracefully.

**DASH-3. Live KPIs.** Dashboard data refreshes automatically when a work order is resolved or a machine goes down.

### Platform & demo experience

**PLAT-1. Cold start.** As a visitor, if the API is asleep, I see a branded "Waking up the plant server…" screen with progress messaging. The app continues automatically once `/api/v1/health` responds, and shows a retry option if it hasn't responded after 90 seconds.

**PLAT-2. Demo reset.** As the owner, the demo database is reset and reseeded nightly, so the demo always looks good.

**PLAT-3. API documentation.** As a developer or recruiter, I can browse interactive API docs at `/api/docs`.

**PLAT-4. Health.** `GET /api/v1/health` returns `{ status: "ok", db: "ok" }`, or 503 if the database is unreachable.

## 7. Feature list by priority

### MVP
| Area | Features | Stories |
|---|---|---|
| Auth | Sign in/out, demo logins, refresh rotation, role-based access | AUTH-1–5 |
| Users | Supervisor user management | USER-1 |
| Plant | Lines and machines management, machine list and detail | MACH-1–3 |
| Status board | Live grid with timers | BOARD-1 |
| Work orders | Report, triage, assign, start, log, resolve, close, reject, cancel; lists; detail with audit timeline | WO-1–8 |
| Real-time | Socket.IO live updates, connection indicator | RT-1 |
| Dashboard | KPIs, charts, date range and line filters | DASH-1–3 |
| Platform | Cold-start screen, nightly reset, API docs, health check | PLAT-1–4 |

### v2 (designed for, not built)
1. **Sensor simulator:** simulated temperature and vibration feeds with threshold alerts that automatically create work orders (recommended first v2 feature)
2. Preventive maintenance schedules (recurring work orders)
3. Parts inventory (the `partsUsed` text becomes a Part table with stock levels and low-stock alerts)
4. In-app notifications and email
5. Photo attachments on issues
6. OEE (needs production counts and quality data)
7. Shift calendars (accurate scheduled time for MTBF and availability)
8. CSV and PDF export

## 8. Data model

All timestamps are stored in UTC (`timestamptz`) and displayed in `America/Toronto`.

```
User 1───* WorkOrder (reportedBy)        Line 1───* Machine
User 1───* WorkOrder (assignedTo)        Machine 1───* WorkOrder
User 1───* WorkOrderEvent (actor)        Machine 1───* DowntimeEvent
User 1───* WorkLog (technician)          WorkOrder 1───* WorkOrderEvent
User 1───* RefreshToken                  WorkOrder 1───* WorkLog
                                         WorkOrder 0..1───* DowntimeEvent
```

| Entity | Key fields |
|---|---|
| **User** | id, name, email (unique), passwordHash, role (`OPERATOR` \| `TECHNICIAN` \| `SUPERVISOR`), isActive, isDemo, createdAt, updatedAt |
| **RefreshToken** | id, userId, tokenHash (unique), familyId, expiresAt, revokedAt?, replacedById?, createdAt |
| **Line** | id, name (unique), code (unique, e.g. `STP`), description?, createdAt |
| **Machine** | id, lineId, name, assetTag (unique, e.g. `STP-PR-03`), type (e.g. "Hydraulic press"), status (`RUNNING` \| `DEGRADED` \| `DOWN`), archivedAt?, createdAt, updatedAt |
| **WorkOrder** | id, number (unique, sequence-based, shown as `WO-1042`), machineId, reportedById, assignedToId?, title, description?, category, priority (`LOW` \| `MEDIUM` \| `HIGH` \| `CRITICAL`), status (`OPEN` \| `ASSIGNED` \| `IN_PROGRESS` \| `RESOLVED` \| `CLOSED` \| `CANCELLED`), machineStopped, resolutionNote?, reportedAt, assignedAt?, startedAt?, resolvedAt?, closedAt?, cancelledAt?, updatedAt |
| **WorkOrderEvent** | id, workOrderId, actorId, action (`REPORTED` \| `ASSIGNED` \| `REASSIGNED` \| `STARTED` \| `RESOLVED` \| `CLOSED` \| `REJECTED` \| `CANCELLED` \| `PRIORITY_CHANGED` \| `LOG_ADDED`), fromStatus?, toStatus?, note?, metadata (JSON)?, createdAt |
| **WorkLog** | id, workOrderId, technicianId, note, minutesSpent, partsUsed?, createdAt |
| **DowntimeEvent** | id, machineId, workOrderId? (the work order that started it), startedAt, endedAt? |

**Indexes:** WorkOrder (status, priority), (machineId, status), (assignedToId, status), reportedAt; DowntimeEvent (machineId, startedAt), (endedAt); partial unique index so each machine can have only one DowntimeEvent where `endedAt IS NULL`.

### Metric definitions (MVP)
For a date range `[from, to)`, optionally filtered by line. Downtime events that are still open count up to `now()`.

| Metric | Definition |
|---|---|
| **Downtime** | Sum of each DowntimeEvent's overlap with the range |
| **Breakdowns** | Count of DowntimeEvents that started in the range |
| **MTTR** | Average duration of DowntimeEvents that *ended* in the range |
| **MTBF** | (Scheduled machine-hours − downtime hours) ÷ breakdowns. MVP assumes 24/7 scheduling. |
| **Availability** | (Scheduled time − downtime) ÷ scheduled time, per machine; the plant figure is the average across machines |

These assumptions are shown on the dashboard in an info tooltip.

## 9. Non-functional requirements

| Area | Requirement |
|---|---|
| **Security** | OWASP basics: helmet headers, CORS allow-list, argon2 password hashing, httpOnly cookies, rate-limited auth, Zod validation on every input, parameterized SQL only, environment variables validated at startup, no secrets in the repo, Dependabot |
| **Performance** | Warm API p95 under 300 ms for list and detail endpoints with seed data; dashboard queries under 500 ms; Lighthouse performance ≥ 90 on the frontend |
| **Accessibility** | WCAG 2.2 AA: status never conveyed by colour alone, full keyboard support, visible focus, 44×44 px minimum touch targets on operator screens, charts with table alternatives, zero serious or critical axe violations on key pages |
| **Responsiveness** | Operator flows built for tablets first (768 px+) and usable on phones; supervisor screens built for desktop first (1280 px+) |
| **Reliability** | Socket reconnection with data refetch; graceful cold start; nightly demo reset |
| **Observability** | Structured JSON logs (pino) with request IDs; Sentry error tracking for frontend and backend |
| **Cost** | $0/month: Vercel Hobby, Render free, Neon free, GitHub Actions free minutes, Sentry free |
| **Quality** | TypeScript strict; ESLint and Prettier; CI must pass before merge; ≥ 80% line coverage on backend services and the state machine |

## 10. Success metrics

Portfolio-oriented, measurable:
1. A first-time visitor can complete the breakdown loop across all three roles in **under 3 minutes** using demo logins.
2. **CI is green** on `main`, with unit, integration and E2E suites.
3. Lighthouse **≥ 90** for performance, accessibility and best practices on the sign-in page and status board.
4. **Zero** serious or critical axe violations on the six key screens.
5. The README lets a developer clone and run locally on Windows in **under 15 minutes**.
6. Live demo uptime is maintained (cold starts handled), and the nightly reset runs successfully for 7 consecutive days.

## 11. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Render free tier sleeps (30–60 s cold start) | Visitors bounce | Frontend on Vercel loads instantly; branded warm-up screen (PLAT-1) |
| Cross-site cookies blocked (Safari and others) | Login breaks in production | Vercel rewrite makes `/api` same-site; sockets use ticket auth |
| Socket connections drop when Render sleeps or redeploys | Stale UI | Socket.IO auto-reconnect plus refetch of all queries on reconnect |
| Demo vandalism (archived machines, renamed users) | Demo looks broken | Demo-user guards (AUTH-2); nightly reset (PLAT-2) |
| Neon free-tier limits (storage and compute hours) | Database pauses or fills up | Small seed (about 6 months, about 300 work orders); pooled connections; Neon scales to zero when idle |
| Metric definitions questioned in interviews | Credibility | Documented formulas (§8), SQL covered by fixture-based tests, assumptions shown in the UI |
| Scope creep / losing momentum | Never ships | Phased plan where every phase is deployable; v2 list is frozen |
| Timezone bugs in daily charts | Wrong numbers | Store UTC; bucket by day in SQL with `AT TIME ZONE 'America/Toronto'`; test around DST changes |
| Concurrent updates (two supervisors assigning at once) | Inconsistent state | Transitions run in a database transaction that checks the expected `fromStatus`; a mismatch returns 409 |

## 12. Open questions

- Which v2 feature first? (Recommended: the sensor simulator, since it reuses the real-time plumbing.)
- Custom domain (about $15/year) vs `*.vercel.app`? This is the only possible cost and is optional.
