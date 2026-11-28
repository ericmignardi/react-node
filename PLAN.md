# Hammerline: Build Plan

> Companion to [PRD.md](PRD.md). Story IDs (e.g. `WO-1`) refer to PRD §6.
> Estimated MVP effort: **~75–100 hours** across 8 phases. **Every phase ends with something that runs and can be deployed.**

---

## 1. Architecture overview

```
                         ┌──────────────────────────────────────────┐
  Browser                │ Vercel (free)                            │
  ───────►  https://hammerline.vercel.app                           │
                         │  React SPA (static, CDN)                 │
                         │  rewrite: /api/*  ──────────────────┐    │
                         └─────────────────────────────────────│────┘
                                                               │ same-site → cookies work
        Socket.IO (wss, ticket auth, direct)                   ▼
  Browser ─────────────────────────────────►  ┌───────────────────────────────┐
                                              │ Render (free, Docker image)    │
                                              │ Express 5 API  /api/v1/*       │
                                              │ Socket.IO server               │
                                              │ pino logs · Sentry             │
                                              └───────────────┬───────────────┘
                                                              │ Prisma (pooled)
                                                              ▼
                                              ┌───────────────────────────────┐
                                              │ Neon Postgres (free)           │
                                              └───────────────────────────────┘
  GitHub Actions: CI on every PR/push · nightly demo reset · Dependabot
```

### Request flow for a state change
1. The client calls `POST /api/v1/work-orders/:id/transitions` with `{ action: "resolve", note }`.
2. Middleware runs in order: request ID → helmet / CORS → `requireAuth` → `validate(schema)`.
3. The work-orders service loads the work order and asks the **state machine** whether this role and status allow the action.
4. A **database transaction** updates the work order (only if it is still in the expected status), writes a WorkOrderEvent, recomputes machine status, and opens or closes the DowntimeEvent.
5. **After the commit**, the realtime module emits `workorder:updated` and `machine:status`.
6. Clients receive the events and invalidate or update their TanStack Query caches, so the UI re-renders.

### Key principles
- **REST + Postgres is the single source of truth.** Sockets only signal that something changed.
- **Business rules live in services**, never in route handlers or React components.
- **One Zod schema per contract** in `shared/`, used by both the React forms and the API validation.
- **Metrics are derived from events** with raw SQL. Totals are never stored.

## 2. Finalized stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript 6 (strict) everywhere | End-to-end type safety; the industry default |
| Monorepo | npm workspaces (`backend`, `frontend`, `shared`) | Shared schemas and types without extra tooling; works natively on Windows |
| Backend | Node 24, Express 5 | Already scaffolded; widely used; async errors handled natively |
| Real-time | Socket.IO 4 | Rooms, auto-reconnect, transport fallback |
| Database | PostgreSQL 17 (Docker locally, Neon in production) | Relational data and date math for metrics |
| ORM | Prisma (latest) + `$queryRaw` for metrics | Readable schema, migrations, generated types; raw SQL shows real SQL skill |
| Validation | Zod (in `shared/`) | One schema for forms, API validation and OpenAPI docs |
| Auth | JWT access token (`jose`) + opaque rotating refresh tokens, argon2 (`@node-rs/argon2`) | Demonstrates token rotation and reuse detection; no native build tools needed on Windows |
| API docs | `@asteasolutions/zod-to-openapi` + `swagger-ui-express` | Docs generated from the same Zod schemas |
| Security | helmet, cors, express-rate-limit | OWASP basics |
| Logging | pino + pino-http (request IDs), pino-pretty in dev | Structured logs |
| Errors | Sentry (`@sentry/node`, `@sentry/react`) | Real production error tracking on the free tier |
| Frontend | React 19, Vite 8, Tailwind v4 | Already scaffolded |
| Routing | React Router v7 (data router, SPA mode) | Most common; loaders and route guards |
| Server state | TanStack Query v5 | Caching, retries, socket-driven invalidation |
| Forms | React Hook Form + `@hookform/resolvers/zod` | Standard pairing |
| UI kit | shadcn/ui (Radix + Tailwind) | Accessible primitives; code lives in the repo |
| Tables | TanStack Table v8 (server-side mode) | Sorting, filtering and pagination driven by the URL |
| Charts | Recharts | Simple React charts |
| Utilities | lucide-react, date-fns + `@date-fns/tz`, clsx/tailwind-merge | Lightweight |
| Testing | Vitest, Supertest, React Testing Library, MSW, Playwright, `@axe-core/playwright` | Full test pyramid |
| Seed data | `@faker-js/faker` with a fixed seed | Deterministic, realistic history |
| Tooling | ESLint (flat config), Prettier, `concurrently`, `cross-env` | Cross-platform scripts on Windows |
| CI/CD | GitHub Actions, Render auto-deploy, Vercel Git integration | Free, standard |
| Containers | Docker (multi-stage `node:24-slim`), docker compose | Same image locally and in production |

