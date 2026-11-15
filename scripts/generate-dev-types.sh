#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

# Verify the normal DEV stack is running.
npx --no-install supabase status > /dev/null

# Generate into a temporary file to protect the existing types.
temp_file="$(mktemp src/types/.database.XXXXXX)"
trap 'rm -f "$temp_file"' EXIT

# Supabase CLI v3 targets local DEV by default.
npx --no-install supabase gen types \
  --lang typescript \
  --schema public > "$temp_file"

# Verify the new task table was included.
if ! grep -Eq '"?tasks"?[[:space:]]*:' "$temp_file"; then
  echo "ERROR: Tasks table is missing from generated types."
  exit 1
fi

mv "$temp_file" src/types/database.ts

echo "DEV database types generated successfully."