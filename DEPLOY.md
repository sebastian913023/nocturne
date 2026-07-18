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
   `npm install` (this installs `better-sqlite3`, which compiles a native
   module — Nixpacks includes the build toolchain needed for this, no
   extra config required).
3. **Start command:** `npm start` (already set in `railway.json` /
   `package.json`).
4. **Add a persistent volume.** The app stores its SQLite database at
   `data/nocturne.sqlite` (relative to the repo root, see `server/db.js`).
   Railway's container filesystem does **not** persist across redeploys
   without a volume. In the Railway dashboard: service → **Volumes** → add
   a volume mounted at `/app/data`. Without this, every redeploy wipes all
   accounts, businesses, and chat history.
5. **Set environment variables** (Railway dashboard → service →
   Variables). None are required for the server to boot, but most real
   functionality depends on them — see the table in `RUNNING.md` for what
   each one unlocks:

   | Variable | Required for |
   |---|---|
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