## 3. Folder structure (target)

```
hammerline/
├─ .github/
│  ├─ workflows/
│  │  ├─ ci.yml                 # lint, typecheck, test, build, docker build, e2e
│  │  └─ demo-reset.yml         # nightly reseed of the demo DB
│  ├─ dependabot.yml
│  └─ pull_request_template.md
├─ backend/
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  ├─ migrations/
│  │  └─ seed/                  # seed.ts, plant.ts, history.ts, users.ts
│  ├─ src/
│  │  ├─ config/env.ts          # Zod-validated env
│  │  ├─ lib/                   # prisma.ts, logger.ts, errors.ts (AppError), sentry.ts
│  │  ├─ middleware/            # requireAuth, requireRole, validate, errorHandler, notFound, rateLimit
│  │  ├─ modules/
│  │  │  ├─ auth/               # routes, controller, service, tokens.ts, cookies.ts
│  │  │  ├─ users/
│  │  │  ├─ lines/
│  │  │  ├─ machines/           # incl. machineStatus.ts (recompute rule)
│  │  │  ├─ work-orders/        # incl. stateMachine.ts, transitions.service.ts
│  │  │  ├─ metrics/            # metrics.sql.ts (raw SQL), service, routes
│  │  │  └─ health/
│  │  ├─ realtime/              # io.ts, tickets.ts, emit.ts
│  │  ├─ docs/openapi.ts
│  │  ├─ app.ts                 # builds Express app (imported by tests)
│  │  └─ server.ts              # http server + Socket.IO + listen
│  ├─ tests/
│  │  ├─ unit/
│  │  ├─ integration/
│  │  └─ helpers/               # test db reset, factories, auth agent
│  ├─ Dockerfile
│  └─ package.json
├─ frontend/
│  ├─ src/
│  │  ├─ app/                   # router.tsx, providers.tsx, AppShell, guards
│  │  ├─ components/
│  │  │  ├─ ui/                 # shadcn components
│  │  │  └─ common/             # StatusBadge, PriorityBadge, EmptyState, ErrorState, DataTable...
│  │  ├─ features/
│  │  │  ├─ auth/               # LoginPage, DemoLoginCards, useAuth
│  │  │  ├─ warmup/             # WarmupScreen
│  │  │  ├─ board/              # StatusBoardPage, MachineTile
│  │  │  ├─ machines/
│  │  │  ├─ work-orders/        # ReportIssuePage, WorkOrderListPage, WorkOrderDetailPage, Timeline...
│  │  │  ├─ dashboard/
│  │  │  └─ users/
│  │  ├─ lib/                   # api.ts (fetch wrapper + refresh), queryClient.ts, socket.ts, queryKeys.ts
│  │  ├─ styles/
│  │  └─ main.tsx
│  ├─ tests/                    # RTL + MSW handlers
│  ├─ vercel.json               # rewrites
│  └─ package.json
├─ shared/
│  ├─ src/
│  │  ├─ enums.ts               # Role, MachineStatus, WorkOrderStatus, Priority, Category
│  │  ├─ schemas/               # auth, users, machines, workOrders, metrics, pagination, errors
│  │  └─ index.ts
│  └─ package.json
├─ e2e/                         # Playwright specs + config
├─ docs/
│  ├─ architecture.md           # diagrams
│  └─ adr/                      # 0001-monorepo.md, 0002-auth-tokens.md, ...
├─ docker-compose.yml           # postgres (dev + test databases)
├─ package.json                 # workspaces + root scripts
├─ PRD.md · PLAN.md · README.md · DESIGN-PROMPT.md
```

## 4. API surface (v1)

