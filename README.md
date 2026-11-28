# Hammerline

**Maintenance & downtime tracking for the plant floor.**

Hammerline helps a manufacturing plant report machine breakdowns, coordinate repairs and measure downtime. Operators report a problem from a tablet at the line, supervisors triage and assign it, and technicians log the fix. Every screen updates live as machines go down and come back up. The dashboard turns that history into MTTR, MTBF and availability metrics.

Built as a portfolio project for Hamilton, Ontario's manufacturing sector, and seeded with a fictional plant, **Bayfront Metal Works**.

> 🚧 **Status:** in development. See [PLAN.md](PLAN.md) for the phased build plan. Setup steps below describe the target setup once Phase 0 is complete.

**Live demo:** _coming soon_ · **API docs:** _coming soon_ (`/api/docs`)

---

## Try the demo

On the sign-in page, choose **Try as Operator**, **Try as Technician** or **Try as Supervisor**. No sign-up needed.

> The API runs on a free tier that sleeps when idle. If you see **"Waking up the plant server…"**, give it 30–60 seconds.

**Suggested 3-minute tour:** open the app in three windows, one per role.
1. **Operator:** report an issue on a machine and mark it as stopped. Watch the status board turn red in every window.
2. **Supervisor:** assign the new work order to the demo technician.
3. **Technician:** start the job, add a work log entry, and resolve it. The machine goes back to Running.
4. **Supervisor:** close the work order and check the dashboard.

The demo database resets every night.

## Features

- 🔐 **Role-based access:** Operator, Technician, Supervisor; JWT access tokens + rotating refresh tokens in httpOnly cookies
- 🏭 **Plant structure:** production lines and machines, with archive and restore
- 🚨 **Issue reporting:** a tablet-friendly flow; "machine stopped?" drives DOWN vs DEGRADED status
- 🔁 **Work order lifecycle:** a server-enforced state machine (Open → Assigned → In Progress → Resolved → Closed, plus reject and cancel) with a full audit timeline
- 🛠️ **Technician work logs:** notes, time spent, parts used
- 📡 **Live status board:** real-time updates over Socket.IO
- 📊 **Dashboard:** downtime, MTTR, MTBF, availability and breakdown trends, calculated with SQL from event data
- 🔎 **Search, filter, sort and paginate** everything, with filters stored in the URL

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, React Router v7, TanStack Query, TanStack Table, React Hook Form, Recharts |
| Backend | Node.js 24, Express 5, TypeScript, Socket.IO, Prisma, Zod, pino, helmet |
| Shared | `shared/` workspace: Zod schemas and enums used by both frontend and backend |
| Database | PostgreSQL 17 (Docker locally, Neon in production) |
| Testing | Vitest, Supertest, React Testing Library, MSW, Playwright, axe-core |
| DevOps | Docker, GitHub Actions, Render (API), Vercel (frontend), Sentry |

## Architecture

```
Browser ──► Vercel (React SPA) ── /api/* rewrite ──► Render (Express + Socket.IO, Docker) ──► Neon Postgres
   └──────────── Socket.IO (wss, ticket auth) ───────────┘
```

- **REST + Postgres is the source of truth.** Socket.IO only tells clients to refresh their cached data.
- A **Vercel rewrite** keeps API calls same-site, so httpOnly auth cookies work in every browser.
- **Metrics are derived from downtime events** with raw SQL; totals are never stored.

