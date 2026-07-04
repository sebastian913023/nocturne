# Running Nocturne

This is the production implementation of the `Nocturne.dc.html` prototype
(see `README.md` and `chats/` for the original design handoff).

## Stack

- **Backend**: Express + SQLite (`better-sqlite3`), JWT session cookies, Stripe, node-cron.
- **Frontend**: static HTML/CSS/vanilla JS served by the same Express process (`public/`).

## Setup

```
npm install
cp .env.example .env   # then fill in the values below
npm start               # http://localhost:3000
```

## Required environment variables

| Variable | Purpose | Required to run at all? |
|---|---|---|
| `SESSION_SECRET` | Signs the login session cookie | Yes |
| `ANTHROPIC_API_KEY` | Powers real business-name generation, the nightly report, and the AI co-founder chat | No — falls back to a fixed sample business ("Warmwave") and a canned chat reply if unset |
| `STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET` | Real $49/mo Checkout + webhook | No — the "Upgrade" button returns a clear error until these are set |
| `APP_URL` | Used for Stripe Checkout redirect URLs | Only needed once Stripe is configured |

## What's real vs. simulated

- **Real**: accounts (signup/login), persisted business + chat history (SQLite), the Anthropic-backed business
  generation and co-founder chat, the nightly agent-cycle cron job (`server/nightCycle.js`, runs at 03:00 server
  time and also triggerable on demand via `POST /api/business/cycle`), and Stripe Checkout for the flat $49/mo seat.
- **Simulated**: the dashboard's traffic/ad/revenue numbers. Nocturne doesn't actually deploy the generated
  company's website, buy ads on Meta/Google, register its domain, or process payments on its behalf — none of
  that is wired to a real ad account, registrar, hosting provider, or Stripe Connect account for the *created*
  business. The nightly cycle nudges believable numbers and (when `ANTHROPIC_API_KEY` is set) asks Claude to
  narrate a grounded morning report, but it isn't pulling live figures from third-party platforms. Building that
  out for real is a much larger project requiring those third-party integrations/credentials.
- The 20% revenue-share line in the pricing footer is presentational; only the flat $49/mo subscription is
  actually billed through Stripe in this implementation.

## Notes

- `data/nocturne.sqlite` is created on first run and is git-ignored.
- One business per account, matching the original single-company prototype.