All routes are prefixed with `/api/v1`. **Auth** column: 🔓 public, 🔐 any signed-in user, S/T/O = Supervisor / Technician / Operator.

| Method | Path | Auth | Story |
|---|---|---|---|
| GET | `/health` | 🔓 | PLAT-4 |
| POST | `/auth/login` | 🔓 (rate-limited) | AUTH-1 |
| POST | `/auth/demo-login` `{ role }` | 🔓 (DEMO_MODE) | AUTH-2 |
| POST | `/auth/refresh` | refresh cookie | AUTH-3 |
| POST | `/auth/logout` | 🔐 | AUTH-4 |
| GET | `/auth/me` | 🔐 | AUTH-5 |
| POST | `/auth/socket-ticket` | 🔐 | RT-1 |
| GET / POST | `/users` | S (GET also T/S with `?role=TECHNICIAN` for the assign picker) | USER-1, WO-3 |
| PATCH | `/users/:id` | S | USER-1 |
| GET | `/lines` | 🔐 | MACH-1 |
| POST / PATCH | `/lines`, `/lines/:id` | S | MACH-3 |
| GET | `/machines` (filters, pagination) | 🔐 | MACH-1, BOARD-1 |
| GET | `/machines/:id` | 🔐 | MACH-2 |
| POST / PATCH | `/machines`, `/machines/:id` | S | MACH-3 |
| POST | `/machines/:id/archive`, `/machines/:id/restore` | S | MACH-3 |
| GET | `/work-orders` (filters, pagination, `?mine=reported\|assigned`) | 🔐 | WO-2, WO-4, WO-8 |
| POST | `/work-orders` | O, S | WO-1 |
| GET | `/work-orders/:id` (with events, logs) | 🔐 | WO-7 |
| PATCH | `/work-orders/:id` (priority, title, description) | S | WO-3 |
| POST | `/work-orders/:id/transitions` `{ action, assigneeId?, note? }` | role per state machine | WO-3, WO-4, WO-6 |
| POST | `/work-orders/:id/logs` | assigned T | WO-5 |
| GET | `/metrics/summary?from&to&lineId` | S | DASH-1 |
| GET | `/metrics/downtime-trend` · `/downtime-by-machine` · `/downtime-by-line` · `/breakdowns-by-category` | S | DASH-2 |
| GET | `/api/docs` | 🔓 | PLAT-3 |

**Error shape:** `{ "error": { "code": "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL", "message": string, "details"?: unknown, "requestId": string } }`
**List shape:** `{ "data": T[], "meta": { "page", "pageSize", "total", "totalPages" } }`

**Socket events (server → client):** `machine:status { machineId, status, since }`, `workorder:created`, `workorder:updated { id, status, ... }`, `metrics:changed`. Rooms: `role:SUPERVISOR`, `role:TECHNICIAN`, `role:OPERATOR`, `user:<id>`, and `plant` (everyone).

---

## 5. Phased build plan

Each phase: **tasks → stories delivered → "done when" checklist.** Merge each phase to `main` through a PR with CI passing.

### Phase 0: Foundations (~8–10 h)
**Goal:** a monorepo running locally with a database, a clean backend skeleton and CI.

Tasks
1. Add a root `package.json` with `"workspaces": ["shared", "backend", "frontend"]` and root scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `db:up`, `db:down`, `db:migrate`, `db:seed`, `db:reset`). Use `concurrently` for `dev`. Remove the per-package lockfiles in favour of one root `package-lock.json`.
2. Create `shared/` (TypeScript, built to `dist`, or consumed as source through `exports` + TS project references). Add `enums.ts` and starter schemas (pagination, error shape).
3. Add `docker-compose.yml` with Postgres 17, a named volume, and an init script that creates `hammerline` and `hammerline_test` databases.
4. Install Prisma. Write the full `schema.prisma` from PRD §8 (including indexes; add the partial unique index for open downtime events with a custom SQL migration). Run the first migration.
5. Backend restructure: split `index.ts` into `app.ts` + `server.ts`. Add `config/env.ts` (Zod-validated; this also **fixes the current broken import in `errorHandler.ts`**), `lib/logger.ts` (pino + pino-http with request IDs), `lib/errors.ts` (`AppError`), the standard error handler, helmet, CORS allow-list, and the `/api/v1/health` route with a DB check.
6. Set up Vitest in all three packages; one smoke test each. Supertest test for `/health`.
7. Root ESLint and Prettier alignment (the frontend currently has no Prettier); `.editorconfig`; `.gitattributes` (`* text=auto eol=lf`) to avoid line-ending noise on Windows.
8. GitHub Actions `ci.yml`: `npm ci` → lint → typecheck → test (Postgres service container) → build.
9. Add `docs/adr/0001-monorepo-npm-workspaces.md`.

