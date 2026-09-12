# Take Me Somewhere — Application Flow and Business Guide

Reviewed: 12 September 2026. Project: `C:\rwg\npm`.

This guide begins with the complete visitor journey, then explains the implementation, operations, limitations, and business possibilities. Future enhancements are the final section.

**How to read the evidence:** “Implemented” means present in the inspected source, not necessarily verified in a deployed environment. “Observed” means checked during this review. “Proposed” means an addition or business experiment that is not implemented. Revenue examples are assumptions for planning, not forecasts or reported earnings.

**Implementation update (12 September 2026):** After the original codebase review, the app was extended with `/about`, a public `/submit` recommendation form, a pending submission queue, owner authentication at `/admin`, destination moderation/editing, and database-backed ranking controls. The original review notes below describe the baseline where they explicitly say “at review time”; the new implementation details and setup are summarized in section 16.5.

The review covered all first-party application code, API handlers, libraries, database schema and migration, the complete seed catalog, scripts, tests, configuration, documentation, and asset references. Dependency versions were checked against the lockfile; third-party packages and generated Next.js/Prisma output were not treated as authored application code. The follow-up implementation applied the owner/submission migration and reseeded the existing Supabase database; no outreach, payments, or deployment were performed. Credentials are intentionally absent from this file.

## Contents

