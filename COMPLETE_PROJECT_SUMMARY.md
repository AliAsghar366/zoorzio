# Anchor - Project Status

_Last updated: 2026-08-27_

This is the canonical, kept-current status doc for the repo. `FINAL_SUMMARY.md`
and `PROJECT_SUMMARY.md` are historical snapshots from an earlier pass that
significantly overstated completion (e.g. claiming the project was "complete"
and "ready for a YC application" while most integrations were hardcoded
mocks) - they now just point here. If you're deciding what to work on next,
trust this file over anything with a ✅ next to every line item.

## What's real today

### packages/database
Real Prisma schema, generates correctly, wired as a proper npm workspace
package (`@anchor/database`) that `apps/api` depends on. Seed script lives
alongside the schema. **No migration history exists yet** - `prisma
migrate dev` has never been run against a live database, so there's no
`packages/database/prisma/migrations/` folder. Running `npm run db:migrate`
against a real Postgres instance for the first time will generate it.

### packages/shared, packages/ui
Real, non-empty packages now. `@anchor/shared` holds the enums/types/utility
functions previously duplicated across apps/api and apps/web. `@anchor/ui`
holds the Button/Card/Input components, consumed by `apps/web`.

### apps/api (NestJS)
Typechecks cleanly, builds (`nest build`), and passes its full test suite
(359 tests). Real, DB-backed: auth (JWT + argon2id), memory/task/calendar
CRUD, RBAC via API-key scoping, session validation, AES-256-GCM encryption.
Real external calls: WhatsApp Business Cloud API and Telegram Bot API
outbound sends, SendGrid email, Google Calendar and Outlook (Microsoft
Graph) sync via OAuth access tokens you provide. AI (summarization,
embeddings, task extraction, transcription, image description) is proxied
to `apps/ai` over HTTP rather than duplicated locally.

**Known gaps:** no OAuth *consent flow* UI for connecting Google/Outlook
calendars (the API expects you already have an access/refresh token pair);
no generic file-upload endpoint (only channel-sourced media from
WhatsApp/Telegram has a URL to fetch), so the mobile app's photo/document
capture creates a text memory referencing the local file rather than
uploading and OCR'ing the image itself.

### apps/ai (Python/FastAPI)
Every endpoint makes a real OpenAI API call (chat completions, embeddings,
Whisper transcription via the audio API, vision-based image description).
Requires `OPENAI_API_KEY` to be set - without it, endpoints return `503`
rather than silently faking a response. 6/6 tests pass (mocking the OpenAI
client, not the network).

### apps/web (Next.js)
Typechecks, builds, and passes its test suite. Real auth flow (login/
register page, token storage + refresh, route-group auth guard), real nav,
and dashboard/memories/tasks/calendar/search/settings pages all call the
actual API instead of local mock arrays.

**Known gap:** no live/real-time updates (no WebSocket) - this was
originally listed as a feature but never had any implementation, and still
doesn't.

### apps/mobile (React Native/Expo)
Typechecks and passes its tests. Real auth (login/register screen +
context-based auth gate, matching the web app's flow), and all six screens
now call the real API instead of hardcoded arrays. Voice capture is fully
real end-to-end: record with `expo-av` → base64 → `POST /memory/voice` →
Whisper transcription → saved memory.

This app previously had **no `babel.config.js` and no `metro.config.js`** -
both are required for an Expo app to bundle at all in an npm-workspaces
monorepo (Metro doesn't look outside its own project's `node_modules` by
default). Without them the app could not have run on a device or simulator,
regardless of anything else being correct. Both are now in place.

**Known gap:** photo/document capture creates a text-only memory (see the
apps/api note above) rather than actually uploading and analyzing the file.
Several Settings nav items (Profile, Security, Subscription, per-service
integration screens) are still dead links with no corresponding screen -
only Logout and Delete Account are wired up.

### Infrastructure
Dockerfiles for `apps/api` and `apps/web` now build from the monorepo root
(required since both depend on sibling workspace packages - the original
Dockerfiles assumed a single-app build context and could not have built
successfully). `docker-compose.yml`/`docker-compose.dev.yml` bind-mount the
full repo root to match. CI now installs/builds from the workspace root
instead of per-app, and builds+pushes all three images (api/web/ai) instead
of just two. Terraform now includes the EKS cluster referenced by the deploy
scripts (it didn't exist before), plus fixes to duplicate output
definitions and a Redis resource that was using encryption/auth-token
arguments only valid on a different resource type - none of this was ever
run through `terraform validate` before.

**Known gap:** none of the Terraform has been applied or even validated
against the real Terraform CLI (not available in the environment these
fixes were made in) - review it before running `terraform apply` in a real
AWS account.

## How to verify any of the above yourself

```bash
# API: typecheck, full test suite, production build
cd apps/api && npx tsc --noEmit && npx jest && npx nest build

# AI: test suite (mocks the OpenAI client, needs no API key to run)
cd apps/ai && python -m pytest tests/ -v

# Web: typecheck, test suite, production build
cd apps/web && npx tsc --noEmit && npx jest && npx next build

# Mobile: typecheck, test suite
cd apps/mobile && npx tsc --noEmit && npx jest
```

All four currently pass in this repo.
