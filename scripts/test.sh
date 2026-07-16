#!/usr/bin/env bash
# Minimal verification: no test framework exists in this repo yet, so this
# checks syntax on every server/frontend JS file, then boots the server and
# hits /health. Replace with `npm test` once real tests exist.
set -uo pipefail
cd "$(dirname "$0")/.."

FAIL=0

echo "== syntax check: server/**/*.js =="
for f in $(find server -name '*.js'); do
  node --check "$f" || FAIL=1
done

echo "== syntax check: public/js/*.js =="
for f in public/js/*.js; do
  node --check "$f" || FAIL=1
done

if [ "$FAIL" -ne 0 ]; then
  echo "FAIL: syntax errors above"
  exit 1
fi

echo "== boot check =="
if [ ! -f .env ]; then
  echo "SKIP boot check: no .env present (copy .env.example and set SESSION_SECRET to enable)"
  exit 0
fi

node server/index.js > /tmp/nocturne-test-server.log 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

for i in $(seq 1 20); do
  if curl -sf localhost:"${PORT:-3000}"/health > /dev/null 2>&1; then
    echo "PASS: /health responded"
    exit 0
  fi
  sleep 0.3
done

echo "FAIL: server did not respond on /health — log:"
cat /tmp/nocturne-test-server.log
exit 1
