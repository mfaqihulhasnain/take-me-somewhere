# Take Me Somewhere

One click, zero itinerary. This Next.js App Router app sends people to a hand-curated, strange corner of the web.

## Run locally

Requirements: Node 20.19+ (Node 22 is also supported), a Supabase Postgres project, and npm.

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, DIRECT_URL, SESSION_HASH_SECRET, and CRON_SECRET.
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run admin:bootstrap
npm run dev
```

Open <http://localhost:3000>. `DATABASE_URL` should be the Supabase pooled connection used by the app. `DIRECT_URL` should be the direct connection used by Prisma migrations. For local-only development they may point to the same database.

## Architecture

- Next.js 16 App Router, plain JavaScript, and CSS-first UI. Server routes own database access; the interactive landing screen is a focused client component.
- Supabase is used only as managed Postgres. Prisma 7 + `prisma-client-js` handles migrations and queries; the random selector is isolated in `src/lib/random-destination.js` and uses a parameterized Postgres raw query for weighted randomness.
- The departure tab solves the popup-blocker problem: it opens same-origin first, reveals the find, notifies the original tab through `BroadcastChannel`, then navigates to the external HTTPS URL. A blocked popup falls back to the current tab.
- History and the anonymous UUID live in `sessionStorage`; favorites live in `localStorage`. Votes and reports store only an HMAC-derived session hash and are deduplicated per destination.
- Selection excludes dead, suspect, flagged, NSFW, and recently seen links. Editorial score, weirdness, vote balance, and reports influence the weighted draw.
- `/api/cron/check-links` is scheduled every six hours in `vercel.json`. It checks a bounded batch with 8-second timeouts and needs `Authorization: Bearer $CRON_SECRET`.

## Commands

```bash
npm run db:generate    # regenerate Prisma Client
npm run db:migrate     # create/apply a development migration
npm run db:deploy      # apply checked-in migrations in production
npm run db:seed        # idempotently upsert 224 curated links
npm run links:verify   # HEAD/GET check every seeded URL
npm test               # Vitest unit and Route Handler tests
npx playwright install chromium webkit
npm run test:e2e       # Playwright (requires browser install and a running app)
npm run lint
npm run build
```

The Postgres integration suite runs automatically when `TEST_DATABASE_URL` is set to a dedicated test database (never the same value as `DATABASE_URL`). Without it, those destructive-fixture tests are skipped intentionally.

The seed list is in `prisma/seed-data.cjs`. `npm run links:verify` is intentionally separate from seeding so a broken site is never silently replaced by a fabricated URL. Before a release, run the verifier and manually inspect a representative sample from every category.

## Curation and submissions

`/about` explains the project and privacy model. `/submit` accepts public HTTPS recommendations into a pending moderation queue; submitters do not receive an account, and no IP address is stored. Approved submissions become destinations with neutral editorial scores and remain subject to health and moderation filters.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env.local` for the one-time bootstrap, then run:

```bash
npm run admin:bootstrap
```

Remove `ADMIN_PASSWORD` after bootstrapping. The owner console is at `/admin`. It uses an HTTP-only, seven-day session cookie and server-side session records. The console can approve/reject submissions, flag or retire destinations, edit categories and scores, and optionally give an individual destination a small promotion nudge. The MVP picker remains deliberately random; future ranking experiments can use the reserved ranking configuration tables without changing the visitor experience today.

## API

`POST /api/destinations/random` accepts `{ recentIds, category }` and returns a safe destination payload. `POST /api/destinations/:id/click` increments clicks and returns `204`. `PUT /api/destinations/:id/vote` accepts `UP`, `DOWN`, or `CLEAR`; `POST /api/destinations/:id/report` accepts `DEAD` or `INAPPROPRIATE`. Cron health checks use `GET /api/cron/check-links` with the cron secret.

All mutation routes validate same-origin requests, IDs, JSON, and allowed values. Errors use `{ error: { code, message } }`.

## Follow-ups

The next useful additions are email notifications for submitters, a richer moderation audit log, durable rate limiting, analytics, screenshot/content safety review, paid promotion with an explicit sponsored label, and a faster random-sampling strategy if the catalog grows beyond a few thousand links.
