#!/usr/bin/env bash
# Simple integration smoke test against a running local compose stack.
set -euo pipefail
BASE_URL="${BASE_URL:-http://localhost:5173}"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT
LOGIN="smoke_$(date +%s)_$RANDOM"
COOKIE="$WORKDIR/cookies"

printf 'Creating account %s\n' "$LOGIN"
REGISTER=$(curl -fsS -c "$COOKIE" -H 'Content-Type: application/json' -d "{\"login\":\"$LOGIN\",\"password\":\"sample-password-12345\"}" "$BASE_URL/api/auth/register")
CSRF=$(printf '%s' "$REGISTER" | python3 -c 'import json,sys; print(json.load(sys.stdin)["csrf_token"])')

printf 'Creating a note\n'
curl -fsS -b "$COOKIE" -H "X-CSRF-Token: $CSRF" -H 'Content-Type: application/json' -d '{"text":"Hello from the smoke test"}' "$BASE_URL/api/items/text" > "$WORKDIR/note.json"

printf 'Uploading a file\n'
printf 'sample file content\n' > "$WORKDIR/example.txt"
curl -fsS -b "$COOKIE" -H "X-CSRF-Token: $CSRF" -F "file=@$WORKDIR/example.txt" -F 'caption=Test upload' "$BASE_URL/api/items/file" > "$WORKDIR/file.json"
FILE_ID=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["id"])' "$WORKDIR/file.json")
curl -fsS -b "$COOKIE" "$BASE_URL/api/items/$FILE_ID/download" > "$WORKDIR/downloaded.txt"
cmp "$WORKDIR/example.txt" "$WORKDIR/downloaded.txt"

printf 'Checking another account cannot download the file\n'
OTHER_LOGIN="guest_$(date +%s)_$RANDOM"
curl -fsS -c "$WORKDIR/other-cookies" -H 'Content-Type: application/json' \
  -d "{\"login\":\"$OTHER_LOGIN\",\"password\":\"different-password-12345\"}" \
  "$BASE_URL/api/auth/register" > "$WORKDIR/other-user.json"
HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$WORKDIR/other-cookies" "$BASE_URL/api/items/$FILE_ID/download")
if [ "$HTTP_CODE" != "404" ]; then
  echo "Expected 404 for another account, got $HTTP_CODE" >&2
  exit 1
fi

printf 'Checking item list\n'
curl -fsS -b "$COOKIE" "$BASE_URL/api/items" > "$WORKDIR/items.json"
python3 - "$WORKDIR/items.json" <<'PY'
import json, sys
result = json.load(open(sys.argv[1]))
assert result['total'] >= 2, result
print(f"OK: {result['total']} objects visible to account")
PY
printf 'Smoke test finished successfully\n'