Stories: PLAT-4

Done when
- [ ] `npm install` at the root, `npm run db:up`, `npm run db:migrate`, `npm run dev` start Postgres, the API (:3000) and Vite (:5173) on Windows
- [ ] `GET http://localhost:3000/api/v1/health` → `{ status: "ok", db: "ok" }`
- [ ] The Vite dev server proxies `/api` to `:3000` (mirrors the production rewrite)
- [ ] `npm run lint`, `npm run typecheck` and `npm test` pass locally and in CI

### Phase 1: Deployed walking skeleton (~5–7 h)
**Goal:** the full production path works before any features exist. This tests the riskiest infrastructure first.

Tasks
1. Multi-stage `backend/Dockerfile` (build context = repo root so workspaces resolve). Start command runs `prisma migrate deploy` and then `node dist/server.js`. Add a `.dockerignore`.
2. Create the Neon project. Use the pooled connection string as `DATABASE_URL` and the direct one as `DIRECT_DATABASE_URL` (for migrations).
3. Create the Render web service from the Dockerfile, with health check path `/api/v1/health` and environment variables set. Turn on auto-deploy, set to wait for CI checks.
4. Create the Vercel project (root directory `frontend`). Add `vercel.json` with a rewrite of `/api/:path*` → `https://<render-app>.onrender.com/api/:path*` and an SPA fallback.
5. **Warm-up screen** (PLAT-1): on app load, poll `/api/v1/health` with backoff, show branded progress messaging, then render the app. Show a retry option after 90 seconds.
6. Sentry for backend and frontend (DSNs as environment variables; source maps uploaded in the Vercel build if time allows).
7. Replace the Vite starter page with a minimal "Hammerline" placeholder.

Stories: PLAT-1, PLAT-4

Done when
- [ ] The live Vercel URL shows the warm-up screen when Render is asleep, then a placeholder page saying "API connected"
- [ ] A test error thrown in production appears in Sentry for both frontend and backend
- [ ] Pushing to `main` with CI passing redeploys both services automatically

### Phase 2: Auth, roles & app shell (~12–15 h)
**Goal:** real sign-in with all three roles, protected navigation, and user management.

Tasks
1. Shared schemas: login, demo-login, user create and update.
2. Auth service: argon2 verify; sign access JWT (`jose`, 15 minutes); create an opaque refresh token (32 random bytes, stored as SHA-256 hash, `familyId`); rotate on refresh; **reuse detection** revokes the whole family; logout revokes it.
3. Cookie helpers: `hl_access` (path `/`), `hl_refresh` (path `/api/v1/auth`); `httpOnly`, `Secure` in production, `SameSite=Lax`.
4. Middleware: `requireAuth` (reads the access cookie, attaches `req.user`), `requireRole(...roles)`. Rate limiter on `/auth/login` and `/auth/demo-login`.
5. Demo login gated by `DEMO_MODE`; demo-user guards in the users service.
6. Users module (CRUD with search and filters, self-deactivation blocked).
7. Seed: base users (3 demo users, plus ~4 technicians, ~6 operators, 1 extra supervisor).
8. Frontend: `api.ts` fetch wrapper (on 401, refresh once, then retry; on failure, go to `/login`), `AuthProvider` + `useAuth` (`/auth/me`), `LoginPage` with **demo role cards**, `AppShell` (sidebar/topbar, role-aware navigation, user menu, theme toggle), `RequireRole` route guard, 403 and 404 pages, Users page (table + create/edit dialog).
9. Tests: unit tests for token rotation and reuse detection; integration tests for login, refresh, logout, the rate limit, and a **role-based access matrix test** (each role × each protected route); RTL test for the login form.
10. ADR `0002-auth-jwt-refresh-rotation.md`.

