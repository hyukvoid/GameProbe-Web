# GameProbe Web

A compatibility database for Android game controllers in specific games. It answers
questions like "does RT work with an 8BitDo Ultimate 2 in Wuthering Waves over Bluetooth?"
with the evidence behind the answer, not a score.

## Current status

First MVP. It covers three games: Wuthering Waves, Genshin Impact and Honkai: Star Rail.

- Public pages per game and per game + controller, with search.
- Anonymous direct test submission. Every submission is private until an admin approves it.
- A private, admin-only Evidence Inbox for reviewing external sources added by hand.

There is no crawler, no public API and no user accounts. The production database starts
empty apart from the game and controller catalog.

## How the data works

Two kinds of evidence are stored in separate tables and shown separately everywhere:

- **Direct tests** (`test_sessions`, `test_observations`): someone tested an exact setup
  and submitted a result per control. They're published after review.
- **External reports** (`evidence_sources`, `evidence_claims`): a forum post, video or thread
  that an admin reviewed and summarised. They link to the source and record only what it
  states.

Rules the code enforces:

- Unknown values (game version, Android version, device, connection, controller model)
  stay `NULL` and are shown as unknown. Game versions must be exact strings such as
  `2.8.1`, so "latest" is rejected by validation and by a database check.
- A source can only be published if a reviewer marked it as an actual report. Questions
  are not evidence.
- A source's wording such as "8BitDo Ultimate" is stored as written. It is linked to an
  exact controller model only when a reviewer picks one.
- Duplicate URLs are caught on entry, and a merged duplicate never counts. External
  reports count once per source.
- Contradictions are kept. A control with disagreeing results is shown as conflicting,
  with counts on each side and the conditions that differ (for example USB vs Bluetooth).
  Direct tests decide the shown result when any exist; external reports never override
  them.
- There are no compatibility scores or percentages.

## Stack

Next.js 16 (App Router, Server Actions), TypeScript and Postgres through
[postgres.js](https://github.com/porsager/postgres). The target deployment is Vercel with
Supabase Postgres. All database access happens on the server. No Supabase API key is used:
the anonymous and authenticated Supabase roles get no table privileges and RLS is on for
every table, so the public REST API exposes nothing.

Admin sign-in uses one password from the environment and an HMAC-signed, HTTP-only
session cookie. Failed logins are throttled. Anonymous submissions are validated
server-side, rate-limited per network (a daily-rotating keyed hash, never the raw
address) and have a honeypot field.

## Local development

Requirements: Node.js 22 or newer. Docker isn't needed. The local database is an embedded
Postgres ([PGlite](https://pglite.dev)) served over the normal Postgres protocol.

```sh
npm install
cp .env.example .env.local        # then set ADMIN_PASSWORD and APP_SECRET
npm run db:local                  # terminal 1: local database on port 54329
npm run db:migrate                # terminal 2
npm run db:fixtures               # optional: invented demo records
npm run dev                       # http://localhost:3000
```

Development fixtures (`db/fixtures/dev.sql`) are invented records for trying the UI. Every
fixture row has `is_demo = true`, fixture sources point to example.com, and they're only
shown when `SHOW_DEMO_DATA=true`, with a notice and a label on each record. The fixture
loader refuses to run against non-local databases.

Admin is at `/admin` and uses the `ADMIN_PASSWORD` from `.env.local`.

## Tests

```sh
npm test               # unit and database tests (Vitest, embedded Postgres per file)
npm run build
npm run test:e2e       # Playwright against the built app and a fresh empty database
npm run lint
npm run typecheck
```

The database tests cover validation, submission and moderation, public vs pending
visibility, evidence review rules, duplicate handling, unknown-value handling,
contradiction aggregation, search, and the Supabase role lockdown. The end-to-end tests
cover the submit → approve and add → review → publish flows, admin access control and
mobile layout. The first run of `test:e2e` needs `npx playwright install chromium`.

## Deploying

1. Create a Supabase project. Under Project Settings > Database, copy the
   **transaction pooler** connection string (port 6543) and append `?sslmode=require`.
2. Apply the migrations once: `DATABASE_URL=<connection string> npm run db:migrate`.
3. Import the repository in Vercel and set `DATABASE_URL`, `ADMIN_PASSWORD` (16+ characters)
   and `APP_SECRET` (32+ random characters). Leave `SHOW_DEMO_DATA` unset.

## Known limitations

- The dataset is empty until tests are submitted and sources are reviewed.
- Devices are stored as entered (name and model number). There is no device catalog yet.
- Controller mode and connection are self-reported or taken from the source. Nothing
  verifies them.
- There is no AI-assisted extraction. Inbox items are reviewed entirely by hand.
- Admin is a single shared password. There are no per-reviewer accounts or audit history
  beyond review timestamps.

## License

[MIT](LICENSE)