More detail: [PLAN.md](PLAN.md#1-architecture-overview) · [docs/architecture.md](docs/architecture.md) · [docs/adr/](docs/adr/)

## Prerequisites

Tested on **Windows 11** (PowerShell). Works on macOS and Linux too.

- [Node.js](https://nodejs.org/) **24+** (`node -v`)
- npm 10+ (bundled with Node)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (running)
- Git

## Getting started

```powershell
# 1. Clone and install (one install for all workspaces)
git clone https://github.com/<your-username>/hammerline.git
cd hammerline
npm install

# 2. Environment variables
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env

# 3. Start Postgres (creates the hammerline and hammerline_test databases)
npm run db:up

# 4. Create the schema and seed Bayfront Metal Works
npm run db:migrate
npm run db:seed

# 5. Run API + frontend together
npm run dev
```

- Frontend: <http://localhost:5173>
- API: <http://localhost:3000/api/v1/health>
- API docs: <http://localhost:3000/api/docs>

In development, Vite proxies `/api` to the API, the same way the Vercel rewrite works in production.

**Demo accounts (local seed):** use the demo buttons on the sign-in page, or sign in with `operator@demo.hammerline.dev`, `technician@demo.hammerline.dev` or `supervisor@demo.hammerline.dev` and the password in `backend/.env` (`DEMO_PASSWORD`).

## Environment variables

### `backend/.env`

| Variable | Example | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `PORT` | `3000` | API port |
| `DATABASE_URL` | `postgresql://hammerline:hammerline@localhost:5432/hammerline` | Runtime connection (Neon **pooled** URL in production) |
| `DIRECT_DATABASE_URL` | same as above locally | Used for migrations (Neon **direct** URL in production) |
| `TEST_DATABASE_URL` | `postgresql://hammerline:hammerline@localhost:5432/hammerline_test` | Integration tests |
| `CLIENT_URL` | `http://localhost:5173` | Comma-separated list of origins allowed by CORS and Socket.IO |
| `JWT_ACCESS_SECRET` | _32+ random chars_ | Signs access tokens |
| `ACCESS_TOKEN_TTL` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | `7` | Refresh token lifetime |
| `DEMO_MODE` | `true` | Enables one-click demo logins |
| `DEMO_PASSWORD` | _choose one_ | Password set on seeded demo users |
| `LOG_LEVEL` | `info` | pino log level |
| `SENTRY_DSN` | _(optional)_ | Backend error tracking |

The API validates these at startup and refuses to start if any are missing or invalid.

Generate a secret in PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

### `frontend/.env`

| Variable | Example | Description |
|---|---|---|
| `VITE_SOCKET_URL` | `http://localhost:3000` | Socket.IO server (the Render URL in production) |
| `VITE_SENTRY_DSN` | _(optional)_ | Frontend error tracking |

## Scripts

Run from the repo root.

| Script | What it does |
|---|---|
| `npm run dev` | Start API and frontend together (watch mode) |
| `npm run build` | Build `shared`, `backend` and `frontend` |
| `npm run lint` | ESLint across all workspaces |
| `npm run typecheck` | `tsc --noEmit` across all workspaces |
| `npm run format` | Prettier write |
| `npm test` | Unit, integration and component tests (Vitest) |
| `npm run test:e2e` | Playwright end-to-end and accessibility tests |
| `npm run db:up` / `db:down` | Start / stop Postgres in Docker |
| `npm run db:migrate` | Apply Prisma migrations (dev) |
| `npm run db:seed` | Seed plant, users and ~6 months of history |
| `npm run db:reset` | Drop, migrate and reseed the local database |

Workspace-specific: `npm run <script> -w backend` (or `-w frontend`, `-w shared`).

## Project structure

```
hammerline/
├─ backend/          Express API, Socket.IO, Prisma schema, migrations, seed, tests, Dockerfile
│  └─ src/modules/   auth · users · lines · machines · work-orders · metrics · health
├─ frontend/         React SPA (features/, components/, lib/), Vercel config
├─ shared/           Zod schemas + enums shared by both sides
├─ e2e/              Playwright specs
├─ docs/             architecture notes and ADRs
├─ .github/          CI, nightly demo reset, Dependabot
├─ docker-compose.yml
├─ PRD.md            product requirements
├─ PLAN.md           architecture + phased build plan
└─ DESIGN-PROMPT.md  UI design brief
```

## Testing

```powershell
npm run db:up      # tests use the hammerline_test database
npm test           # Vitest: unit + integration + component
npm run test:e2e   # Playwright (first time: npx playwright install)
```

## Deployment

| Piece | Host | Notes |
|---|---|---|
| Frontend | Vercel (Hobby) | Root directory `frontend`; `vercel.json` rewrites `/api/*` to Render |
| API | Render (free web service) | Built from `backend/Dockerfile`; runs `prisma migrate deploy` on start; health check `/api/v1/health` |
| Database | Neon (free) | Pooled URL for runtime, direct URL for migrations |
| CI/CD | GitHub Actions | Render and Vercel deploy from `main` after CI passes; nightly demo reset workflow |

See [PLAN.md, Phase 1](PLAN.md#phase-1-deployed-walking-skeleton-57-h) for step-by-step setup.

## Roadmap

MVP progress is tracked in [PLAN.md](PLAN.md). Planned after the MVP: a sensor simulator with automatic alerts, preventive maintenance schedules, parts inventory, and notifications.

## License

MIT (license file to be added).