Stories: AUTH-1, AUTH-2, AUTH-3, AUTH-4, AUTH-5, USER-1

Done when
- [ ] Each demo card signs in as that role and lands on the correct home screen (Operator → Report / My reports, Technician → My assignments, Supervisor → Dashboard; the dashboard is a placeholder until Phase 6)
- [ ] Reloading the page keeps you signed in; expired access tokens refresh silently
- [ ] A reused refresh token forces a new sign-in (integration test)
- [ ] An Operator calling `GET /users` gets 403; the navigation doesn't show the link
- [ ] Deployed and working on the live URL in Safari and Chrome

### Phase 3: Plant, machines & status board (~8–10 h)
**Goal:** the plant structure exists and is visible.

Tasks
1. Lines and machines modules (CRUD, archive/restore with the 409 rule, list filters and pagination).
2. Seed: Bayfront Metal Works with 3 lines (Stamping `STP`, Welding `WLD`, Finishing `FIN`) and ~15 machines (presses, robotic weld cells, a powder-coat booth, a cure oven, and so on).
3. Frontend: Machines list (TanStack Table, URL-driven filters), Machine detail (status, active work orders placeholder), supervisor create/edit dialogs, archive confirmation.
4. **Status board**: grid grouped by line, `MachineTile` showing status colour, icon and label, summary counts, live "down for" timer (driven by the client clock), keyboard-selectable tiles, and a `?display=wall` mode (no navigation, larger type).
5. Shared `StatusBadge`, `EmptyState`, `ErrorState` and skeleton loaders.
6. Tests: integration tests for machines CRUD, the archive conflict, and filters; RTL test for `MachineTile` (status text is present, not just colour).

Stories: MACH-1, MACH-2, MACH-3, BOARD-1 (static for now; live in Phase 5)

Done when
- [ ] Supervisor can add a line and machine, then archive and restore it; archived machines are hidden by default
- [ ] Status board shows all seeded machines grouped by line with correct counts
- [ ] Asset tag uniqueness is enforced with a friendly inline error

### Phase 4: Work orders, the breakdown loop (~18–22 h)
**Goal:** the core workflow works end to end (without live updates yet).

Tasks
1. Shared schemas: report issue, transition (a discriminated union on `action`), work log, list query.
2. **`stateMachine.ts`**: a pure function `canTransition(role, userId, workOrder, action)` returning the allowed result or a reason, plus `nextStatus(action)`. Fully unit-tested (every row of the PRD §5 table, plus disallowed combinations).
3. **`machineStatus.ts`**: a pure function that computes the status from active work orders; a service that applies it and opens or closes the DowntimeEvent inside the transaction.
4. Transitions service: in a transaction, use a conditional update (`WHERE id = ? AND status = ?`); if no rows change → 409. Write the WorkOrderEvent, recompute machine status, set timestamps.
5. Work order number: a Postgres sequence, formatted as `WO-####`.
6. Work order routes: list (filters, sort, pagination, `mine`), create, detail (with events and logs, including actor names), patch (priority with a `PRIORITY_CHANGED` event), transitions, logs.
7. Frontend:
   - **Report Issue** (tablet-first, big targets, machine combobox, stopped yes/no toggle, duplicate-active warning, success screen with the WO number)
   - **My reports** (Operator), **My assignments** (Technician cards with Start / Resolve / Add log)
   - **Work order list** (TanStack Table, URL state, filters drawer, priority/status badges)
   - **Work order detail** (summary, machine link, role-aware action bar, resolve/reject/cancel dialogs requiring notes, assign dialog with a technician picker showing active-assignment counts, work log list with total minutes, **audit timeline**)
   - Fill in machine detail: active and recent work orders, last 30 days of downtime (simple total)
8. Seed: a handful of currently active work orders so the board shows Down and Degraded machines on day one.
9. Tests: state machine unit tests; integration tests for the full loop (report → assign → start → log → resolve → close), reject, cancel, 403s for the wrong technician, 409 for a stale transition, downtime events opened and closed correctly, and two stopping work orders on one machine; RTL tests for report form validation and role-aware action buttons.
10. ADR `0003-work-order-state-machine.md`.

Stories: WO-1, WO-2, WO-3, WO-4, WO-5, WO-6, WO-7, WO-8

