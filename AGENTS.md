# AGENTS.md — Project Constitution

This file is the canonical source of truth for how humans and AI agents
(Claude Code, Cursor, Codex, or anything else) work in this repository.
If any other rules file disagrees with this one, this one wins — fix the
other file instead of picking a side silently.

## 1. Project purpose

Nocturne is an AI co-founder product: a user describes a business idea,
the app generates a brand/name/domain via Claude, "builds" the company
(landing page copy, checkout, an agent team), then simulates running it
autonomously — a nightly report, live metrics, and a co-founder chat.

Stack: Node.js + Express backend, SQLite (`better-sqlite3`), Stripe,
vanilla HTML/CSS/JS frontend (no framework, no build step). See
`RUNNING.md` for setup and `README.md` / `chats/` for the original design
handoff this was built from.

## 2. Code style rules

- No build step on the frontend — plain `<script src>` files sharing the
  global scope (`public/js/*.js`). Keep that pattern; don't introduce a
  bundler without discussing it first.
- Backend: CommonJS (`require`/`module.exports`), matching `server/`.
- No comments that explain *what* code does — only *why*, when the reason
  isn't obvious from reading it (see existing files for the bar).
- Don't add abstractions, config flags, or "just in case" error handling
  for cases that can't happen. Match the scope of the task.
- Security: the Anthropic API key and Stripe secret key never reach the
  browser. All third-party API calls happen server-side
  (`server/anthropic.js`, `server/routes/billing.js`).

## 3. Testing rules

- There is no automated test suite yet. Until one exists, "tested" means:
  the server boots (`npm start`), `/health` returns 200, and the specific
  endpoints/flows you touched were exercised (curl or a browser) and
  behave as expected — see `scripts/test.sh`.
- If you add real tests, prefer Node's built-in `node:test` runner (no new
  dependency) unless there's a specific reason to add a framework.
- Never mark work done with failing tests, partial implementations, or
  unresolved errors.

## 4. Branching / commit rules

- Default branch: `main`. Do not force-push to it.
- Non-trivial work happens on a feature branch (`feat/…`, `fix/…`),
  opened as a PR — don't commit directly to `main` for anything beyond a
  small, obviously-safe fix.
- Commits are scoped and describe *why*, not a restatement of the diff.
- Never `--no-verify`, `--no-gpg-sign`, or otherwise bypass hooks/checks
  without the user explicitly asking for it.
- Never amend or force-push commits that are already pushed/shared unless
  explicitly asked.

## 5. Agent workflow rules

Standard flow for any non-trivial change: **Planner → Implementer →
Verifier → Reviewer** (see `prompts/`).

- **Planner** reads this file and the task, produces a short plan before
  any code is written.
- **Implementer** makes the minimum change that satisfies the plan. No
  drive-by refactors, no unrelated cleanup in the same change.
- **Verifier** runs whatever tests/lint/build exist (`scripts/test.sh`)
  and reports pass/fail plainly — it does not "fix forward" silently.
- **Reviewer** checks architecture fit, security, and drift from this
  file (`prompts/reviewer.md`).
- One checkpoint per session: pause for human confirmation after the plan
  and before merging, not at every intermediate step.
- Prefer a branch per non-trivial task so changes stay isolated and
  reviewable; don't mix unrelated tasks in one branch/PR.

## 6. Safety rules

- Never commit secrets (`.env`, API keys, Stripe keys). `.env` is
  git-ignored — keep it that way.
- Destructive operations (force-push, `git reset --hard`, dropping the
  SQLite file, deleting branches) require explicit human confirmation —
  never do these autonomously.
- If a task is ambiguous, spans a much larger scope than requested, or
  requires a judgment call the user hasn't made (e.g. changing the tech
  stack, adding a new paid integration), **stop and ask** instead of
  guessing.
- Don't weaken security middleware (CSP headers, rate limiting, session
  cookie flags in `server/index.js` / `server/auth.js`) to make a task
  easier — fix the actual blocker instead.
