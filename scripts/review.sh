#!/usr/bin/env bash
# Review helper: shows what changed vs. the default branch. No linter is
# configured in this repo yet (no ESLint/Prettier config present) — add one
# deliberately if the project grows, rather than assuming here.
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${1:-main}"

echo "== diff stat vs $BASE =="
git diff --stat "$BASE"...HEAD 2>/dev/null || git diff --stat

echo
echo "== full diff vs $BASE =="
git diff "$BASE"...HEAD 2>/dev/null || git diff

echo
echo "== reminder =="
echo "No lint/formatter is configured in this repo. If you add one,"
echo "wire it into this script instead of inventing an ad hoc check here."