Done when
- [ ] With three browser windows (one per demo role), you can run the full loop by refreshing between steps
- [ ] Machine status and DowntimeEvents are correct in every scenario above (integration tests pass)
- [ ] The audit timeline shows every action with actor and timestamp
- [ ] List filters survive a page reload and the back button

### Phase 5: Real-time (~6–8 h)
**Goal:** the loop happens live with no refreshing.

Tasks
1. `realtime/io.ts`: attach Socket.IO to the HTTP server; CORS limited to `CLIENT_URL`.
2. `tickets.ts`: `POST /auth/socket-ticket` creates a random single-use ticket (in-memory map, 30-second time limit, tied to the user ID). The Socket.IO middleware verifies and consumes it, then joins rooms (`plant`, `role:*`, `user:<id>`). *Note in the ADR: the in-memory store is fine for a single instance; Redis would be needed if the app scales to multiple instances.*
3. `emit.ts`: typed emit helpers called **after the transaction commits** in the work-order and machine services.
4. Frontend `socket.ts`: connect to `VITE_SOCKET_URL` with a fresh ticket (fetch a new ticket on every reconnect attempt); on events, call `queryClient.invalidateQueries` with typed query keys (or `setQueryData` for `machine:status`); invalidate everything on reconnect.
5. Connection indicator in the top bar (Live / Reconnecting / Offline) with an `aria-live` announcement. Supervisor toast when a `machine:status` event reports DOWN (links to the work order).
6. Tests: integration test with `socket.io-client` (connect with a ticket, receive `machine:status` after reporting; reject a reused ticket).

Stories: RT-1, BOARD-1 (live), DASH-3 groundwork

Done when
- [ ] Operator reports in window A → the board flips to DOWN in windows B and C within about a second, without refreshing
- [ ] Killing and restarting the API shows Reconnecting → Live, and the data is current afterwards
- [ ] A reused or expired ticket is rejected (test)
- [ ] Works on the deployed site (Vercel frontend → direct wss to Render)

### Phase 6: Dashboard & metrics (~10–12 h)
**Goal:** honest, explainable metrics over realistic history.

Tasks
1. **History seed**: ~6 months of deterministic history (faker seed), with ~300 work orders and matching events, logs and downtime events. Give a few chronically bad machines realistic distributions, and include some breakdowns that run past midnight.
2. `metrics.sql.ts`: parameterized raw SQL using `tstzrange` overlap (or `GREATEST`/`LEAST` clamping) for downtime, MTTR, MTBF, availability, a daily trend bucketed with `AT TIME ZONE 'America/Toronto'` and `generate_series` (so days with no downtime still appear), top machines, by line, by category. Optional line filter.
3. Metrics routes with Zod-validated `from`/`to` (max range 365 days).
4. Frontend dashboard: date-range presets (7/30/90 days, custom), line filter (both in the URL), KPI cards with info tooltips explaining each formula, four Recharts charts, each with "View as table", empty states, skeletons. Invalidate on `metrics:changed`.
5. Tests: **fixture-based SQL tests**: insert a known set of downtime events (including one that crosses the range boundary, one still open, and one across a DST change) and assert exact numbers.

Stories: DASH-1, DASH-2, DASH-3

Done when
- [ ] Dashboard loads in under 500 ms (warm) with seed data, and numbers match the fixture tests
- [ ] Resolving a work order in another window updates the KPIs live
- [ ] Every chart is usable as a table with the keyboard and a screen reader

### Phase 7: Hardening, docs & launch (~10–14 h)
**Goal:** portfolio-ready polish and proof of quality.

Tasks
1. **Playwright E2E**: the breakdown loop across **three browser contexts** (Operator, Supervisor, Technician) asserting live updates; a demo-login smoke test; an auth-redirect test. Run in CI against the built app and a Postgres service.
2. **Accessibility**: `@axe-core/playwright` on sign-in, board, report issue, work order list, work order detail and dashboard. Fix all serious and critical issues; do a manual keyboard pass.
3. **OpenAPI** generated from Zod schemas, served at `/api/docs`.
4. **Nightly demo reset**: `demo-reset.yml` (cron `0 8 * * *` UTC ≈ 3–4 am Toronto time) runs `npm run db:reset-demo -w backend` against Neon using the `DIRECT_DATABASE_URL` secret. Can also be run manually (`workflow_dispatch`).
5. Dependabot (npm + GitHub Actions, weekly), PR template, branch protection on `main`, `npm audit` step in CI.
6. Performance pass: Lighthouse on sign-in and board, route-level code splitting (`React.lazy`) for the dashboard and Recharts, database index check with `EXPLAIN ANALYZE` on the work order list and metrics queries.
7. Docs: finish README (architecture diagram, screenshots, a GIF of the live loop, "What I'd do next"), `docs/architecture.md`, ADRs `0004-hosting-free-tier.md` and `0005-realtime-socketio.md`.
8. Final review against PRD §10 success metrics.

