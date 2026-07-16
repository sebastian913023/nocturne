#!/usr/bin/env bash
# Planning helper: surfaces the context a Planner needs before writing a
# plan. Doesn't generate the plan itself — that's the agent's job.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== AGENTS.md =="
cat AGENTS.md
echo
echo "== prompts/planner.md =="
cat prompts/planner.md
echo
echo "== git status =="
git status --short --branch
echo
echo "== recent commits =="
git log --oneline -10
