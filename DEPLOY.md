# Deploying Nocturne to Railway

This file documents deployment only — it does not change anything in
`server/`, `public/js/`, or any other application source. See `RUNNING.md`
for how the app itself works and what's real vs. simulated.

## What's in this repo for deploy

- `railway.json` — tells Railway to build with Nixpacks and run `npm start`,
  with a health check on `/health` (the route already exposed by
  `server/index.js`).
- `public/pitch-deck.html`, `public/investors.html`, `public/brand-kit.html`
  — new static pages (investor materials), served automatically by the
  app's existing `express.static(public/)` middleware. No server code was
  changed to add them.

## Steps

1. **Create the Railway project.** Railway dashboard → New Project →
   Deploy from GitHub repo → select this repo and branch.
2. **Build:** Railway auto-detects Node via Nixpacks and runs
   `npm install` (pure-JS dependencies only — no native build step).
3. **Start command:** `npm start` (already set in `railway.json` /
   `package.json`).
4. **Connect the database.** The app stores everything in Postgres (Neon).
   Copy the **pooled** connection string from the Neon dashboard
   (Connect → Pooled connection) and set it as `DATABASE_URL` in step 5.
   Tables are created automatically on first boot (`server/db.js`), and no
   volume is needed — data lives in Neon, so redeploys never wipe it.
5. **Set environment variables** (Railway dashboard → service →
   Variables). `DATABASE_URL` and `SESSION_SECRET` are required for the
   server to boot; the rest unlock features — see the table in `RUNNING.md`
   for what each one does:

   | Variable | Required for |
   |---|---|
   | `DATABASE_URL` | **Required.** Neon pooled Postgres connection string |
   | `SESSION_SECRET` | Login sessions to work at all — set this even for a demo deploy |
   | `ANTHROPIC_API_KEY` | Real AI business generation + co-founder chat (falls back to a fixed sample otherwise) |
   | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Real $49/mo Checkout |
   | `APP_URL` | Set to your Railway public URL (or custom domain) once known — used for Stripe Checkout redirects |

   `PORT` is injected automatically by Railway — don't set it manually.
6. **Health check:** already configured (`/health`, in `railway.json`).
7. **Custom domain:** Railway dashboard → service → Settings → Domains.

## Investor materials

Once deployed, share:

- `/investors` — investor preview hub (links everything below)
- `/pitch-deck` — the 12-slide pitch deck
- `/brand-kit` — full brand system
- `/` — the live product itself

Use the `.html` extension: `/pitch-deck.html`, `/investors.html`,
`/brand-kit.html`. `server/index.js`'s `express.static` middleware serves
an exact file match before falling through to the catch-all route that
serves `public/index.html` (the app) for everything else — so the
extension-less paths (`/pitch-deck`, `/investors`, `/brand-kit`) currently
resolve to the app, not these pages, since no `extensions` option is
configured on the static middleware. All internal links between the
investor pages already use the `.html` form.
