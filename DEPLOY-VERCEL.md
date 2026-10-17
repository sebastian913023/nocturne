# Deploying Nocturne to Vercel

This documents the Vercel deployment path alongside the existing Railway
one (`DEPLOY.md`) — both work from the same codebase. See `RUNNING.md` for
how the app itself works and what's real vs. simulated.

## Why this needed code changes (and Railway didn't)

Railway runs the app as one persistent Node process (`npm start` →
`server/index.js`), same as running it locally. Vercel instead runs the
Express app as a serverless function — no process stays alive between
requests — which affects two things:

- **The nightly cycle.** `server/nightCycle.js`'s `node-cron` timer only
  fires inside a persistent process. On Vercel, `server/index.js` (which
  starts that timer) isn't used at all; instead, `GET /api/cron/nightly`
  (`server/routes/cron.js`) runs the same cycle on demand, called by a
  [Vercel Cron Job](https://vercel.com/docs/cron-jobs) configured in
  `vercel.json`. It's protected by the `CRON_SECRET` env var — Vercel
  auto-attaches `Authorization: Bearer $CRON_SECRET` to its own cron
  requests, so anyone else hitting the route gets a 401. Vercel Cron runs
  in UTC, so `0 3 * * *` is 3am UTC, not 3am server-local as on Railway.
- **The database pool.** Many short-lived function instances can run
  concurrently, each opening its own `pg` pool, vs. Railway's one
  long-lived process. `server/db.js` caps the pool to `max: 3` when
  `process.env.VERCEL` is set (Vercel sets this automatically) so
  instances don't collectively exhaust Neon's connection limit; use the
  **pooled** Neon connection string regardless (same as Railway).

Everything else — routes, auth, Stripe, the frontend — is unchanged.
`api/index.js` just re-exports the same Express app (`server/app.js`) as
Vercel's serverless entrypoint; an Express app is itself a valid
`(req, res)` handler, so no adapter package was needed.

## What's in this repo for deploy

- `vercel.json` — rewrites every path to the one serverless function
  (`api/index.js`), bundles `public/**` into it (Vercel's build-time file
  tracing doesn't see files `express.static` reads at runtime, so this has
  to be listed explicitly), and schedules the nightly Cron Job.
- `api/index.js` — the serverless entrypoint.
- `server/app.js` — the Express app itself (routes, middleware, static
  serving), shared by both the Railway (`server/index.js`) and Vercel
  (`api/index.js`) entrypoints.
- `server/routes/cron.js` — the nightly-cycle HTTP route Vercel Cron calls.

## Steps

1. **Import the project.** Vercel dashboard → Add New → Project → import
   this GitHub repo. Framework preset: "Other" (no build step/output
   directory needed — leave those blank).
2. **Connect the database.** Same as Railway: copy the **pooled**
   connection string from the Neon dashboard (Connect → Pooled connection)
   — set it as `DATABASE_URL` below. Tables are created automatically on
   first request (`server/db.js`); no volume needed.
3. **Set environment variables** (Vercel dashboard → project → Settings →
   Environment Variables):

   | Variable | Required for |
   |---|---|
   | `DATABASE_URL` | **Required.** Neon pooled Postgres connection string |
   | `SESSION_SECRET` | **Required.** Login sessions to work at all |
   | `CRON_SECRET` | **Required for the nightly cycle to run.** Any long random string |
   | `ANTHROPIC_API_KEY` | Real AI business generation + co-founder chat (falls back to a fixed sample otherwise) |
   | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Real $49/mo Checkout |
   | `APP_URL` | Set to your Vercel deployment URL (or custom domain) once known — used for Stripe Checkout redirects |

   Don't set `PORT` — Vercel's runtime ignores it; the app never calls
   `app.listen()` on this path.
4. **Deploy.** Vercel builds and deploys on push automatically once the
   project is imported.
5. **Point the Stripe webhook** at `https://<your-domain>/api/billing/webhook`
   if using real Checkout (same as on any other host).
6. **Custom domain:** Vercel dashboard → project → Settings → Domains.

## Investor materials

Same URLs as the Railway deploy — see `DEPLOY.md`'s "Investor materials"
section; nothing about those routes changes here.
