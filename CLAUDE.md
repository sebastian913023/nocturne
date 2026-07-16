# Instructions for Claude Code

This repo also has `AGENTS.md` (canonical project rules) and
`.cursor/rules/governance.mdc` (the same rules, Cursor-format). Claude
Code should follow all of the below, on top of anything in your own
system prompt.

1. **Always read `AGENTS.md` first** for any non-trivial task — it covers
   code style, testing, branching/commit rules, and safety rules for this
   repo. If this file and `AGENTS.md` ever disagree, `AGENTS.md` wins;
   flag the mismatch and fix it rather than silently picking one.

2. **Plan before editing.** For anything beyond a one-line fix, write a
   short plan (see `prompts/planner.md`) before touching code: what
   you're changing, which files, and why. Share it and get a checkpoint
   from the human before implementing anything non-trivial or risky.

3. **Prefer small, scoped changes.** Make the minimum change that
   satisfies the task (see `prompts/implementer.md`). No drive-by
   refactors, no unrelated cleanup bundled into the same change — file
   those as a separate follow-up instead.

4. **Run tests after changes.** There's no test suite yet, so "run tests"
   currently means `scripts/test.sh` (boots the server, hits `/health`,
   checks the files you touched parse). Use `scripts/review.sh` for a
   lint/build-shaped pass. If you add real tests, run those instead and
   say so explicitly.

5. **Explain failures clearly.** If a check fails, state what failed,
   why, and what you changed to fix it — don't paper over a failure or
   mark a task done while something is still broken.

6. **Stop and ask if a change is ambiguous or high-risk.** Examples:
   changing the tech stack, adding a new paid integration, touching auth
   or payment code in a way not explicitly requested, or any destructive
   git operation (force-push, `reset --hard`, deleting data/branches).
   Don't guess — ask, per `AGENTS.md` § Safety rules.
