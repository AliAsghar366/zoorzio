# Backend integration

This repo's frontend (`site/`) is a static site — untouched. The backend
(`apps/api` + `packages/database`) was brought over from the Asghar Zoorzio
monorepo and lives alongside it as an npm workspace, deployed separately.

## Layout

- `apps/api` — NestJS API (auth, memory, tasks, reminders, calendar,
  billing, channels, etc.). See `apps/api/.env.example` for every variable
  it reads.
- `packages/database` — shared Prisma schema/client used by the API.
- `site/` — the existing static frontend. Not modified beyond the two
  connection points below.

## How the frontend finds the backend

The static pages under `site/dist` already contained placeholder hooks for
this from before the backend was integrated:

- `site/dist/login/index.html` posts to `${ZOORZIO_API_URL}/auth/login` and
  expects `{ user, accessToken, refreshToken }` back — exactly what
  `apps/api`'s `AuthService.login` returns.
- Every page's "Go to Panel" / sign-in CTA reads a `PANEL_URL` and routes
  there once a token exists in `localStorage`. Since the panel (`/portal`)
  is served from this same deployment, `PANEL_URL` is fixed to `/portal/`
  (a relative path) — never an env var.

`site/tools/inject-env.js` fills these in at deploy build time (see
`vercel.json`'s `buildCommand`) by substituting the placeholder strings in
the built HTML. It reads one env var:

- `ZOORZIO_API_URL` — the deployed API's base URL, including the `/api`
  prefix (e.g. `https://your-api.up.railway.app/api`). Set this on the
  Vercel project serving `site/`. Until it's set, login shows a "not
  connected yet" message instead of failing silently.

## Deploying the API

`apps/api` is not part of the Vercel static deployment — deploy it as its
own service (Railway, Render, a VM, etc.) using `apps/api/Dockerfile`,
built with the **repo root** as the build context:

```
docker build -f apps/api/Dockerfile -t zoorzio-api .
```

Key env vars it needs (full list in `apps/api/.env.example`):

- `DATABASE_URL` / `DIRECT_URL` — Postgres (Supabase works out of the box).
- `REDIS_URL`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `CORS_ORIGIN` — must include the domain(s) the static site is served
  from, comma-separated, so the browser is allowed to call the API.
- Provider keys for whichever channels/integrations you use (WhatsApp,
  Telegram, Stripe, Google, etc.) — all optional, each feature no-ops
  without its keys.

Run the Prisma migrations once against that database:

```
npm run migration:run
```