Stories: PLAT-2, PLAT-3, plus verification of all MVP stories

Done when
- [ ] CI runs unit, integration, E2E and axe checks, all green on `main`
- [ ] Lighthouse ≥ 90 (performance, accessibility, best practices) on sign-in and board
- [ ] Nightly reset ran successfully (check Actions history)
- [ ] README has a live demo link, demo instructions, a GIF, an architecture diagram, and setup steps verified on a clean Windows clone
- [ ] Resume bullet points drafted (see §8)

---

## 6. Story → phase traceability

| Story | Phase | | Story | Phase |
|---|---|---|---|---|
| AUTH-1 | 2 | | WO-3 | 4 |
| AUTH-2 | 2 | | WO-4 | 4 |
| AUTH-3 | 2 | | WO-5 | 4 |
| AUTH-4 | 2 | | WO-6 | 4 |
| AUTH-5 | 2 | | WO-7 | 4 |
| USER-1 | 2 | | WO-8 | 4 |
| MACH-1 | 3 | | RT-1 | 5 |
| MACH-2 | 3 (completed in 4) | | DASH-1 | 6 |
| MACH-3 | 3 | | DASH-2 | 6 |
| BOARD-1 | 3 (live in 5) | | DASH-3 | 6 (groundwork in 5) |
| WO-1 | 4 | | PLAT-1 | 1 |
| WO-2 | 4 | | PLAT-2 | 7 |
| PLAT-3 | 7 | | PLAT-4 | 0 |

## 7. Testing strategy

| Level | Tool | What | Where |
|---|---|---|---|
| Unit | Vitest | State machine, machine-status rule, token helpers, metric math helpers, shared schemas | `backend/tests/unit`, `shared` |
| Integration | Vitest + Supertest + real Postgres (`hammerline_test`) | Every route: happy path, validation, role-based access matrix, conflicts, metrics SQL with fixtures, socket events | `backend/tests/integration` |
| Component | Vitest + RTL + MSW | Forms, role-aware UI, tables, error and empty states | `frontend/tests` |
| E2E | Playwright | Breakdown loop across 3 roles with live updates; demo login; auth redirect | `e2e/` |
| Accessibility | `@axe-core/playwright` | Six key screens | `e2e/` |

Integration tests truncate all tables between test files (a helper using `TRUNCATE ... RESTART IDENTITY CASCADE`) and run files one at a time (`fileParallelism: false`) to avoid race conditions on the shared database.

## 8. Resume talking points this project earns

- "Built a full-stack maintenance and downtime tracking platform (React, TypeScript, Node/Express, PostgreSQL) for manufacturing, with real-time machine status over WebSockets."
- "Designed a server-enforced work order state machine with transactional status changes, optimistic concurrency checks and a complete audit trail."
- "Implemented JWT authentication with rotating refresh tokens and reuse detection, httpOnly cookies, and role-based access control across REST and WebSocket channels."
- "Wrote SQL analytics (MTTR, MTBF, availability) over event data using range overlap and timezone-aware daily bucketing, verified with fixture-based tests."
- "Delivered CI/CD with GitHub Actions (unit, integration, Playwright E2E, accessibility checks), Dockerized deploys to Render, Vercel previews, and Neon Postgres, at $0/month."

## 9. After the MVP (v2 order)
1. Sensor simulator + threshold alerts (reuses the real-time layer)
2. Preventive maintenance schedules (a scheduled job creating recurring work orders)
3. Parts inventory (migrate `partsUsed` text → Part / WorkOrderPart tables)
4. Notifications (in-app first, then email via Resend's free tier)