1. [The complete visitor journey](#1-the-complete-visitor-journey)
2. [Features and product boundaries](#2-features-and-product-boundaries)
3. [Technology and architecture](#3-technology-and-architecture)
4. [Codebase map](#4-codebase-map)
5. [Database and browser data](#5-database-and-browser-data)
6. [Public API contracts](#6-public-api-contracts)
7. [How random selection actually works](#7-how-random-selection-actually-works)
8. [Voting and reporting in detail](#8-voting-and-reporting-in-detail)
9. [Link health and catalog operations](#9-link-health-and-catalog-operations)
10. [Security, privacy, and reliability](#10-security-privacy-and-reliability)
11. [Local setup and production deployment](#11-local-setup-and-production-deployment)
12. [Verification and implementation gaps](#12-verification-and-implementation-gaps)
13. [Audience, positioning, growth, and measurement](#13-audience-positioning-growth-and-measurement)
14. [Monetization options](#14-monetization-options)
15. [How to pursue your first income now](#15-how-to-pursue-your-first-income-now)
16. [Earning potential and unit economics](#16-earning-potential-and-unit-economics)
16.5. [Post-review implementation](#165-post-review-implementation-submissions-about-and-owner-control-room)
17. [Complete seed inventory](#17-complete-seed-inventory)
18. [Future enhancements and priorities](#18-future-enhancements-and-priorities)

## 1. The complete visitor journey

### 1.1 What the application does

Take Me Somewhere helps someone discover an interesting website without deciding what to search for. The visitor presses a button, optionally chooses a category, sees a short departure reveal, and lands on an external website. They can return to the original tab to save, rate, or report the discovery and take another trip.

It is a curated discovery application. The “generator” selects from stored links; it does not generate websites, crawl the entire internet on demand, or use an AI model to invent recommendations. The value is the collection, the quality of each recommendation, and the experience of exploring it.

The normal journey is:

```text
Arrive → optionally choose a category → press the discovery button
       → new departure tab → destination reveal → external website
       → return to original tab → save / vote / report / discover again
```

### 1.2 Arriving at the home page

The visitor opens `/`. Next.js returns the page and layout, including the brand, typography, styles, headline, category controls, and initial empty ticket. React makes the controls interactive after the page loads. The initial page does not query the destination database; discovery starts when the visitor asks for it.

The screen includes:

- A “take me somewhere” wordmark and history/saved buttons with counts.
- The headline “No plans. Just somewhere.” and a short explanation.
- A large circular discovery button surrounded by animated rings.
- A live status message that changes during discovery.
- “Surprise me” plus eight category buttons.
- A paper-style “latest find” ticket, initially empty.

The visual language uses a deep ink background, paper-colored cards, coral and acid accents, grain, display typography, and small travel-themed messages. Archivo Black supplies the display type; Geist Mono supplies supporting text. There is no in-app audio playback or automatic sound code. Linked websites may have their own sound, animation, login, or payment requirements.

### 1.3 Choosing a category

“Surprise me” is selected by default. Internally it is `null`, meaning all eligible categories can participate in the draw.

| Category | Internal slug | Seed entries | Intended experience |
| --- | --- | ---: | --- |
| Weird Web | `weird-web` | 28 | Strange interactive pages, internet curiosities, playful nonsense |
| Useless Tools | `useless-tools` | 28 | Small tools, browser experiments, oddly specific utilities |
| Generators | `generators` | 28 | Names, words, colors, shapes, prompts, randomized ideas |
| Rabbit Holes | `rabbit-holes` | 28 | Archives, essays, collections, unexpected reading trails |
| Digital Art | `digital-art` | 28 | Drawing, visual experiments, museums, creative tools |
| Tiny Games | `tiny-games` | 28 | Browser games and short interactive activities |
| Science & Maps | `science-maps` | 28 | Space, geography, weather, scientific visualizations |
| Sound & Music | `sound-music` | 28 | Radio, ambient sound, music tools, musical discovery |

Selecting a category changes React state and the highlighted button. It does not immediately request a destination, change the home-page URL, or persist the choice across reloads. The next button press uses that selection. Categories are defined in code, not dynamically loaded from the database.

### 1.4 Pressing the main button: normal new-tab flow

1. The home page changes to `loading`, disables the main button, resets the local vote selection and report acknowledgement, and announces that it is finding a destination.
2. Inside the click handler, it immediately calls `window.open('/departure...', '_blank')`. A selected category is encoded into the query string. Opening the tab synchronously during the user gesture improves the chance the browser permits it; it is not an absolute popup guarantee.
3. The new tab loads `/departure`. It shows an animated loading screen while the original tab remains available.
4. The departure page reads the category from its query string and up to 50 recent IDs from its session history. A same-origin child tab opened with an opener can initially receive a copy of the opener's session storage; the two stores are not a continuously synchronized shared database.
5. It sends `POST /api/destinations/random` with `{ recentIds, category }`.
6. The server validates supported input, asks PostgreSQL to select an eligible destination, and returns its public details.
7. The departure tab shows the destination title, description, and category. It also updates its own session history, keeping at most 100 distinct destination entries.
8. It sends a `destination` message through `BroadcastChannel('take-me-somewhere')` and, when available, `window.opener.postMessage` targeted to the app's origin.
9. The original tab receives the result, displays the latest-find ticket, updates its history state, announces success, and enables the discovery button again.
10. The departure tab attempts to increment the destination's click counter using `navigator.sendBeacon`. It does not wait for the counter response.
11. After approximately 1,100 milliseconds of reveal time, it clears `window.opener` where the browser permits and calls `window.location.replace(destination.url)`.
12. The visitor is now using the external website. The original Take Me Somewhere tab remains the place to return for feedback and another discovery.

The external website is never embedded in an iframe. `replace` replaces the departure entry in the new tab's history, so Back is not intended to reopen the transient reveal screen. Network time comes before the reveal delay; this is not a guaranteed 1.1-second total load.

### 1.5 When the browser blocks the new tab

If `window.open` returns no popup reference, the home page requests a destination itself. It shows the result, attempts to save history and send the click beacon, waits approximately 950 milliseconds, and navigates the current tab using `window.location.assign`.

In this case there is no separate original tab waiting behind the destination. The visitor can use the browser's Back button to return. The short reveal gives little time to save or vote before navigation, so the fallback is less convenient than the normal two-tab journey. A pause-and-open control is a future improvement.

### 1.6 Returning, saving, and revisiting

The latest-find ticket shows the most recently received destination, its description, category, a one-to-five-symbol weirdness indicator, a favorite button, a report button, and yes/no voting controls.

Saving adds the destination object to `localStorage`. Pressing the same favorite button again removes it. Saved items survive ordinary reloads and browser restarts in that browser profile until the visitor removes them or browser storage is cleared. They do not sync across devices or accounts.

The saved and history panels display links with title, category, and description. Selecting a link opens it in another tab with `rel="noreferrer"`. These revisits bypass the departure reveal, do not request a new random destination, and do not call the click-count endpoint. There is no direct remove button on each saved-panel item, search box, export button, or collection folder.

**History fix:** the home page now reads and writes history in `sessionStorage`, so the intended 100-item history and 50-item exclusion window survive ordinary reloads within the session. The broader focus-management, closed-popup, and timeout gaps described below remain roadmap items.

### 1.7 Voting

The visitor can choose yes (`UP`) or no (`DOWN`). Clicking the currently selected direction sends `CLEAR`. The client uses an anonymous UUID stored in `sessionStorage`; the server converts it to an HMAC hash before writing a vote.

There is at most one vote row for each destination/session-hash pair. The database adjusts the aggregate counters when the vote is created, changed, or cleared. Those counters influence later random selection.

The current UI has limitations: it initially shows zero counts, does not load existing vote totals or the visitor's previous vote, retains the preceding destination's counts until a successful new vote, and changes the highlighted vote before the request succeeds without reverting it on failure. The server's vote consistency is stronger than the UI's representation of it.

### 1.8 Reporting

The report panel offers “It's gone” (`DEAD`) and “Not for here” (`INAPPROPRIATE`). A report is stored once per destination/session hash, even if the visitor later tries a different reason. A second sequential report from a different session with the same reason triggers the associated threshold: dead reports make the link suspect; inappropriate reports flag it.

The playful acknowledgement is now backed by the owner control room described in section 17.5, although there is still no email alert or support-ticket workflow. The browser now checks the report response before displaying success. Report-threshold concurrency and deeper audit-log work remain hardening items.

### 1.9 Empty results, errors, and interrupted journeys

| Situation | Current behavior |
| --- | --- |
| Eligible rows remain but recent IDs exclude all of them | Server tries once without recent exclusions and returns `repeated: true`; the UI does not display this flag. |
| No eligible row remains in the selected category | API returns `404 NO_DESTINATIONS`; the visitor is encouraged to try Surprise Me. The server does not silently switch categories. |
| Random selection fails on the server | API returns `500 DESTINATION_LOOKUP_FAILED`. |
| Departure tab gets an error | It shows an error, notifies the original tab, and attempts to close after 1,300 ms. Manually opened tabs may not be closable by script. |
| Popup-blocked fallback encounters an error | The home page enters `error`, announces a problem, and allows another attempt. |
| Visitor closes a loading departure tab | No close detection resets the opener; the main button can remain stuck loading. |
| Lookup hangs or a message never reaches the opener | No client request deadline/watchdog guarantees recovery. |
| Destination loads badly after redirect | The app cannot inspect the cross-origin page; the visitor must return and report it. |
| Storage is unavailable or full | Some reads are protected, but several writes and UUID initialization are not; a journey can fail or lose state. |

### 1.10 Accessibility and mobile behavior

Implemented foundations include real buttons and links, visible keyboard-focus outlines, labels on icon controls, a polite live status region, labeled dialogs, decorative elements hidden from assistive technology, and CSS for reduced motion. Layout sizes are fluid, category controls wrap, and a breakpoint at 600px adjusts the mobile layout.

Keyboard users can use ordinary Tab and button activation. Dedicated shortcuts, Escape-to-close behavior, moving focus into dialogs, focus trapping, background inertness, and returning focus to the launching control are not implemented. Category selection is visually highlighted without `aria-pressed` or radio-group state. Reduced-motion CSS shortens animations but does not remove the automatic timed redirects. These foundations are not evidence of a complete accessibility audit or guaranteed mobile usability.

## 2. Features and product boundaries

| Capability | Current status | Product meaning |
| --- | --- | --- |
| Anonymous one-click discovery | Implemented | No registration barrier. |
| Eight categories and Surprise Me | Implemented | Lightweight control over the next discovery. |
| Weighted rather than uniform selection | Implemented | Editorial quality, unusualness, votes, and reports affect exposure. |
| Reveal in a new tab; same-tab fallback | Implemented | A distinct departure experience with a fallback for blocked popups. |
| Recent-history exclusion and repeat fallback | Server support implemented; browser persistence defective | Repeat prevention is currently weaker than intended. |
| History panel | Implemented UI; storage defect | Not yet a reliable session travel log. |
| Favorites | Browser-local implementation | Convenient saving without a hosted account. |
| Voting/reporting | APIs implemented; UI and report-concurrency gaps | Feedback exists but needs hardening. |
| Automatic link health checks | Route and schedule configured | Requires deployed scheduling; configuration alone does not run a service. |
| Session streak or discovery counter milestone | Not implemented | History length is not a streak feature. |
| Public catalog browsing, search, tag filters | Not implemented | Tags are returned by the API but are not shown as controls. |
| Accounts and cloud sync | Not implemented | Owner-managed anonymous V1. |
| Public submissions and admin dashboard | Implemented after the baseline review | Recommendations enter a pending queue; the owner authenticates with an HTTP-only session and controls moderation and ranking. |
| Analytics, newsletter, contact/sponsor page | Not implemented | No measured acquisition or commercial funnel in this repository. |
| Payments, subscriptions, advertising, affiliate attribution | Not implemented | Discoveries do not currently generate app revenue by themselves. |

The catalog includes serious utilities and commercial homepages as well as small experimental sites. Not every entry is free, obscure, a single-purpose toy, suitable for children, or fully usable without an account. Those are product positioning choices that require more curation and metadata.

## 3. Technology and architecture

### 3.1 Stack in this checkout

| Technology | Locked version / configuration | Role |
| --- | --- | --- |
| Next.js | `16.3.5`, App Router | Pages, metadata, server rendering, API Route Handlers, builds. |
| React / React DOM | `19.2.8` | Client state and interactive UI. React Compiler is enabled. |
| JavaScript | `.js`, `.mjs`, `.cjs` | Authored implementation; this is not a TypeScript app. |
| Tailwind CSS | `4.3.3` in lockfile | Imported through PostCSS; most styling is authored CSS classes. |
| Prisma client, CLI, PostgreSQL adapter | `7.10.0`, pinned | Schema, migration, generated JS client, transactions, parameterized raw SQL. |
| `pg` | `8.23.0` | PostgreSQL connection pooling beneath the adapter. |
| Supabase | Managed PostgreSQL service | Persistent catalog, votes, reports, and counters. No Supabase JS SDK is used. |
| Node crypto | Built in | Server HMAC-SHA256 hashing. Browser crypto generates session UUIDs. |
| dotenv | `^17.4.2` declared | Loads CLI configuration from local environment files. |
| Zod | `4.6.2` in lockfile | Installed but not used; validation is handwritten. |
| Vitest | `5.0.0` | Unit and mocked Route Handler tests. |
| Playwright | `1.63.0` | Desktop Chromium and iPhone 13 browser smoke cases. |
| Vercel | Deployment target, not a package | Hosting and cron invocation when deployed on a suitable plan. |

The Prisma 7 pin is explicit in the implementation. This review does not rely on a claim about a later Prisma major's support status or API compatibility.

### 3.2 Request and responsibility boundaries

```text
Browser UI and browser storage
    → same-origin Next.js API route
    → validation and server-side logic
    → Prisma / pg connection pool
    → Supabase PostgreSQL

Departure tab → external destination website
Vercel scheduler → protected cron route → remote link checks → database updates
Owner's CLI → Prisma migration/seed or standalone seed-link verification
```

The home page and departure page are server page wrappers around client components. UI interaction lives mainly in one `Explorer` component. There is no Redux store, background queue, separate API server, Redis, or event bus service. BroadcastChannel is browser communication, not a Supabase Realtime feature.

Database access runs in Node.js routes using TCP PostgreSQL connections. This is not an Edge-runtime implementation. The random route is explicitly dynamic. A database singleton is reused through `globalThis` during development to reduce hot-reload connection churn; in production each process/function instance can have its own pool. `DATABASE_POOL_MAX=5` limits each pool, not all concurrent deployment instances combined.

Supabase Authentication, Storage, Edge Functions, and Realtime are not part of the application's current flow. The Supabase project's HTTPS API URL is not a substitute for its PostgreSQL connection URL.

## 4. Codebase map

These are relative links from this guide to the implementation.

| File or group | Responsibility |
| --- | --- |
| [src/app/layout.js](src/app/layout.js) | HTML language, fonts, global CSS, base title/description. |
| [src/app/page.js](src/app/page.js) | Home metadata and the Explorer wrapper. |
| [src/app/explorer.js](src/app/explorer.js) | Categories, launch/fallback, storage, messages, ticket, panels, favorites, feedback. |
| [src/app/about/page.js](src/app/about/page.js) | Public editorial, privacy, and product explanation. |
| [src/app/submit/submit-form.js](src/app/submit/submit-form.js) | Accessible public recommendation form and pending-review acknowledgement. |
| [src/app/admin/admin-console.js](src/app/admin/admin-console.js) | Owner login, metrics, moderation queue, destination desk, and formula editor. |
| [src/app/departure/page.js](src/app/departure/page.js) | Departure-page metadata and wrapper. |
| [src/app/departure/departure.js](src/app/departure/departure.js) | Lookup, reveal, history copy, opener messages, beacon, redirect, error close. |
| [src/app/globals.css](src/app/globals.css) | Entire visual system, responsive rules, animation and reduced motion. |
| [src/app/icon.svg](src/app/icon.svg), `src/app/favicon.ico` | Custom SVG icon plus an existing ICO asset; both remain in the tree. |
| [src/lib/constants.js](src/lib/constants.js) | Fixed category definitions and numeric limits/thresholds. |
| [src/lib/security.js](src/lib/security.js) | Origin check, session hash, JSON parser, error envelope. |
| [src/lib/prisma.js](src/lib/prisma.js) | pg pool, Prisma adapter and reusable client. |
| [src/lib/random-destination.js](src/lib/random-destination.js) | Query construction, weighted selection, recent filtering, repeat fallback. |
| [src/lib/admin-auth.js](src/lib/admin-auth.js) | Password verification, hashed owner sessions, HTTP-only cookie helpers. |
| [src/lib/validation.js](src/lib/validation.js) | Shared URL, text, tag, category, email, and numeric validation. |
| [src/lib/health.js](src/lib/health.js) | HTTP link checker and health-state transition function. |
| [Random route](src/app/api/destinations/random/route.js) | Request parsing, category/list checks, public result mapping. |
| [Click route](src/app/api/destinations/[id]/click/route.js) | Atomic click-counter increment. |
| [Vote route](src/app/api/destinations/[id]/vote/route.js) | Vote validation, hashing, serializable transaction and retry. |
| [Report route](src/app/api/destinations/[id]/report/route.js) | Deduplication, report storage, threshold-based status changes. |
| [Cron route](src/app/api/cron/check-links/route.js) | Secret authorization, oldest-first selection, bounded concurrent health checks. |
| [Admin API routes](src/app/api/admin/) | Owner session, submission review, destination editing, and ranking configuration. |
| [Submission API](src/app/api/submissions/route.js) | Public HTTPS recommendation validation and pending queue creation. |
| [prisma/schema.prisma](prisma/schema.prisma) | Models, relations, defaults, uniqueness, indexes, enum definitions. |
| [Initial migration](prisma/migrations/0001_init/migration.sql) | SQL creation of schema, tables, enums, indexes, foreign keys. |
| [Admin/submission migration](prisma/migrations/20260912001532_admin_submissions_ranking/migration.sql) | Ranking controls, owner sessions, and submission workflow tables/columns. |
| [Migration lock](prisma/migrations/migration_lock.toml) | PostgreSQL migration provider. |
| [prisma/seed-data.cjs](prisma/seed-data.cjs) | All 224 catalog entries and their descriptions, tags, scores. |
| [prisma/seed.cjs](prisma/seed.cjs) | Category and destination upserts. |
| [prisma/admin-bootstrap.cjs](prisma/admin-bootstrap.cjs) | One-time owner account creation/rotation from environment variables. |
| [prisma.config.js](prisma.config.js) | CLI environment loading, schema/migration paths, seed command, migration URL. |
| [scripts/verify-links.js](scripts/verify-links.js) | Standalone health probing of the source catalog. Does not update the DB. |
| [vercel.json](vercel.json) | Every-six-hours cron schedule. |
| [package.json](package.json), `package-lock.json` | Commands and exact dependency resolution. Package name remains `npm`, version `0.1.0`, private. |
| [next.config.mjs](next.config.mjs) | Enables React Compiler. No extra security headers or image configuration. |
| [postcss.config.mjs](postcss.config.mjs), [jsconfig.json](jsconfig.json) | Tailwind processing and `@/*` source aliases. |
| [eslint.config.mjs](eslint.config.mjs) | Next core-web-vitals rules and generated-output ignores. |
| [vitest.config.mjs](vitest.config.mjs) | Node test environment, source alias, unit/integration discovery. |
| [playwright.config.mjs](playwright.config.mjs) | Browser projects, dev server, base URL, retained failure traces. |
| [tests/integration.test.js](tests/integration.test.js) | One opt-in database fixture test. |
| [tests/e2e/home.spec.js](tests/e2e/home.spec.js) | Two browser test definitions, run in two projects. |
| `src/lib/*.test.js`, API `route.test.js` files | Unit and mocked route checks detailed in section 12. |
| [.env.example](.env.example), [.gitignore](.gitignore) | Example settings and exclusions for secrets/generated output. |
| [README.md](README.md) | Short setup and architectural introduction; less detailed than this guide. |
| [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) | Coding-agent guidance, not runtime behavior. |
| `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` | Starter graphics still present; current app components do not reference them. |

No payment routes, middleware, CI workflow, newsletter integration, legal pages, marketing collection pages, `robots` file, or sitemap generator were found in the first-party inventory.

## 5. Database and browser data

### 5.1 Relational structure

```text
Category 1 → many Destinations
Destination 1 → many DestinationVotes
Destination 1 → many DestinationReports
Anonymous session hash → records across destinations, without a User table
```

IDs are UUID-shaped strings generated through Prisma. The SQL migration stores them as PostgreSQL `TEXT`, not native UUID columns. A row inserted through raw SQL must supply required fields that Prisma would normally generate.

| Model | Fields and behavior |
| --- | --- |
| `Category` | `id`, unique `slug`, `label`, `description`, `accent`, `sortOrder`, `createdAt`, `updatedAt`; owns destination rows. |
| `Destination` identity/content | `id`, unique `url`, `title`, `description`, `tags` string array, `categoryId`. One category per destination. |
| `Destination` eligibility | `healthStatus` defaults to `HEALTHY`; `moderationStatus` defaults to `APPROVED`; `isNsfw` defaults false. |
| `Destination` engagement | `clickCount`, `upvotes`, `downvotes`, `reportCount`, all initially zero. These are aggregate totals, not event histories. |
| `Destination` ranking | `editorialScore` and `weirdness`, both default 3. Current seed scores span 3–5 and 1–5 respectively. |
| `Destination` maintenance | `consecutiveFailures`, `lastHttpStatus`, `lastFailureReason`, `lastCheckedAt`, `createdAt`, `updatedAt`. |
| `DestinationVote` | `id`, `destinationId`, `sessionHash`, `value` (`UP`/`DOWN`), timestamps. Unique destination/session pair. `CLEAR` deletes the row; it is not an enum value. |
| `DestinationReport` | `id`, `destinationId`, `sessionHash`, `reason` (`DEAD`/`INAPPROPRIATE`), `createdAt`. Unique destination/session pair, independent of reason. |

Deleting a category with destinations is restricted. Deleting a destination cascades to its votes and reports. There are indexes for category plus eligibility flags, last-check time, report count, and session-hash lookups, alongside primary/unique indexes.

The migration does not add database checks for HTTPS URLs, valid UUID format, score range, or nonnegative counters. These properties depend on application and operator behavior. It also does not configure Supabase row-level security or Data API grants.

### 5.2 What is stored in the browser

| Key/state | Intended location | Lifetime and caveats |
| --- | --- | --- |
| `tms-session-id` | `sessionStorage` | Raw anonymous UUID used for vote/report requests; not stored raw in application DB tables. |
| `tms-history` | `sessionStorage` | Intended deduplicated last 100 destination objects, newest first. Home reads wrong storage today. |
| `tms-favorites` | `localStorage` | Favorite destination objects, not just IDs. No explicit maximum. |
| Category, current ticket, loading stage, panels, displayed vote counts | React memory | Reset on remount/reload; no server account. |

History and favorite records are snapshots. If an administrator later corrects a URL/title or flags a destination, an already saved local entry does not automatically refresh or disappear. Opening a saved entry does not re-check eligibility.

The session identifier is supplied by the browser rather than issued as a signed server credential. Deduplication means “one per supplied session UUID,” not “one per human.” New sessions, cleared storage, or generated UUIDs can bypass the intended per-session limit.

## 6. Public API contracts

Normal application errors use:

```json
{ "error": { "code": "CATEGORY_INVALID", "message": "A readable explanation" } }
```

There is no public destination list endpoint, favorite endpoint, sign-in endpoint, or endpoint for loading a user's existing vote.

### 6.1 `POST /api/destinations/random`

Expected request:

```json
{ "recentIds": ["11111111-1111-4111-8111-111111111111"], "category": "tiny-games" }
```

`category: null` selects across categories. Success returns `200`:

```json
{
  "destination": {
    "id": "22222222-2222-4222-8222-222222222222",
    "url": "https://example.com/",
    "title": "Illustrative destination",
    "description": "Example response, not a promised catalog entry.",
    "category": "tiny-games",
    "tags": ["puzzle"],
    "weirdness": 3
  },
  "repeated": false
}
```

Explicit errors are `400 JSON_BODY_INVALID`, `400 RECENT_IDS_TOO_LARGE`, `400 CATEGORY_INVALID`, `404 NO_DESTINATIONS`, and `500 DESTINATION_LOOKUP_FAILED`.

Actual validation is permissive: omitted or non-array `recentIds` becomes `[]`; malformed IDs inside an array are silently discarded downstream; some non-object JSON bodies act like default input. IDs use a loose 36-character hexadecimal/hyphen expression rather than structural UUID validation. Unsupported categories are rejected by the route, but direct library callers have invalid categories normalized to Surprise Me. This route does not run the origin helper. Selection performs a read rather than a persistent mutation, but this differs from the original all-POST-origin-check contract.

### 6.2 `POST /api/destinations/:id/click`

No body is required. An atomic `updateMany` increments `clickCount`; success is `204` with no body. Unknown ID returns `404 DESTINATION_NOT_FOUND`; invalid ID returns `400 DESTINATION_INVALID`; a mismatching supplied Origin returns `403 ORIGIN_INVALID`; database failure returns `500 CLICK_FAILED`.

The route does not deduplicate visits or require a session. It can count repeated requests, and it does not prove the external page finished loading. Beacon failure is ignored, and there is no keepalive-fetch fallback when beacon is missing or refuses to queue.

### 6.3 `PUT /api/destinations/:id/vote`

Request: `{ "sessionId": "<UUID>", "value": "UP" | "DOWN" | "CLEAR" }`.

Response: `{ "upvotes": 3, "downvotes": 1, "userVote": "UP" }`, with `userVote: null` for a cleared vote.

Errors include `ORIGIN_INVALID` (403), `DESTINATION_INVALID`, `JSON_BODY_INVALID`, `VOTE_INVALID`, `SESSION_INVALID` (400), `DESTINATION_NOT_FOUND` (404), and `VOTE_FAILED` (500). A missing server hash secret is currently surfaced as `SESSION_INVALID`, which obscures a deployment configuration error as a client-input error.

### 6.4 `POST /api/destinations/:id/report`

Request: `{ "sessionId": "<UUID>", "reason": "DEAD" | "INAPPROPRIATE" }`.

A new report returns `{ "accepted": true, "reportId": "..." }`; a duplicate returns `{ "accepted": true, "duplicate": true }`. The extra fields extend the minimal planned response.

Errors include `ORIGIN_INVALID` (403), `DESTINATION_INVALID`, `JSON_BODY_INVALID`, `REPORT_INVALID`, `SESSION_INVALID` (400), `DESTINATION_NOT_FOUND` (404), and `REPORT_FAILED` (500).

### 6.5 `GET /api/cron/check-links`

Requires `Authorization: Bearer <CRON_SECRET>`. Missing or mismatching authorization returns `401 UNAUTHORIZED`. A successful run returns:

```json
{ "checked": 80, "healthy": 75, "failed": 5, "newlyDead": 2 }
```

Those numbers are illustrative. The actual batch may contain fewer rows. Unlike the other handlers, this route does not wrap database/worker failures in a top-level error handler, so unexpected failures do not necessarily use the consistent JSON error envelope. It is a protected GET that mutates health records when invoked.

## 7. How random selection actually works

The selector in [random-destination.js](src/lib/random-destination.js) first normalizes the recent IDs: remove duplicates, retain strings matching its loose ID expression, and cap at 50. It joins `Destination` to `Category` and filters to rows satisfying all of:

- `healthStatus = HEALTHY`.
- `moderationStatus = APPROVED`.
- `isNsfw = false`.
- The requested category, if any.
- An ID outside the normalized recent list.

It does **not** discard every destination with any report. A single report reduces its weight while it remains otherwise eligible. Threshold-based health/moderation changes remove it from selection. A downvote also changes weight, not eligibility.

The code's weight is:

```text
voteContribution = clamp((upvotes - downvotes) / max(5, upvotes + downvotes), -0.75, 0.75)

baseWeight = 1
           + (editorialScore - 3) × 0.22
           + (weirdness - 3) × 0.10
           + voteContribution
           - reportCount × 0.20

effectiveWeight = max(0.10, baseWeight)
priority = -ln(max(random(), 0.000001)) / effectiveWeight

Choose the eligible row with the smallest priority.
```

Higher positive weight generally increases the chance of selection, but does not guarantee it. Under the usual untruncated exponential-race interpretation, chances are proportional to weights; the implementation also clamps the random input, so that relationship is approximate at the extreme tail. The floor prevents negative or zero weights from breaking the draw.

Example: score 3, weirdness 3, no votes, no reports gives weight 1. Score 5 and weirdness 4 gives 1.54 before feedback. Ten upvotes and no downvotes adds the capped 0.75. One report subtracts 0.20. Click count does not affect ranking.

“Surprise me” is a weighted draw across all eligible destinations, not an equal draw of categories followed by a draw within one category. Even though initial category counts are equal, scores, feedback, and removals change category exposure. There is no personalized learning model; the browser supplies category and recent IDs, while ranking uses shared aggregate signals.

If the query finds nothing and the recent list was nonempty, it repeats once with an empty recent list, retaining the category and safety filters. Success then yields `repeated: true`. Otherwise no destination is returned. A one-link category can therefore keep returning that same link; a healthy service cannot guarantee novelty forever.

`Prisma.sql`, interpolated parameters, and `Prisma.join` are used instead of concatenating raw user strings into SQL. The raw query computes a weight column, but the route maps only the public response fields and does not expose that column.

At 224 entries, scanning eligible candidates is modest. A changing random priority must still be computed across candidates; normal indexes do not make this an O(1) lookup. Large catalogs should be benchmarked before introducing precomputed pools or alternative sampling.

## 8. Voting and reporting in detail

### 8.1 A vote transaction

The server hashes the session UUID with HMAC-SHA256 using `SESSION_HASH_SECRET`, then runs an interactive serializable transaction:

1. Load the existing vote for this destination/hash and the destination counters.
2. Return unchanged counts when the requested state already exists, or when clearing a nonexistent vote.
3. Calculate counter changes from old value to requested value.
4. Upsert the vote, or delete it for CLEAR.
5. Increment/decrement destination counters atomically.
6. Return the updated counts and actual vote state.

| Change | Upvote delta | Downvote delta |
| --- | ---: | ---: |
| None → UP | +1 | 0 |
| None → DOWN | 0 | +1 |
| UP → DOWN | -1 | +1 |
| DOWN → UP | +1 | -1 |
| UP → CLEAR | -1 | 0 |
| DOWN → CLEAR | 0 | -1 |
| Same vote again | 0 | 0 |

Prisma errors `P2034` and `P2002` trigger up to three total attempts. There is no backoff. Exhausting retries returns an error rather than silently claiming success. Current mocked tests do not establish behavior under real concurrent PostgreSQL writes.

Changing `SESSION_HASH_SECRET` changes the resulting identity hashes, so previous-session deduplication no longer matches new requests. Plan secret rotation with that consequence in mind.

### 8.2 A report transaction

The server checks that the destination exists, returns success without another write if the destination/session report already exists, creates a new report otherwise, counts reports of the same reason, and increments the aggregate total. At two same-reason reports it sets `SUSPECT` for dead links or `FLAGGED` for inappropriate content. A unique-constraint race for the same session is treated as a duplicate success.

Two different reporters arriving concurrently can each see only their own newly inserted reason-specific report before the other transaction commits. The transactions use default isolation without the vote route's serializable retry, so counters can increment correctly while the threshold action is missed. This is a source-derived concurrency risk, not a reproduced production incident.

Other boundaries matter:

- One DEAD report plus one INAPPROPRIATE report is not two reports of the same reason.
- A duplicate cannot change its stored reason.
- Marking a link suspect does not reset `lastCheckedAt`, enqueue a check, or otherwise expedite cron selection.
- Reports remain after a link recovers. Their aggregate penalty continues to influence weight.
- Health recovery does not clear a moderation flag.
- There is no report-resolution record, appeal workflow, audit trail for operator decisions, or deletion/retention policy implemented.

## 9. Link health and catalog operations

### 9.1 Seed workflow

[seed-data.cjs](prisma/seed-data.cjs) groups content into eight arrays. Its `site()` helper supplies default scores/tags and a fallback description. The seed command upserts categories by slug and destinations by exact URL.

On an existing destination it refreshes title, description, tags, category, scores, and sets `isNsfw: false`. It preserves engagement counters, health/check metadata, and moderation status. Consequently, reseeding can overwrite manual editorial changes and clear a manually set NSFW boolean. A changed URL creates a different row; removing a URL from the source does not delete the existing database row. Idempotence means repeated identical seeds do not add duplicate exact URLs, not that every curated database change survives reseeding.

The seed asserts at least 200 unique URL strings. It does not enforce exactly 224, exactly 28 per category, HTTPS, canonical uniqueness, or actual page content. The current file was checked during this review: 224 exact-unique HTTPS URLs, 28 per category, and 206 hostnames after lowercasing/parsing and stripping `www`. This is not a count of independent publishers or fully distinct experiences. For example, Patatap appears with and without `www`; Neal.fun has eleven entries.

### 9.2 Standalone verification

`npm run links:verify` checks the source catalog, not database rows. It runs up to ten workers, gives each URL an eight-second abort deadline, follows redirects, and begins with HEAD. For HEAD 405 or 501, it tries a GET with `Range: bytes=0-1023` using the same deadline. It treats every 2xx/3xx response plus 401/403/405/429 as reachable, prints failed URLs and totals, and exits nonzero if anything fails.

A successful status is only a reachability signal. It does not establish that a game is playable, a title is correct, a page is free, a redirect is appropriate, or content is safe. Servers can ignore Range; the script does not enforce a strict download-byte cap, store a report artifact, or preserve final redirect URLs for review.

### 9.3 Scheduled checks

The cron route takes the 80 least-recently-tested database destinations, checking null timestamps first. It uses eight concurrent workers. Each worker calls the health helper and writes the new state, failure count, final HTTP status/reason, and check time.

Health states behave as follows:

| Result | New health status | Failure counter |
| --- | --- | --- |
| Accepted HTTP response | `HEALTHY`, including recovery from SUSPECT/DEAD | Reset to 0 |
| First failed check | `SUSPECT` | 1 |
| Second consecutive failed check | `SUSPECT` | 2 |
| Third or later consecutive failed check | `DEAD` | 3 or more |

The helper accepts a specific set: 200, 201, 202, 203, 204, 206, 300, 301, 302, 303, 307, 308, 401, 403, 405, and 429. Other statuses, including unlisted successful codes and server errors, count as failures. This differs from the standalone verifier's broad 2xx/3xx rule. For 405/501, the GET fallback's result determines health; an accepted HEAD 405 can therefore still end in a failure if GET fails.

The configured cron expression is `0 */6 * * *`: nominally 00:00, 06:00, 12:00, and 18:00 UTC. This is 05:00, 11:00, 17:00, and 23:00 in Pakistan. Eighty checks four times daily equals at most 320 checked rows per day, not four complete daily checks of the whole 224-entry catalog. Ideal average spacing is around 16.8 hours per destination; actual spacing depends on batches and service execution.

Two implementation limits need attention: ten waves of eight-second timeouts can take about 80 seconds before DB overhead, exceeding the route's 60-second duration setting; and concurrent cron invocations have no lock or lease to prevent overlapping work. Partial DB updates can remain if a run fails midway.

### 9.4 Catalog quality observations

The complete inventory appears in section 17, preserving current entries rather than silently correcting them. A targeted content check found these concrete mismatches:

| Current seed claim | Evidence checked | Consequence |
| --- | --- | --- |
| “Hollow Knight Silksong Doodle” at `www.doodle.com` | Doodle documents meeting scheduling and group polls. [Doodle product page](https://doodle.com/en/scheduling-tool/) | The game title/description is inaccurate for the linked service. |
| “Matisse” as a digital collage playground | The current homepage identifies Matisse Enzer and links consulting, writing, and technical resources. [Matisse homepage](https://www.matisse.net/) | Re-review the entry; the described creative tool is not supported by the homepage. |
| “How Many Plants” as a plant-counting quiz | The homepage primarily presents houseplant care and growing guides. [How Many Plants](https://howmanyplants.com/) | Update description/category after a direct content review. |
| “Radio King” as a listening dial of stations | The destination markets creating and hosting internet radio stations. [RadioKing](https://www.radioking.com/) | Distinguish a commercial creator tool from an immediately playable radio experience. |

These observations are not a fresh manual review of all 224 sites or the previously planned 56-site sample. The current catalog also includes strobe/annoyance-themed sites and open-ended generators; there is no seizure/flash warning, audio-intensity flag, or verified family-safe mode. No automatic content classifier exists. Treat the seed as a collection requiring editorial verification, not a safety certificate.

## 10. Security, privacy, and reliability

### 10.1 Existing protections

Database queries are server-side, SQL values are parameterized, votes/reports store HMAC-derived session hashes, and unique constraints deduplicate feedback. Votes use serializable transactions. Mutating click/vote/report routes check a supplied Origin against the request URL's origin. Cron needs a secret bearer token. Destination redirects normally clear the opener; saved/history links use `noreferrer`. React renders titles/descriptions as text rather than injecting HTML.

`.env*` files are ignored by Git except `.env.example`. None of the configured secrets use a `NEXT_PUBLIC_` prefix. The server sends only selected destination fields to the browser rather than exposing database credentials or feedback identity hashes.

### 10.2 What these protections do not establish

| Area | Current limitation | Why it matters |
| --- | --- | --- |
| Request validation | Loose ID regex; random request shape and ID elements are normalized rather than strictly rejected; no explicit byte-size limit | The original strict-input contract is not fully implemented. |
| Origin checking | Absent Origin is accepted; random route does not check it | This is not authentication or a defense against scripted callers. |
| Abuse control | No durable rate limit, signed session token, or challenge escalation | Attackers can inflate clicks, manufacture sessions, or abuse report thresholds. |
| Secret handling | Missing session secret becomes a 400 client error | Operational failures can be misdiagnosed. |
| Server-only boundaries | Database modules are used server-side but lack an explicit `server-only` import guard | Future accidental client imports are not proactively guarded by this pattern. |
| Supabase exposure | Migration defines no RLS policies or Data API access restrictions | Verify actual grants, exposed schemas, and roles in Supabase; database connection secrecy alone does not establish Data API isolation. Current hosted configuration was not audited. |
| URLs | Seed is HTTPS, but no DB check or runtime URL allowlist enforces it | An incorrect operator/import entry can become a redirect target. |
| Remote probes | Redirects are followed without validating every hop/final network destination | Before allowing submissions, protect the server-side checker against private-network and redirect-based requests. |
| Browser messages | One shared channel name, no launch/request ID, no opener/source association beyond Origin on postMessage | Multiple open app tabs can receive each other's results; both messaging mechanisms can deliver the same discovery twice. |
| Async UI | Requests and delayed redirects are not cancelled; old vote responses can arrive after a new discovery | The ticket can display a response belonging to an earlier destination. |
| Logging | Several routes log caught errors; no redaction/retention layer is defined | Inspect deployment logs and avoid logging full URLs containing credentials. |
| Data lifecycle | No automatic report/vote expiration, browser-export workflow, or account-based deletion mechanism | Define retention before promising specific privacy properties. |

No raw IP-address column or raw-session column exists in the application models. That does not mean hosting providers, database infrastructure, payment providers, or external websites never process IP addresses. External destinations receive a normal browser visit and apply their own tracking and terms. Favorites currently stay in the browser, but adding analytics around favorite actions would change that boundary and should be described clearly.

### 10.3 PostgreSQL TLS configuration

The earlier connection setup used the compatibility option `sslmode=require&uselibpqcompat=true` to get past a certificate-chain failure. In the installed `pg-connection-string` parser, that combination without a root certificate sets `rejectUnauthorized=false`: traffic is encrypted, but the server certificate is not authenticated. It is not simply a harmless required compatibility switch.

For production, configure the appropriate trusted CA and certificate/hostname verification, then test it from the actual deployment environment. Supabase documents `verify-full` with its database certificate. Do not replace the URL blindly if the certificate is unavailable or the deployment cannot read the configured certificate path. [Supabase SSL guidance](https://supabase.com/docs/guides/platform/ssl-enforcement)

The database password shared during setup should be rotated before public launch. Update both runtime and migration connection secrets afterward. This guide deliberately does not reproduce the password, generated secrets, or project-specific connection strings.

### 10.4 Product claims to avoid today

Do not describe the current app as “fully anonymous everywhere,” “100% safe,” “guaranteed never repeats,” “all links are free,” “no algorithm,” or “fully accessible.” The more accurate claim is: an account-free curated discovery tool with local favorites, browser-session feedback identities, weighted selection, and link-health checks. The footer's “no algorithmic itinerary” is playful copy; technically there is an algorithm deciding selection weight.

## 11. Local setup and production deployment

### 11.1 Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Runtime Prisma/pg client | PostgreSQL runtime connection, normally the transaction pooler for serverless use. |
| `DIRECT_URL` | Prisma CLI and seed | Migration/seed connection. A compatible session-pooler connection can be used when direct IPv6 connectivity is unavailable. |
| `SESSION_HASH_SECRET` | Vote and report routes | HMAC hashing secret; must be long, random, and stable across production instances. |
| `CRON_SECRET` | Cron handler and scheduler | Authenticates scheduled maintenance calls. |
| `DATABASE_POOL_MAX` | Runtime pg pool | Optional per-instance pool size; defaults to 5. |
| `ADMIN_EMAIL` | One-time bootstrap | Owner email used by `npm run admin:bootstrap`; do not expose to the client. |
| `ADMIN_PASSWORD` | One-time bootstrap | Owner password used to create/rotate the scrypt hash; remove after bootstrapping. |
| `TEST_DATABASE_URL` | Integration test only | Dedicated disposable/test database, never the production dataset. Not currently listed in `.env.example`. |

Next.js loads `.env.local` for its runtime. `prisma.config.js` explicitly loads `.env.local`, then `.env`; existing process-level variables take precedence because neither dotenv call uses override. The seed receives the environment through `prisma db seed`; running `node prisma/seed.cjs` directly does not itself load dotenv.

Copy connection details from Supabase's Connect panel. Runtime transaction pooling and migration connections have different intended use cases; copied pooler hostnames and usernames should not be guessed from the project name. Direct endpoints may require IPv6; session pooling is the documented IPv4 alternative. [Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres)

### 11.2 Local development

From PowerShell:

```powershell
cd C:\rwg\npm
npm ci
npm run db:generate
npm run dev
```

Use `Copy-Item .env.example .env.local` only for a new checkout with no configured local file. Repeating it on this configured project overwrites working credentials. Open `http://localhost:3000` after the server starts.

For a newly provisioned development database, populate environment values first, then use `npm run db:migrate` and `npm run db:seed`. For existing production databases, apply checked-in migrations with `npm run db:deploy`, not `migrate dev`. Reseeding is an explicit editorial update with the behavior described in section 9.

### 11.3 What each command does

| Command | Effect |
| --- | --- |
| `npm ci` | Install dependency versions from the lockfile; requires a consistent lockfile. |
| `npm run dev` | Start the development server. Does not run cron automatically. |
| `npm run build` | Produce the Next.js production build. Does not prove database access works. |
| `npm start` | Serve a previously built production application. |
| `npm run lint` | Run ESLint across the configured project. |
| `npm test` | Run Vitest, including the DB integration suite only when enabled. |
| `npx vitest run src` | Run only source unit/route tests, excluding the database test file. |
| `npm run test:watch` | Interactive Vitest watching. |
| `npm run test:e2e` | Run the configured Playwright cases, normally using its dev server. |
| `npm run db:generate` | Generate Prisma Client from the schema. |
| `npm run db:migrate` | Prisma development migrations with shadow-database behavior. |
| `npm run db:deploy` | Apply committed migrations to the configured database. |
| `npm run db:seed` | Upsert catalog content; writes to the configured database. |
| `npm run links:verify` | Probe every seed URL; does not update DB health fields. |

The runtime's fallback localhost connection string exists to keep module evaluation build-safe when configuration is absent. It is not a working offline catalog. A build can succeed while random API requests fail because the real database is missing or unreachable.

### 11.4 Deployment flow

1. Resolve the launch-critical defects in section 12 and verify the catalog.
2. Commit the application code, lockfile, schema, migration, and seed. Keep secret files excluded.
3. Connect the repository to a host that permits the intended commercial use. Set the project root to the folder containing this `package.json`; if the Git repository starts at `C:\rwg`, the app subdirectory is `npm`.
4. Configure Production and Preview environment variables separately. Preview testing should not write votes, reports, seed data, or migrations to production.
5. Explicitly run Prisma generation before the build. A suitable build command is `npm run db:generate && npm run build`; the current `build` script itself contains only `next build`, with no explicit prebuild/postinstall generation script in this package.
6. Apply production migrations as a deliberate release step using `db:deploy`. Seed intentionally after confirming the target, rather than seeding on every automatic build.
7. Deploy, then test a real random lookup, both navigation paths, saved/history behavior, feedback, and graceful errors on the deployed origin.
8. Configure and inspect the scheduler. Confirm the secret reaches it and inspect successful check counts and check timestamps. A configured cron route on a laptop is not an active production scheduler.
9. Add the domain, monitoring, budget alerts, backup/restore procedure, and owner contact/policy pages needed for launch.

**Vercel plan constraint:** Hobby is for personal, noncommercial use. It also permits cron at most once daily; this repository's every-six-hours cron is incompatible and would fail Hobby deployment under the published limits. Monetizing the app on Vercel therefore calls for an appropriate commercial plan, or a different host whose terms and scheduler support the workload. [Vercel Hobby](https://vercel.com/docs/plans/hobby), [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

### 11.5 Owner's routine

Daily or per maintenance window, inspect discovery errors, cron failures, suspect/dead links, new inappropriate reports, and database usage. Weekly, spot-check destinations on desktop/mobile, correct descriptions and category fit, add genuinely useful replacements, and review returning usage. Before releases, run meaningful tests and a fresh verifier pass. Keep a content-review log including original URL, final URL, review date, and the actual experience tested.

There is currently no interface that automates those owner tasks. Supabase Table Editor or deliberate SQL can inspect/update records, but changes need care because reseeding can overwrite editorial fields. Take backups before material data changes and verify a restore procedure; source control of the seed is not a backup of votes, reports, or operational state.

## 12. Verification and implementation gaps

### 12.1 Existing test inventory

| Test file | Cases | What it actually checks |
| --- | ---: | --- |
| `src/lib/health.test.js` | 3 | Mocked 403 reachable; HEAD 405 to GET fallback; pure suspect/dead/recovery state calculations. |
| `src/lib/random-destination.test.js` | 2 | Mocked all-seen fallback and empty result without retry. |
| `src/app/api/destinations/random/route.test.js` | 3 | Oversized history, successful response mapping, empty-category 404. |
| `src/app/api/destinations/[id]/click/route.test.js` | 1 | Mocked atomic increment call and 204. |
| `src/app/api/destinations/[id]/vote/route.test.js` | 2 | Invalid vote value and mocked creation of an upvote. |
| `src/app/api/destinations/[id]/report/route.test.js` | 2 | Invalid reason and already-existing duplicate report. |
| `src/app/api/cron/check-links/route.test.js` | 2 | Missing secret and one mocked healthy destination. |
| `tests/integration.test.js` | 1 opt-in | Real DB fixture selection with dead/NSFW exclusion and repeat fallback. |
| `tests/e2e/home.spec.js` | 2 definitions × 2 browser projects | Visible landing/category control and popup reveal using a mocked random API. |

The health test mentioning “example.invalid-style” failures never actually requests `example.invalid`; it feeds `healthy: false` into the state function. Tests do not cover actual timeout/network behavior, weighting probabilities, structural validation, HMAC behavior, storage reducers, real concurrent voting, report threshold races, or a complete production browser flow.

The integration fixture uses category slug `integration-fixture`, which the selector normalizes to no category because it is not in the fixed allowed set. It can appear to work in a clean isolated database but select unrelated rows in a populated test database. Comparing test/runtime URL strings for inequality also cannot establish that two different URLs refer to different physical databases. Integration testing needs a properly isolated database and repaired fixture design.

Playwright uses `npm run dev`, not a production build, and mocks selection. Its click beacon is not mocked, so test isolation should be tightened as well. Its popup assertion checks the reveal title, not completion of external navigation, safe opener clearing, parent history, or popup-blocked fallback. Mobile coverage is iPhone 13; there is no configured 320×568, tablet, or reduced-motion test project.

### 12.2 Evidence gathered for this guide

- All authored source/config/test files and all 224 seed definitions were read.
- A static catalog check verified totals, exact-URL uniqueness, HTTPS schemes, score ranges, and normalized hostname counts.
- The history defect was reproduced with the actual extracted storage helper functions and isolated in-memory browser-storage substitutes: after saving first and second items, only the second remained in session storage, while reading history returned `[]`.
- `npx vitest run src` completed successfully during this review: **7 files and 15 tests passed**. It excluded the database integration file.
- Selected catalog claims and current hosting/payment/ad constraints were checked against primary websites linked in this guide.
- No production database integration, migration, reseed, full 224-link reachability sweep, full 56-site manual inspection, or production browser acceptance run was performed for this documentation review. Earlier setup success in the conversation is not substituted for current full acceptance evidence.

### 12.3 Release-critical gaps

| Priority | Gap | User/business consequence |
| --- | --- | --- |
| P0 | History storage mismatch | Broken travel history and weak repeat avoidance undermine the central discovery experience. |
| P0 | Incorrect catalog descriptions/targets and incomplete safety review | A polished interface can still deliver misleading or unsuitable recommendations. |
| P0 | Vercel plan/cron mismatch and cron timeout budget | Deployment or scheduled maintenance can fail. |
| P0 | Supabase access/grants and authenticated TLS need verification | Production data protections are not established by the code alone. |
| P1 | Report UI treats HTTP failures as success | Visitor feedback can be lost while the UI claims otherwise. |
| P1 | Report thresholds can race | Inappropriate links may not be flagged at the promised threshold. |
| P1 | Vote totals/selection are stale or optimistic without reconciliation | Feedback appears inaccurate or misleading. |
| P1 | No request/closed-popup watchdog, cancellation, or correlation IDs | Tabs can stall, cross-update, or show the wrong request result. |
| P1 | No durable rate limits or strong session issuance | Counts and moderation are easy to manipulate. |
| P1 | Dialog focus/keyboard handling and narrow/mobile coverage incomplete | Some visitors cannot reliably complete the flow. |
| P1 | Tests are narrower than the original acceptance plan | Existing green tests are insufficient evidence of launch readiness. |
| P2 | Missing analytics, contact/policy/editorial pages, sponsor/payment features | No reliable commercial funnel or sponsor reporting. |
| P2 | Duplicated category definitions and inconsistent checker rules | Editorial and maintenance behavior can drift. |

The table above retains baseline findings that still need hardening. The post-review implementation update in section 17.5 records the application changes delivered after this document was first written.

## 13. Audience, positioning, growth, and measurement

### 13.1 Who may use it, and why they might return

Potential audiences include people looking for a short break, designers seeking inspiration, developers who enjoy browser experiments, curious readers, and people sharing unusual discoveries with friends. These are audience hypotheses; no analytics or user research in the repository proves their size or preferences.

The strongest repeat-use promise is consistent discovery quality: “I can find something delightful quickly.” The interface is recognizable and easy to explain, but a random button is easy to copy. A stronger long-term advantage would be a verified catalog, trustworthy descriptions, genuinely useful collections, relationships with creators, and visitors who return intentionally.

For an initial audience, a narrower editorial campaign such as “five-minute creative breaks for designers and developers” may be easier to market and sponsor than “every interesting website for everyone.” This need not remove the broad category picker; it focuses acquisition and content creation. Test the positioning before rebuilding the product around it.

### 13.2 Acquisition and return loops

Proposed first loop: publish an original short demonstration of a good discovery, credit the creator, link to the app, and invite viewers to try another. A visitor finds something useful, saves it, then returns for another discovery. Repairing history and feedback is part of growth because disappointment at the second visit erodes acquisition value.

Proposed second loop: create substantive collections such as “browser tools for making generative art” or “interactive maps for a ten-minute exploration.” Each entry should include an original explanation, accurate access requirements, and a direct visit link. These pages can provide searchable content and contextual affiliate/sponsor opportunities. Merely duplicating 224 short seed descriptions into near-identical pages would add little value.

Proposed third loop: an opt-in weekly “five worthwhile internet detours” email with a clear unsubscribe path. No email capture or email sender currently exists. Build it only if you can sustain useful editorial output and have evidence visitors want it.

Distribution can begin through your own portfolio/social profiles, relevant creator relationships, and communities that allow project sharing. Respect each community's current rules. Avoid purchased junk traffic: it makes retention, ad performance, and sponsor value harder to evaluate.

### 13.3 What must be measured

| Question | Proposed measurement | Current availability |
| --- | --- | --- |
| How many people arrive? | Landing sessions and acquisition source | Not instrumented. |
| Do they use the product? | Sessions with a successful discovery / landing sessions | Not instrumented as a funnel. |
| Does the service work? | Selection success rate; p50/p95 lookup time; no-result rate | Can be added to server logs/metrics. |
| Do they come back for more? | Second-discovery rate, discoveries/session, properly defined return cohorts | Not established by `clickCount`. |
| Are finds useful? | Save-action rate and vote distribution | Votes exist; save actions remain browser-local. |
| Is the catalog healthy? | Eligible rows by category, time since check, report volume | Data fields exist; no dashboard. |
| Do sponsors receive value? | Visible sponsor impressions, voluntary outbound clicks, partner-attributed outcomes | Not implemented. |
| Does monetization work? | Net receipts, refund rate, conversion, churn, contribution margin | No payment instrumentation. |

Choose data collection deliberately. A persistent returning-user metric cannot be derived reliably from a session-only UUID without changing the measurement design. Count successful API selections as selections, beacons as attempted departures, and partner-attributed purchases as purchases. Do not report beacons as verified page views, unique humans, or conversions. Multiple discovery clicks while the home page remains open are not necessarily multiple monetizable page views.

The app cannot see what visitors do inside unrelated external sites. Conversion attribution requires a legitimate affiliate/partner system or an explicit reporting arrangement. You cannot calculate external-site engagement or purchases from browser focus changes alone.

## 14. Monetization options

### 14.1 What can earn money today

The repository contains no payment collection, ad integration, sponsor placement, affiliate agreements, or paid entitlement logic. Traffic and existing earnings were not supplied or measured. The defensible starting assumption is **no established direct revenue from the application**.

Two separate businesses are possible:

- **The discovery product:** earn from a useful audience through disclosed sponsorships, appropriate affiliate recommendations, original products, or eventual subscriptions/ads.
- **Your development work:** use the application as a demo to win paid work creating discovery tools, directories, or interactive websites for clients. This can produce income before the app has a large audience, but it is active service income rather than passive app revenue.

My practical recommendation is to pursue a narrowly scoped client offer while repairing the app and building an audience. Then test a small direct sponsor placement or an original digital product. Advertising is a later experiment, not the assumption that makes the project viable.

### 14.2 Compare the models

| Model | What someone pays for | Suitable stage | Missing implementation or prerequisite |
| --- | --- | --- | --- |
| Client customization | A branded discovery/resource tool built for their needs | Can be pursued now using an honest demo | Offer, prospecting, scope, contract/invoice, client delivery |
| Direct sponsorship | Clearly labeled exposure to a relevant audience | After launch and some credible audience evidence | Sponsor space, terms, expiry, reporting, eligible invoicing |
| Affiliate referrals | A qualifying purchase or action under a partner agreement | When useful commercial recommendations fit the audience | Program approval, disclosed links, attribution and payout support |
| Voluntary support | Appreciation for ongoing curation | When visitors value the product | Supported payment route, visible optional support link |
| Original digital product | Your guide, exercises, templates, or software | After a specific buyer need is validated | Product, license, checkout, delivery, support/refunds |
| Display advertising | Policy-compliant ad impressions on substantive pages | After suitable content, approval, and meaningful traffic | Editorial pages, ad approval, measurement, policy/consent handling |
| Premium membership | Continuing useful features/content | After retention and willingness to pay are demonstrated | Authentication, billing, entitlements, sync, lifecycle/support |
| Newsletter sponsorship | Reach to an opted-in, engaged email audience | After building and serving a list | Signup, email system, regular publication, metrics, sponsor process |
| B2B licensing/API | Maintained discovery capability/data service | Later, with customers who need it | Auth keys, quotas, SLAs, versioning, licensing, support |
| Selling the business | Transferable code, brand, catalog process, audience, profit | Later, when these assets have evidence | Clean ownership, accounts/asset transfer plan, financial records |

### 14.3 Direct sponsorship: the simplest product-side pilot

A proposed placement could read “This week's departure lounge is supported by [Sponsor]” with a short, accurate description and a voluntary link. It should sit separately from the main random-discovery button and organic latest-find ticket. Sponsorship should not silently raise an editorial score or insert an undisclosed ad into the random result.

A small manually sold package can define a fixed placement, start/end dates, category relevance, and a short performance report. Initially you can keep booking and invoicing manual. Do not build a sponsor marketplace before selling a first suitable placement.

Potential prospects include independent creative tools, small browser-game publishers, educational products, or design resources that match the audience you actually attract. Existing catalog inclusion does not imply the owner wants to sponsor the app, approves your description, or has an affiliate program.

**Illustrative experiment, not a market rate:** offer a clearly defined 14-day founding placement at $25–$75 only if both sides understand the current audience size and what is being delivered. With no traffic, sell an agreed creative deliverable or discuss a future pilot rather than implying valuable audience reach. Track views while the placement is actually visible and voluntary clicks, not background-tab activity or random departures.

Advertisers care about their outcomes. If a hypothetical $50 campaign produces 20 relevant voluntary clicks, its observed cost per click is $2.50. Whether that is worthwhile depends on the sponsor's margins and conversions. A nice interface alone cannot justify any particular price.

### 14.4 Affiliate recommendations

Affiliates pay under the merchant's rules, usually after a qualifying purchase, signup, or other verified event. Simply sending someone to Photopea, Coolors, a game, or any ordinary external URL earns nothing without an actual agreement and valid attribution.

A strong fit would be an original collection explaining which creative tools suit different tasks, with affiliate disclosure placed beside any compensated recommendation. Keep non-affiliate choices where they serve visitors better. Affiliate consent, payout availability, allowed promotion methods, returns, and attribution windows must be checked for each specific program.

Proposed technical additions are a separate affiliate-link record, partner/program identifier, campaign link, disclosure text, and distinct voluntary click measurement. Do not replace every catalog URL or trigger an affiliate URL in an invisible request. Automatic random redirects may not be an allowed promotional method for a program; get confirmation before using that flow for affiliate traffic.

### 14.5 Voluntary support and original products

A modest optional “support the curator” link can help loyal visitors contribute. It is unlikely to pay much without existing goodwill. It should not block departure, manipulate the vote buttons, or imply that payments guarantee favorable placement. A one-time tip is not recurring subscription revenue.

An original product can offer clearer value: a researched creative-break workbook, practical exercises built around verified tools, a documented discovery-app template, or a carefully explained niche resource kit. Charge for your work and permitted assets, not ownership of other people's websites, music, illustrations, or software. A raw dump of public links has limited differentiation.

**Illustrative prices to test:** $9 for a substantive small guide, or $29–$79 for an adequately documented original template. These are proposed experiments, not verified comparable prices. A template needs setup documentation, clear support boundaries, license review, removal of secrets/brand claims, and working tests. The current repository is not a finished sale-ready template package.

### 14.6 Display ads: feasible only in the right product surfaces

Google's eligibility guidance requires original, high-quality content and policy compliance. A database of external links does not itself establish approval. There is no evidence this app has an approved AdSense account or approved site. [AdSense eligibility](https://support.google.com/adsense/answer/9724?hl=en)

Google's publisher rules exclude ads on screens used for navigation, without meaningful publisher content, or running in the background with the user's attention elsewhere. **Do not put Google ads on the timed `/departure` reveal or build revenue around refreshing ads in the abandoned original tab.** This is an application of the published policies to this app's design, not a formal policy decision from Google. A user-requested destination tab is not automatically the same thing as an unsolicited popunder, but that distinction does not make its reveal screen suitable ad inventory. [Google Publisher Policies](https://support.google.com/publisherpolicies/answer/10502938?hl=en)

A better future ad surface is a useful collection, original review, or interactive guide where a visitor actually stays to read or use your content. Keep ads clearly separate from navigation, avoid accidental-click layouts, and follow the network's geographic consent requirements. Never ask people to click ads to support you, buy invalid traffic, or manufacture impressions. Approval and continued eligibility remain the network's decision. [AdSense program policies](https://support.google.com/adsense/answer/48182?hl=en)

### 14.7 Premium features and recurring revenue

Possible premium value includes synced collections, annotated favorites, private curated packs, collaborative inspiration boards, or team-oriented discovery collections. “Pay to press the random button” is a weak initial offer when many destinations and alternatives are free.

A real premium flow would require: an identifiable account or secure entitlement mechanism → hosted checkout → verified payment webhook → stored entitlement → premium feature access → cancellation/refund/expiry handling. The current browser-local favorites and session UUID do not identify a paying customer across devices. Never unlock paid access solely because a browser reached a success URL.

Before implementing billing, interview repeat visitors and test whether they want a specific paid outcome. Ongoing curation, support, failed payments, churn, and refunds become operating work. Higher revenue does not automatically mean less effort.

### 14.8 Payments if you operate from Pakistan

Country support and business-model support are separate checks. Having buyers in a country is not the same as being eligible to open a merchant account there.

| Route | What current official information supports | Practical implication |
| --- | --- | --- |
| Stripe directly | Pakistan is not on the published supported merchant-country list. [Stripe availability](https://stripe.com/global) | Do not assume a Pakistan-based individual can simply open a local Stripe merchant account. Use accurate residency/business information. |
| Lemon Squeezy | Pakistan is listed for bank payouts. [Supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries) | Potential option for an approved original digital product or SaaS, subject to onboarding and product review. |
| Lemon Squeezy business restrictions | Services, advertising placements, and pure donations without a real product are prohibited. [Prohibited products](https://docs.lemonsqueezy.com/help/getting-started/prohibited-products) | Do not use it to invoice client web development, a sponsor slot, or ordinary tips. |
| Business invoicing / bank transfer | Suitable options depend on your bank and verified business account. Payoneer Request a Payment describes business-client payments, not consumer-store checkout. [Payoneer guidance](https://payoneer.custhelp.com/app/answers/detail/a_id/12280/kw/request) | For client services, check the account's actual eligibility and payout costs before agreeing payment terms; do not treat a B2B payment-request feature as a public donation checkout. |
| AdSense | Pakistan is listed as available. [Country availability](https://support.google.com/adsense/answer/13402307?hl=en) | Country eligibility does not guarantee site approval. Configure payout and verification using the options in your own account. |

Keep invoices, receipts, provider statements, refunds, and expense records. Settlement delays, conversion charges, processing fees, and your tax obligations affect spendable income. A merchant of record handling sales tax does not mean all of your own business/income-tax obligations disappear. This guide does not assign you a legal entity type or a Pakistan tax rate.

For USD-denominated AdSense payment accounts, Google's published payment threshold is $100; smaller accrued amounts are not necessarily cash you can withdraw immediately. [AdSense payment thresholds](https://support.google.com/adsense/answer/1709871?hl=en)

## 15. How to pursue your first income now

### 15.1 The most practical immediate offer

Use this as a proof of your ability to build an interactive, database-backed product. Sell a **small, fixed-scope custom discovery/resource site** to a buyer with a concrete collection and audience: a creator's resource library, a club's activity picker, a workshop's inspiration tool, or a small business's curated customer resources.

Example offer to test: “I can build a branded resource discovery website with category selection, an approved link catalog, mobile layout, and deployment documentation.” Define the exact number of pages, catalog entries, revisions, delivery milestones, hosting responsibility, and post-delivery support. Do not promise accounts, payments, submissions, moderation dashboards, or analytics unless priced and implemented.

**Illustrative starting proposal:** $300–$800 for a deliberately small customization, adjusted to the real effort and your market. This is not a market-rate claim or guaranteed client outcome. At $300 for 30 hours, gross effective pay is $10/hour before selling time, fees, and tax; at 60 hours it is $5/hour. A narrow deliverable matters more than an attractive headline price.

The buyer is paying for a delivered business tool and your work, not this app's traffic. This route can therefore be pursued before ad revenue is realistic. Build and repair what you actually promise; do not hand off known defects as completed production work.

### 15.2 A concrete first two weeks

The following is a proposed sequence, not a deadline guarantee. Take longer where testing or buyer feedback requires it.

| Period | Action | Concrete output |
| --- | --- | --- |
| Days 1–3 | Repair core history/feedback failures, re-review questionable entries, verify production connection/security/scheduler setup | A demo that can complete several discoveries without losing state or making false acknowledgements. |
| Days 3–5 | Record a short walkthrough and publish an honest case study with limitations removed or disclosed | A shareable demo link/video and a clear explanation of what you built. |
| Days 4–6 | Write one fixed-scope service offer and choose an eligible payment/invoicing method | A one-page proposal with deliverables, price, milestones, revision limit, support period. |
| Days 6–10 | Identify 10–20 relevant prospects and contact a few individually through appropriate channels | A prospect list, personalized examples, and a record of replies. No mass-spam assumption. |
| Days 8–14 | Discuss actual needs with interested prospects; offer a small paid pilot when appropriate | One concrete proposal or paid milestone agreement, rather than speculative extra features. |
| In parallel | Invite a small group to use the discovery app and observe return behavior | Evidence of recurring usefulness and which categories deserve curation effort. |

No outreach was sent during this review. The following is a draft you can adapt; fill placeholders only with facts:

> Hi [name], I built Take Me Somewhere, a small website that helps people explore a curated collection through one click and categories. I noticed your [real resource collection or audience need]. A branded version could help your visitors discover [specific useful outcome]. Here is a short demo: [link]. I can scope a small version around your existing resources, with a fixed price and clear handoff. If relevant, I can send a one-page proposal.

If someone is interested, confirm what they need before changing the code. A paid discovery/design milestone can be more appropriate than promising the entire implementation immediately. Payment and contract terms should match the provider and buyer; never request payment for an unagreed service.

### 15.3 First income specifically from this app

If you want product revenue rather than client work, the shortest reasonable experiment is:

1. Make the product dependable and publicly accessible on suitable hosting.
2. Add owner/about/contact information and a clearly defined sponsor opportunity.
3. Measure real relevant usage over a stated period. Say “newly launched, no established audience yet” when that is true.
4. Approach a small number of relevant creators with a transparent pilot, actual numbers, and a voluntary placement design.
5. Agree deliverables and dates, invoice using an eligible method, deliver the placement, and report the actual results.
6. Seek a repeat booking only if it is useful for the sponsor and does not damage visitor trust.

An original small digital product can be tested alongside this if you already know its buyer and can deliver it. A tip link is optional support. Neither should be modeled as guaranteed income on launch day.

For the first 30 days, prioritize one credible signal: a paying client, a delivered sponsor pilot, a few actual product buyers, or repeat users who request a specific paid feature. Over the following 60–90 days, improve the path supported by that evidence. More code is not always the next bottleneck; it may be curation, distribution, or the offer itself.

### 15.4 What not to spend time or money on first

Avoid adding multiple ad networks before there is suitable content, constructing a full subscription platform before anyone wants paid features, buying traffic without unit economics, or expanding the catalog just to advertise a larger count. Do not sell guaranteed visitors or sales from unverified counters, and do not sell the linked creators' assets as your own.

A new domain or premium hosting plan can enable a launch, but neither creates demand. Control recurring costs while testing whether people return and whether anyone will pay for a clearly defined benefit.

## 16. Earning potential and unit economics

### 16.1 Revenue is not profit

```text
Gross revenue = ads + sponsorships + affiliate commissions + product/subscription sales
Cash contribution = gross revenue - payment/refund costs - hosting/tools - other cash costs
Economic profit = cash contribution - a fair value for your time - applicable taxes
```

Client services should be tracked separately so one freelance project does not make the discovery product look like it has recurring product revenue. MRR means monthly recurring subscription revenue, not total receipts from tips, one-time templates, and services.

### 16.2 Possible infrastructure budget

Current public pricing lists Vercel Pro at $20/month before applicable taxes/usage, and Supabase Pro starting at $25/month with compute credits covering one Micro project in the illustrated configuration. Multiple projects, higher compute, add-ons, and usage can increase the bill. These are provider prices checked for this guide, not a quotation for your account. [Vercel pricing](https://vercel.com/pricing), [Supabase pricing](https://supabase.com/pricing)

Supabase Free lists a 500 MB database and pauses inactive projects after a week. The 224-row catalog itself is small, but votes/reports accumulate and the project still needs operations/backups. Its Auth MAU allowance is not a traffic guarantee for this app, which does not use Supabase Auth. [Supabase Free limits](https://supabase.com/pricing)

| Example budget | Assumption | Approximate base monthly cash cost |
| --- | --- | ---: |
| Early commercial test | One Vercel Pro setup + Supabase Free within limits | $20 before extras |
| Small paid production setup | One Vercel Pro setup + baseline Supabase Pro | $45 before extras |
| Planning example used below | Previous row + an assumed $10 averaged allowance for domain/tools | $55 before fees, taxes, overages, and labor |

The $10 allowance is a budgeting assumption, not a domain/provider quote. Hosting externally visited games, maps, and audio is paid by their operators; your application does not stream those assets. Your main variable workload is page/API requests, database activity, checks, and any future analytics/email/commerce.

### 16.3 Advertising scenarios

Use **eligible, actually monetized page views**, not raw discovery button clicks:

```text
Ad revenue = monetized page views ÷ 1,000 × effective page RPM
```

RPM means revenue per thousand page views in the chosen reporting denominator. The following RPM values are deliberately hypothetical, not claims about this niche, Pakistan, Google, or your future audience. Actual results depend on approval, content, geography, demand, visibility, consent, ad blocking, and traffic quality. Without approved and suitable inventory, revenue can be zero regardless of traffic.

| Monthly monetized page views | At assumed $1 page RPM | At assumed $3 page RPM | At assumed $6 page RPM |
| ---: | ---: | ---: | ---: |
| 10,000 | $10 | $30 | $60 |
| 50,000 | $50 | $150 | $300 |
| 100,000 | $100 | $300 | $600 |
| 500,000 | $500 | $1,500 | $3,000 |

With $55 monthly cash overhead, ad-only break-even is approximately 55,000 monetized page views at $1 RPM, 18,334 at $3 RPM, or 9,167 at $6 RPM. If only half of raw page views are eligible/monetized under your chosen denominator, about twice as many raw views would be needed. These calculations exclude labor and taxes and assume the RPM already corresponds to the stated monetized-view denominator.

The current design quickly moves attention away from your site and offers little sustained editorial inventory. This is why the larger figures in the table should not be read as near-term potential merely from deploying the existing button.

### 16.4 Other illustrative calculations

| Model | Hypothetical inputs | Gross result before applicable costs |
| --- | --- | ---: |
| Sponsorship | Two sold placements at $50 each | $100 |
| Affiliate | 1,000 qualifying voluntary clicks × 2% approved conversions × $10 commission | $200 |
| Guide | 20 purchases × $9 | $180 |
| Support | 10 optional payments × $3 | $30 |
| Premium | 50 active paying members × $4/month | $200 MRR |
| Client work | One delivered customization at $500 | $500 service revenue, not app MRR |

All customer counts, prices, conversion rates, and commissions above are assumptions. The models require different audiences and work; adding them together does not create a credible forecast. Affiliate returns/reversals and subscription churn can materially reduce realized revenue.

Lemon Squeezy publishes a base fee of 5% + $0.50, with additional fees in some circumstances. On an illustrative $9 one-time product, that base fee alone is $0.95, leaving $8.05 before extra transaction/payout fees, refunds, taxes, and your costs. At that simplified margin, seven sales would cover $55 of cash overhead. This is not an actual settlement prediction. [Lemon Squeezy pricing](https://www.lemonsqueezy.com/pricing), [Fee details](https://docs.lemonsqueezy.com/help/getting-started/fees)

For subscriptions, contribution per member is the price minus actual fees and incremental costs. Divide monthly fixed costs by that contribution to estimate a minimum break-even member count. Then include churn: if 50 members lose 10% in a month, five new members are needed just to maintain the starting count. That churn rate is an example, not an observed benchmark.

### 16.5 What you can reasonably conclude

The codebase supports a low-complexity discovery product and a useful technical demonstration. It does not establish a business valuation, predictable traffic, or a likely monthly salary. At very low traffic, service work or a small well-matched direct sale can be more practical than ads. At sustained traffic, suitable original content, sponsor relationships, and repeat use matter more than the total number of seed links.

Replace the assumptions in this section with actual monthly data before increasing spending. Track both money received and hours spent. A product making $100 while consuming $55 cash plus ten hours of work has only $45 left before tax and labor; that is progress to measure, not yet a self-sustaining salary.

## 16.5 Post-review implementation: submissions, About, and owner control room

The public product now has two supporting routes. `/about` explains the editorial promise, privacy boundaries, health checks, and why the catalog is human-curated. `/submit` validates a public HTTPS URL, title, description, category, tags, optional contact email, mature-content declaration, and ownership attestation. A hidden honeypot catches simple bots. The API rejects private hosts, credentials in URLs, malformed JSON, duplicate URLs, unsupported categories, oversized fields, cross-origin mutations, and missing attestation. It stores a `DestinationSubmission` with `PENDING` status and no IP address.

The owner opens `/admin`. The one-time `npm run admin:bootstrap` command creates or rotates an owner account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` using a salted Node `scrypt` hash. Login creates a random seven-day token; only its SHA-256 hash is stored in `AdminSession`, while the browser receives an HTTP-only, same-site cookie. The control room exposes overview metrics, a submission review queue, destination search/editing, and a ranking lab. Approving a submission upserts a destination; rejecting it preserves the review note. Each destination can be flagged, retired, marked mature, moved between categories, or given editorial/weirdness scores and a `rankingBoost`.

Ranking controls are persisted in the `RankingConfig` singleton and category `weightMultiplier` fields. The random selector reads these values in one parameterized SQL query and combines base weight, editorial score, weirdness, vote balance/cap, report penalty, category multiplier, and per-destination boost before applying `-ln(random()) / weight`. Safe server-side ranges prevent an accidental zero/negative weight or runaway multiplier. This lets the owner tune the product without changing code or redeploying.

The database migration `20260912001532_admin_submissions_ranking` adds `SubmissionStatus`, category multipliers, destination boosts, ranking configuration, owner users/sessions, and submission records. The existing seed remains idempotent and now ensures neutral boosts plus the default ranking row. These additions are implemented and build-tested; production account bootstrapping still requires the owner to choose an email/password and run the documented command.

## 17. Complete seed inventory

This inventory is generated from the current `prisma/seed-data.cjs`, not from the production database. Every row preserves the existing title, URL, description, tags, and scores so that the application can be audited completely. Inclusion does not certify content quality, ownership, licensing, availability, or suitability. See section 9.4 for observed mismatches. `E` means editorial score; `W` means weirdness.

### 17.1 Weird Web — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [The Useless Web](https://theuselessweb.com) | A button that sends you somewhere delightfully pointless. | random, classic | 3 | 3 |
| [Pointer Pointer](https://pointerpointer.com) | Every cursor deserves a photographic pointing companion. | photos, cursor | 4 | 4 |
| [Koalas to the Max](https://www.koalastothemax.com) | Reveal a hidden picture one satisfying circle at a time. | animals, interactive | 3 | 3 |
| [Zoomquilt](https://zoomquilt.org) | An infinitely zooming painted dream with no obvious exit. | art, infinite | 4 | 4 |
| [A Soft Murmur](https://asoftmurmur.com) | Mix rain, waves, wind, and other soft little sounds. | ambient, focus | 4 | 2 |
| [Cats](https://cats.com) | A suspiciously serious portal devoted to cats. | cats, internet | 3 | 3 |
| [Long Doge Challenge](https://longdogechallenge.com) | Scroll. Find the doge. Keep scrolling. | doge, scroll | 3 | 4 |
| [The Calm Place](https://www.calm.com) | A soft, quiet corner for when the web is too loud. | calm, ambient | 3 | 1 |
| [Is JavaScript Enabled?](https://www.whatismybrowser.com/detect/is-javascript-enabled) | Finally, a definitive answer to a difficult browser question. | utility, browser | 3 | 2 |
| [Yes No If](https://yesnoif.com) | Ask a question; receive an answer with caveats. | answers, random | 3 | 3 |
| [RRR GGG BBB](https://rrrgggbbb.com) | A chromatic staircase that asks you to keep scrolling. | color, scroll | 4 | 4 |
| [Blank Windows](https://blankwindows.com) | A museum of windows that look out onto nothing. | windows, ambient | 3 | 3 |
| [Windows 93](https://www.windows93.net) | A lovingly broken alternate operating system from nowhere. | retro, desktop | 4 | 5 |
| [Homestar Runner](https://homestarrunner.com) | The long-running home of Strong Bad and internet history. | flash, comedy | 5 | 3 |
| [Falling Falling](https://fallingfalling.com) | A hypnotic, endless fall with a tiny soundtrack. | ambient, motion | 4 | 4 |
| [Crouton](https://crouton.net) | A crouton rotates with quiet, inexplicable confidence. | food, 3d | 3 | 4 |
| [Trash Loop](https://trashloop.com) | A loop of trash being thrown away, forever. | loop, satisfying | 3 | 3 |
| [Bored Button](https://www.boredbutton.com) | Press the button and let boredom choose the next stop. | random, button | 3 | 3 |
| [The World's Worst Website](https://www.theworldsworstwebsiteever.com) | A deliberately chaotic monument to bad web design. | web, comedy | 3 | 4 |
| [Annoying Site](https://www.annoyingsite.com) | A tiny website that knows exactly how to be annoying. | comedy, sound | 3 | 4 |
| [Click Click Click](https://clickclickclick.click) | An escalating clicker with a very needy personality. | clicking, interactive | 3 | 4 |
| [Strobe Cool](https://strobe.cool) | A colorful, slightly dizzying visual experiment. | visual, color | 3 | 4 |
| [Sun Tracker](https://www.timeanddate.com/sun/) | A practical place to wonder what the sun is doing. | time, sky | 3 | 2 |
| [Sometimes Red Sometimes Blue](https://sometimesredsometimesblue.com) | A calm color field with a slightly theatrical pulse. | color, ambient | 3 | 3 |
| [Cat Bounce](https://cat-bounce.com) | Make cats bounce. The controls are exactly what you hope. | cats, physics | 3 | 4 |
| [Nyan Cat](https://www.nyan.cat) | A tiny animated cat that has outlived several internet eras. | cat, classic | 3 | 4 |
| [Heeeeeeeey](https://heeeeeeeey.com) | A long hello stretched into a full destination. | hello, classic | 3 | 3 |
| [Find the Invisible Cow](https://findtheinvisiblecow.com) | Listen closely and click your way toward an unseen cow. | game, audio | 4 | 4 |

### 17.2 Useless Tools — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [Checkbox](https://checkbox.toys) | A checkbox that may be more complicated than expected. | checkbox, toy | 4 | 3 |
| [Sleep Calculator](https://sleepcalculator.org) | A gentle calculator for when to stop scrolling and sleep. | sleep, time | 3 | 1 |
| [Pixel Thoughts](https://www.pixelthoughts.co) | Put a thought in a bubble and watch it drift away. | meditation, calm | 4 | 2 |
| [Coffitivity](https://www.coffitivity.com) | The sound of a cafe, without needing to find your shoes. | sound, focus | 4 | 1 |
| [FutureMe](https://www.futureme.org) | Write a letter to the version of you who lives later. | letters, time | 4 | 2 |
| [How Many Plants](https://howmanyplants.com) | A gently specific plant-counting question for your day. | plants, quiz | 3 | 3 |
| [Writing Prompt](https://randomwordgenerator.com/writing-prompt.php) | A small prompt for a story that has not happened yet. | writing, prompt | 3 | 2 |
| [Is It Christmas?](https://isitchristmas.com) | The annual question, permanently available. | calendar, holiday | 3 | 3 |
| [Password Strength](https://howsecureismypassword.net) | A password meter with a theatrical sense of timing. | password, security | 3 | 2 |
| [One Million Checkboxes](https://onemillioncheckboxes.com) | Click checkboxes alongside strangers until the grid becomes a mood. | checkbox, social | 4 | 3 |
| [Absurd Trolley Problems](https://neal.fun/absurd-trolley-problems) | Ethical dilemmas with increasingly strange passengers. | quiz, ethics | 4 | 4 |
| [Life Stats](https://neal.fun/life-stats) | A scrollable reminder that time is a beautiful, odd number. | life, data | 4 | 2 |
| [Earth Reviews](https://neal.fun/earth-reviews) | Read reviews of the planet from its many inhabitants. | earth, reviews | 4 | 3 |
| [NASA Eyes](https://eyes.nasa.gov) | Explore the solar system with a very good set of eyes. | space, nasa | 5 | 1 |
| [The Deep Sea](https://neal.fun/deep-sea) | Scroll downward through the ocean and its increasingly odd residents. | ocean, science | 5 | 2 |
| [Logos from Memory](https://neal.fun/logos-from-memory) | Draw a famous logo from memory, then face the truth. | drawing, quiz | 4 | 3 |
| [Ambient Chaos](https://neal.fun/ambient-chaos) | A button that turns calm ambience into a small storm. | sound, chaos | 3 | 4 |
| [Hackertyper](https://hackertyper.net) | Tap keys and look like you have a plan in a movie. | typing, comedy | 3 | 3 |
| [Password Monster](https://www.passwordmonster.com) | A password strength meter with a surprisingly dramatic readout. | password, security | 3 | 2 |
| [Name That Color](https://colornames.org) | Give an unnamed color a name the internet can remember. | color, names | 4 | 3 |
| [Tiny Wow](https://tinywow.com) | A drawer full of tiny browser tools for oddly specific jobs. | tools, utility | 4 | 2 |
| [Remove.bg](https://www.remove.bg) | Erase a photo background with one remarkably direct request. | image, utility | 4 | 1 |
| [Photopea](https://www.photopea.com) | A full image editor hiding in a browser tab. | image, editor | 5 | 1 |
| [Carbon](https://carbon.now.sh) | Turn code into a small, beautiful poster. | code, design | 4 | 2 |
| [Regex101](https://regex101.com) | Test a regular expression until it stops being mysterious. | code, text | 4 | 2 |
| [JSON Crack](https://jsoncrack.com) | Turn JSON into a diagram you can actually look at. | json, diagram | 4 | 2 |
| [Text to Handwriting](https://www.texttohandwriting.com) | Ask a machine to make typed words look a little more human. | text, handwriting | 3 | 3 |
| [The True Size Of](https://www.thetruesize.com) | Drag countries around and let geography rearrange your assumptions. | maps, geography | 5 | 2 |

### 17.3 Generators — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [Random Word Generator](https://randomwordgenerator.com) | Summon a word, a sentence, or a little writing prompt. | words, writing | 4 | 2 |
| [Fake Name Generator](https://www.fakenamegenerator.com) | Generate a fictional identity with suspiciously thorough details. | names, random | 4 | 3 |
| [Coolors](https://coolors.co) | Spin through color palettes until one starts a project. | color, design | 5 | 1 |
| [Random Street View](https://randomstreetview.com) | Drop into a random road and wonder where you are. | maps, travel | 4 | 3 |
| [Wheel of Names](https://wheelofnames.com) | Put decisions on a wheel and let fate do admin. | random, decisions | 4 | 2 |
| [This Person Does Not Exist](https://thispersondoesnotexist.com) | Meet a face that was rendered from pure statistical imagination. | ai, faces | 5 | 4 |
| [This X Does Not Exist](https://thisxdoesnotexist.com) | A collection of things that look real enough to make you pause. | ai, random | 4 | 4 |
| [Perchance](https://perchance.org) | A home for collaborative generators of every oddly specific kind. | generators, writing | 4 | 3 |
| [D&D Name Generator](https://www.fantasynamegenerators.com/dungeons-and-dragons.php) | Name a fantasy character before they demand a backstory. | fantasy, names | 4 | 2 |
| [What Should I Read Next?](https://www.whatshouldireadnext.com) | Feed it a book and receive another doorway. | books, recommendations | 4 | 1 |
| [Random Trivia Generator](https://randomtriviagenerator.com) | A pocketful of facts for your next oddly timed conversation. | trivia, facts | 3 | 2 |
| [Joke Generator](https://perchance.org/joke-generator) | Roll the dice on a joke of uncertain quality. | comedy, writing | 3 | 3 |
| [Plot Generator](https://www.plot-generator.org.uk) | Generate a story premise and pretend it was your plan all along. | stories, writing | 4 | 2 |
| [Lorem Picsum](https://picsum.photos) | Placeholder images with the confidence of finished art. | images, design | 4 | 1 |
| [Lorem Ipsum](https://lipsum.com) | The ancient art of filling space with almost-words. | text, design | 3 | 1 |
| [Metaphor Generator](https://www.metaphors.com) | Find a metaphor for whatever you are trying to say. | writing, language | 3 | 2 |
| [Random Lists](https://www.randomlists.com) | A filing cabinet of lists for decisions nobody planned for. | random, lists | 3 | 3 |
| [Sleep Calculator](https://www.sleepfoundation.org/sleep-calculator) | Count backward from tomorrow and negotiate with bedtime. | sleep, time | 3 | 1 |
| [Daily UI](https://www.dailyui.co) | A daily interface prompt for when you want a design excuse. | design, prompts | 4 | 1 |
| [CSS-Tricks](https://css-tricks.com) | A field guide to the strange, useful edges of the web platform. | css, design | 4 | 2 |
| [Haikei](https://haikei.app) | Generate soft shapes, blobs, and backgrounds for your next screen. | design, shapes | 4 | 2 |
| [Pattern Monster](https://pattern.monster) | Browse a menagerie of repeatable vector patterns. | patterns, design | 4 | 2 |
| [Blobmaker](https://www.blobmaker.app) | Make an irregular blob and give it a job. | svg, design | 4 | 2 |
| [Get Waves](https://getwaves.io) | Generate a wave that looks like it knows about layout. | svg, design | 4 | 2 |
| [QR Code Monkey](https://www.qrcode-monkey.com) | Make a QR code and briefly become a signage designer. | qr, utility | 3 | 1 |
| [Random Number Generator](https://www.random.org) | Numbers generated from atmospheric noise, for maximum seriousness. | numbers, random | 5 | 2 |
| [Checkbox Race](https://checkboxrace.com) | Race a checkbox across a tiny, needlessly competitive course. | checkbox, toy | 3 | 3 |
| [Random Things to Do](https://randomthingstodo.com) | A generator for the feeling that you should do something else. | random, ideas | 3 | 3 |

### 17.4 Rabbit Holes — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [Wikipedia: Unusual Articles](https://en.wikipedia.org/wiki/Wikipedia:Unusual_articles) | A curated launchpad for Wikipedia’s less-traveled trails. | wikipedia, articles | 5 | 3 |
| [Wikipedia: Unusual Place Names](https://en.wikipedia.org/wiki/List_of_unusual_place_names) | Places whose names sound invented but have maps to prove it. | wikipedia, places | 4 | 3 |
| [Wikipedia: List of Lists](https://en.wikipedia.org/wiki/List_of_lists_of_lists) | A list of lists of lists. The recursion is the point. | wikipedia, lists | 5 | 4 |
| [Wikipedia: Numberphile](https://en.wikipedia.org/wiki/Numberphile) | A portal into the surprisingly dramatic lives of numbers. | wikipedia, math | 4 | 2 |
| [Atlas Obscura](https://www.atlasobscura.com) | The world’s curious places, told by people who went looking. | travel, history | 5 | 3 |
| [The Public Domain Review](https://publicdomainreview.org) | Beautiful, strange things rescued from the public domain. | archive, art | 5 | 3 |
| [Internet Archive](https://archive.org) | A library for the internet, including things the internet forgot. | archive, history | 5 | 2 |
| [Kottke.org](https://kottke.org) | A long-running collection of links for curious people. | links, culture | 4 | 2 |
| [The Marginalian](https://www.themarginalian.org) | A thoughtful atlas of books, ideas, and being alive. | books, essays | 5 | 2 |
| [The Pudding](https://pudding.cool) | Data stories that make the familiar suddenly strange. | data, journalism | 5 | 2 |
| [Wait But Why](https://waitbutwhy.com) | Long, illustrated detours through big human questions. | essays, ideas | 5 | 2 |
| [The Kid Should See This](https://thekidshouldseethis.com) | A hand-picked archive of wonderful things to watch and wonder about. | video, learning | 4 | 2 |
| [Aeon](https://aeon.co) | Big ideas, carefully written, for the curious and patient. | essays, philosophy | 4 | 1 |
| [The Conversation](https://theconversation.com) | Researchers explain the world beyond the headline. | science, news | 4 | 1 |
| [Lateral Magazine](https://lateralmag.com) | Curiosity-driven stories with a wonderfully wide remit. | culture, stories | 4 | 2 |
| [Longreads](https://longreads.com) | A place to get pleasantly lost in a long story. | writing, journalism | 4 | 1 |
| [The Browser](https://thebrowser.com) | A daily selection of the internet’s best writing. | links, reading | 4 | 1 |
| [Damn Interesting](https://www.damninteresting.com) | True stories that sound like someone made them up. | history, science | 4 | 3 |
| [Messy Nessy Chic](https://www.messynessychic.com) | A visual cabinet of curiosities from around the world. | culture, visual | 4 | 3 |
| [The Useless Web Index](https://www.theuselesswebindex.com) | A filing cabinet for the web’s more unnecessary rooms. | index, weird | 3 | 4 |
| [TV Tropes](https://tvtropes.org) | Look up one narrative pattern; emerge three hours later. | stories, media | 5 | 3 |
| [TV Garden](https://tv.garden) | Spin the globe and sample television from somewhere else. | television, world | 4 | 3 |
| [Radiooooo](https://radiooooo.com) | Choose a place and a decade; let the music time-travel. | radio, history | 5 | 2 |
| [MapCrunch](https://www.mapcrunch.com) | A random street-view drop with no itinerary whatsoever. | maps, travel | 4 | 3 |
| [The Atlas of the Future](https://atlasofthefuture.org) | Meet ideas and projects trying to shape tomorrow. | future, ideas | 4 | 2 |
| [The World Wide Web by CERN](https://info.cern.ch) | Visit the first website, still standing like a little time capsule. | web, history | 5 | 3 |
| [Neal.fun](https://neal.fun) | A whole constellation of polished internet curiosities. | interactive, curiosities | 5 | 3 |
| [Wikimapia](https://wikimapia.org) | A strange, collaborative annotation layer on top of the world. | maps, places | 3 | 3 |

### 17.5 Digital Art — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [This Is Sand](https://thisissand.com) | Pour colored grains into a tiny digital landscape. | sand, drawing | 5 | 2 |
| [Chrome Experiments](https://experiments.withgoogle.com) | A gallery of browser experiments built to be poked. | experiments, visual | 4 | 3 |
| [Piskel](https://www.piskelapp.com) | Make animated pixel art one tiny square at a time. | pixel, animation | 4 | 2 |
| [Patatap](https://www.patatap.com) | Make animated shapes and sounds by pressing keys. | sound, keyboard | 5 | 3 |
| [Blob Opera](https://artsandculture.withgoogle.com/blobopera) | Direct a choir of blobs into a surprisingly lovely aria. | music, opera | 5 | 4 |
| [Music for Programming](https://www.musicforprogramming.net) | Long, thoughtful mixes for making things at a screen. | music, focus | 4 | 1 |
| [The Art Assignment](https://www.theartassignment.com) | Art prompts for people who like making things without a plan. | art, prompts | 4 | 2 |
| [The Johnny Cash Project](https://www.thejohnnycashproject.com) | A collaborative portrait made from thousands of drawn frames. | music, collaboration | 5 | 3 |
| [Matisse](https://www.matisse.net) | A digital collage playground with cut-paper energy. | collage, art | 3 | 3 |
| [Sketch Toy](https://sketchtoy.com) | Draw a sketch and watch it replay itself into existence. | drawing, replay | 4 | 2 |
| [AutoDraw](https://www.autodraw.com) | Doodle badly; let machine learning guess generously. | drawing, ai | 4 | 2 |
| [Draw a Stickman](https://www.drawastickman.com) | Draw a hero and send them into a tiny animated adventure. | drawing, animation | 4 | 3 |
| [Google Arts & Culture](https://artsandculture.google.com) | An endless museum hallway for the screen-sized art lover. | museum, art | 5 | 1 |
| [The Met Collection](https://www.metmuseum.org/art/collection) | Browse a very large room of very old and very good things. | museum, history | 5 | 1 |
| [Museum of Endangered Sounds](https://savethesounds.info) | A memorial for the noises technology left behind. | sound, nostalgia | 5 | 3 |
| [Radio Tapes](https://www.radiotapes.com) | A softly strange archive of radio recordings and experiments. | radio, archive | 4 | 3 |
| [The Jigsaw Puzzle](https://thejigsawpuzzles.com) | A quiet browser table with an unreasonable number of puzzles. | puzzle, calm | 3 | 1 |
| [Pixel Art Maker](https://pixelartmaker.com) | Make a tiny square world, one pixel at a time. | pixel, drawing | 4 | 2 |
| [Akinator](https://en.akinator.com) | Think of someone; let a genie ask increasingly invasive questions. | quiz, guessing | 4 | 3 |
| [Armor Games](https://armorgames.com) | A long-running home for browser games and internet animation. | games, animation | 4 | 2 |
| [Zoomquilt 2](https://zoomquilt2.com) | A collaborative zoom through a second painted dream. | art, infinite | 4 | 4 |
| [GamePix](https://www.gamepix.com) | A cupboard of quick browser games for a five-minute detour. | games, arcade | 3 | 2 |
| [Musicca Piano](https://www.musicca.com/piano) | Play a browser piano with no bench required. | music, piano | 4 | 1 |
| [Artbreeder](https://www.artbreeder.com) | Blend images into new visual species. | ai, images | 4 | 3 |
| [SculptGL](https://stephaneginier.com/sculptgl) | Sculpt digital clay directly in a browser tab. | 3d, sculpture | 4 | 2 |
| [Womp 3D](https://womp.com) | Make soft, strange 3D shapes with a friendly interface. | 3d, design | 4 | 2 |
| [Doodle Ipsum](https://doodleipsum.com) | Fill a layout with cheerful little doodles. | doodles, design | 3 | 2 |
| [Art Institute Collection](https://www.artic.edu/collection) | Wander a very good museum collection from your screen. | museum, art | 5 | 1 |

### 17.6 Tiny Games — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [A Dark Room](https://adarkroom.doublespeakgames.com) | Start with a fire; discover the rest slowly. | text, survival | 5 | 2 |
| [Universal Paperclips](https://www.decisionproblem.com/paperclips) | Turn an innocent office supply into an existential machine. | clicker, strategy | 5 | 3 |
| [Cookie Clicker](https://orteil.dashnet.org/cookieclicker) | Bake one cookie until the numbers become their own weather. | clicker, classic | 5 | 2 |
| [2048](https://play2048.co) | Slide tiles, chase powers of two, lose track of time. | puzzle, numbers | 4 | 1 |
| [Wonders of Street View](https://neal.fun/wonders-of-street-view) | A tiny tour of the world's most surprising views. | maps, travel | 4 | 3 |
| [Infinite Craft](https://neal.fun/infinite-craft) | Combine elements until you invent something impossible. | crafting, infinite | 5 | 4 |
| [The Password Game](https://neal.fun/password-game) | The rules keep changing. Your password keeps suffering. | puzzle, rules | 5 | 4 |
| [Little Alchemy 2](https://littlealchemy2.com) | Mix simple elements into a world of discoveries. | crafting, alchemy | 4 | 2 |
| [Sketchpad](https://www.sketchpad.app) | A full little drawing canvas hiding in the browser. | drawing, art | 4 | 1 |
| [The World's Biggest Pac-Man](https://worldsbiggestpacman.com) | Play and build Pac-Man mazes with the rest of the web. | arcade, maps | 4 | 3 |
| [Slither.io](https://slither.io) | Become a snake; become a bigger snake; avoid other snakes. | arcade, multiplayer | 4 | 2 |
| [Agar.io](https://agar.io) | Eat dots, grow round, and distrust every other circle. | arcade, multiplayer | 4 | 2 |
| [The Wiki Game](https://www.thewikigame.com) | Navigate Wikipedia from one article to another at speed. | wikipedia, race | 4 | 2 |
| [GeoGuessr](https://www.geoguessr.com) | Guess the planet from a road, a sign, or one suspicious tree. | maps, quiz | 5 | 2 |
| [Worldle](https://worldle.teuteuf.fr) | Guess a country from its silhouette and your geographic instincts. | maps, quiz | 4 | 1 |
| [Framed](https://framed.wtf) | Guess the film from a handful of frames. | film, quiz | 4 | 1 |
| [Globle](https://globle-game.com) | Find the mystery country by temperature, not certainty. | maps, quiz | 4 | 1 |
| [Connections](https://www.nytimes.com/games/connections) | Group words into four sets and distrust the obvious answer. | puzzle, words | 4 | 1 |
| [Puzzle Baron](https://www.puzzlebaron.com) | A complete drawer of small logic games and riddles. | puzzle, logic | 4 | 1 |
| [Minesweeper Online](https://minesweeper.online) | The classic field of numbers and politely hidden danger. | puzzle, classic | 4 | 1 |
| [Poki Games](https://poki.com) | A huge, cheerful shelf of tiny games in the browser. | games, arcade | 3 | 1 |
| [Arkadium Games](https://www.arkadium.com/games/) | A polished collection of small puzzles and word games. | puzzle, games | 3 | 1 |
| [Hollow Knight Silksong Doodle](https://www.doodle.com) | A quick doodle break when the serious game is elsewhere. | drawing, toy | 3 | 1 |
| [The Helicopter Game](https://www.helicoptergame.net) | Hold a key, dodge the landscape, remember the old web. | arcade, retro | 3 | 2 |
| [Line Rider](https://www.linerider.com) | Draw a line and see if a tiny person can ride it. | drawing, physics | 5 | 2 |
| [QWOP](https://www.foddy.net/Athletics.html) | Control four limbs; discover how difficult walking is. | physics, comedy | 5 | 4 |
| [Getting Over It](https://www.crazygames.com/game/getting-over-it) | A mountain, a hammer, and an invitation to remain calm. | physics, challenge | 4 | 4 |
| [Skribbl](https://skribbl.io) | Draw a word, guess a word, laugh at the drawing. | drawing, multiplayer | 4 | 2 |

### 17.7 Science & Maps — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [Map Projections](https://en.wikipedia.org/wiki/Map_projection) | A clear explanation of why every flat map lies a little. | maps, geography | 4 | 1 |
| [Google Earth](https://earth.google.com/web/) | Fly around the planet without finding your passport. | maps, travel | 5 | 2 |
| [Windy](https://www.windy.com) | Watch wind, weather, and storms move across the planet. | weather, maps | 5 | 1 |
| [Earth Nullschool](https://earth.nullschool.net) | A living globe of wind, waves, and atmospheric motion. | weather, science | 5 | 3 |
| [Solar System Scope](https://www.solarsystemscope.com) | A navigable model of the neighborhood beyond our sky. | space, stars | 4 | 2 |
| [Stellarium Web](https://stellarium-web.org) | A planetarium that fits in the browser. | stars, space | 5 | 1 |
| [In the Sky](https://in-the-sky.org) | Track satellites and know what is moving overhead. | space, satellites | 4 | 1 |
| [The Scale of the Universe](https://htwins.net/scale2) | Travel from quantum particles to the edge of everything. | scale, space | 5 | 2 |
| [Map of the Internet](https://internet-map.net) | Websites become a constellation you can zoom through. | web, maps | 4 | 3 |
| [OpenStreetMap](https://www.openstreetmap.org) | A living, open map built by people who notice things. | maps, open-data | 5 | 1 |
| [GeoNames](https://www.geonames.org) | A database of places that rewards clicking around. | maps, places | 4 | 2 |
| [Flightradar24](https://www.flightradar24.com) | Watch the sky fill with tiny moving destinations. | planes, maps | 4 | 2 |
| [MarineTraffic](https://www.marinetraffic.com) | Follow ships crossing the blue parts of the map. | ships, maps | 4 | 2 |
| [Global Fishing Watch](https://globalfishingwatch.org/map) | See patterns of activity on the ocean from above. | ocean, data | 4 | 2 |
| [World Population](https://worldpopulationhistory.org) | Watch populations move through history on a map. | history, data | 4 | 1 |
| [Gapminder Tools](https://www.gapminder.org/tools) | Animated data that makes the world more legible. | data, world | 5 | 1 |
| [Our World in Data](https://ourworldindata.org) | Evidence and charts for questions too large for one afternoon. | data, research | 5 | 1 |
| [Information is Beautiful](https://informationisbeautiful.net) | Data visualizations that remember beauty is useful. | data, design | 4 | 1 |
| [Periodic Table](https://ptable.com) | A periodic table with more detail than you asked for. | chemistry, science | 4 | 2 |
| [Visible Body](https://www.visiblebody.com) | Explore the human body as a navigable little universe. | biology, anatomy | 4 | 1 |
| [The Scale of Space](https://scaleofuniverse.com) | A second trip through the sizes of things. | space, scale | 4 | 2 |
| [Neal.fun Space](https://neal.fun/size-of-space) | Scroll outward until perspective gets pleasantly inconvenient. | space, scale | 5 | 2 |
| [The Pudding: Pockets](https://pudding.cool/2018/08/pockets/) | An interactive story with data hiding in plain sight. | data, story | 4 | 2 |
| [Volcano Discovery](https://www.volcanodiscovery.com) | A map of volcanoes, alerts, and the planet’s restless bits. | volcanoes, earth | 4 | 2 |
| [Earthquakes Today](https://earthquaketrack.com) | See where the ground has moved recently. | earth, data | 3 | 2 |
| [The Ocean Cleanup Map](https://theoceancleanup.com) | Learn what is happening where land meets floating plastic. | ocean, environment | 4 | 1 |
| [Natural Earth](https://www.naturalearthdata.com) | Beautiful public map data for people who like making maps. | maps, open-data | 4 | 1 |
| [Space.com](https://www.space.com) | A lively guide to the sky and the things beyond it. | space, stars | 4 | 1 |

### 17.8 Sound & Music — 28 entries

| Destination | Current description | Tags | E | W |
| --- | --- | --- | ---: | ---: |
| [LiveATC](https://www.liveatc.net) | Listen to the busy, coded chatter around airports. | radio, planes | 4 | 3 |
| [Patatap](https://patatap.com) | Every key becomes a color, a shape, or a sound. | sound, keyboard | 5 | 3 |
| [Radio Garden](https://radio.garden) | Turn the earth and land inside a live radio signal. | radio, world | 5 | 2 |
| [MyNoise](https://mynoise.net) | An enormous library of calibrated background sound. | ambient, soundscapes | 5 | 1 |
| [Noisli](https://www.noisli.com) | Make rain and coffee-shop ambience on demand. | ambient, focus | 4 | 1 |
| [Endlesss](https://endlesss.fm) | A collaborative loop-making room for little musical ideas. | music, loops | 4 | 2 |
| [Chrome Music Lab](https://musiclab.chromeexperiments.com) | Small music toys for rhythm, melody, and curious clicking. | music, learning | 5 | 2 |
| [Incredibox](https://www.incredibox.com) | Dress beatboxers and build a track that feels oddly complete. | music, beats | 5 | 2 |
| [Virtual Piano](https://virtualpiano.net) | Play piano notes with your keyboard and a little confidence. | piano, music | 4 | 1 |
| [SomaFM](https://somafm.com) | Independent online radio for many moods and odd hours. | radio, music | 4 | 1 |
| [Radio King](https://www.radioking.com) | A broad dial of independent online radio stations. | radio, world | 3 | 2 |
| [The Music Map](https://www.music-map.com) | Type an artist and discover nearby musical neighborhoods. | music, discovery | 4 | 2 |
| [Gnoosic](https://www.gnoosic.com) | Find music by telling a small machine what you already like. | music, recommendations | 4 | 2 |
| [Every Noise at Once](https://everynoise.com) | A map of musical genres that goes much farther than expected. | music, genres | 5 | 3 |
| [Song Exploder](https://songexploder.net) | Musicians take songs apart and show you how they work. | music, stories | 5 | 1 |
| [KCRW Music](https://www.kcrw.com/music) | Radio, sessions, and music discovery from a public station. | music, radio | 4 | 1 |
| [The Mozart Project](https://themozartproject.org) | A public collection for wandering through Mozart’s work. | classical, archive | 4 | 1 |
| [Musopen](https://musopen.org) | Free recordings and scores for curious classical listeners. | classical, archive | 5 | 1 |
| [SoundCloud](https://soundcloud.com) | A huge community library of sounds to explore and borrow. | music, discovery | 4 | 2 |
| [BBC Sound Effects](https://sound-effects.bbcrewind.co.uk) | Search decades of odd, useful, and wonderful recordings. | samples, archive | 5 | 2 |
| [Radio Aporee](https://aporee.org/maps) | A map made from field recordings around the world. | field-recordings, maps | 4 | 3 |
| [Listen to Wikipedia](https://listen.hatnote.com) | Wikipedia edits become a strangely gentle stream of sound. | wikipedia, ambient | 5 | 3 |
| [Rainy Mood](https://rainymood.com) | Rain, forever, with optional emotional weather. | rain, ambient | 4 | 1 |
| [Lofi.cafe](https://lofi.cafe) | A tiny room of lo-fi beats for whatever comes next. | lofi, focus | 3 | 1 |
| [Radio Paradise](https://radioparadise.com) | A human-curated stream for long drives and longer afternoons. | radio, music | 4 | 1 |
| [KEXP](https://www.kexp.org) | Independent music radio with a very good archive. | radio, indie | 4 | 1 |
| [NTS Radio](https://www.nts.live) | A global stream of left-field music and excellent selectors. | radio, discovery | 4 | 2 |
| [Classical Music Only](https://classical-music-online.net) | A straightforward doorway into a lot of classical listening. | classical, music | 3 | 1 |


## 18. Future enhancements and priorities

The proposed order below puts dependable discovery before business expansion. None of these roadmap items were implemented by writing this guide.

### Phase 1 — Make the existing promise reliable

Harden the repaired history storage with reload, multiple-discovery, cap, and category-exhaustion tests. Reconcile vote state with server responses, reset counts per destination, and prevent stale request results from updating a different ticket. Give each departure a request ID, deduplicate messages, scope responses to its opener, and add cancellation plus closed-tab/timeout recovery. Provide a deliberate open/continue fallback when storage or popups fail.

Complete dialog focus/keyboard behavior, category state semantics, narrow-screen testing, reduced-motion coverage, and accessible redirect handling. Validate input strictly and consistently; introduce server-only import guards and explicit request limits. Add durable abuse protection with carefully defined privacy properties.

Harden report threshold transactions, expedite reported-link checks, align standalone/cron health rules, fit work within the execution budget, and handle partial/overlapping cron runs. Verify database access grants and authenticated TLS, rotate exposed setup credentials, and test backups. Correct misleading catalog entries and preserve moderation fields during reseeding.

**Exit evidence:** clean install/build; successful lint and source tests; migration from an empty dedicated database; idempotent seed verification; repaired real DB selection/vote/report concurrency tests; production-browser tests for happy, empty, error, slow, blocked-popup, and closed-popup paths; 320×568, 390×844, tablet, desktop, keyboard and reduced-motion checks; fresh URL verification plus the planned 56-entry stratified manual review. A passing status must correspond to checks actually run.

### Phase 2 — Improve editorial quality and retention

Extend the owner moderation dashboard with roles, review notes, explicit resolve actions, and an audit trail. Add canonical URL detection, final-redirect records, preview screenshots with rights-aware handling, last-reviewed dates, mobile usability, account/paywall requirements, sound/flash warnings, and verified content suitability labels. Treat automated screenshots/classifiers as assistance to review rather than a safety guarantee.

Unify category definitions between client and seed. Add history/favorite search, removal, import/export, optional collections, and a clearly defined discovery streak if it actually improves the experience. Offer a nonautomatic preview/open mode. Add public editorial collections, metadata/social previews, sitemap/robots decisions, and useful explanatory pages. Instrument the minimal measurement needed to establish repeat value.

**Exit evidence:** visitors can find and revisit relevant discoveries, editorial changes are traceable, and meaningful retention/quality metrics are available without overstating what browser tracking proves.

### Phase 3 — Test a small revenue model

Add one disclosed sponsor component, an owner/contact page, voluntary sponsor links, placement dates, and honest reporting. Alternatively, sell one original guide/template through an eligible hosted checkout. Keep paid recommendations distinguishable from organic discovery and capture customer-support/refund responsibilities. If launching a newsletter, add real opt-in, unsubscribe, and publishing operations.

**Exit evidence:** at least one voluntarily purchased, correctly delivered offer with known costs and buyer feedback. The target is evidence that someone values the offer, not a preset revenue promise.

### Phase 4 — Expand only when demand supports it

Add optional visitor accounts and synced favorites when users ask for cross-device access. For premium features, implement billing webhooks, entitlements, refunds/cancellation, account deletion, and secure account recovery. Harden public submissions with durable spam defenses, URL/network protections, notifications, and a staffed review process. A PWA or extension can improve return access if repeated use justifies its maintenance.

As the catalog and traffic grow, benchmark sampling, index/selectivity behavior, database connections, and API latency. Then introduce efficient candidate pools, caching where appropriate, durable queues, observability, and regional placement based on measured bottlenecks. Explore B2B licensing, a quota-controlled API, or team collections only after actual customer needs establish their value.

**Exit evidence:** each added capability has a demonstrated user or buyer need, a support/operating plan, and metrics showing its benefit exceeds its complexity and cost.
