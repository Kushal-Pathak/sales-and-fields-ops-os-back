#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

export SUPABASE_EXPERIMENTAL_STACK=1

# Get the local TEST database URL.
db_url="$(
  npx --no-install supabase stack status \
    --stack test --env --output-format text |
  sed -nE 's/^[[:space:]]*(export[[:space:]]+)?DB_URL[[:space:]]*=[[:space:]]*//p' |
  head -n 1 |
  tr -d "\r\"'"
)"

if [ -z "$db_url" ]; then
  echo "ERROR: TEST database URL not found."
  exit 1
fi

# Protect existing generated types.
temp_file="$(mktemp src/types/.database.XXXXXX)"
trap 'rm -f "$temp_file"' EXIT

# Generate types from TEST database.
# Generate types and discard CLI messages appearing before TypeScript.
# pipefail ensures generation errors are still detected.
npx --no-install supabase gen types \
  --lang typescript \
  --schema public \
  --db-url "$db_url" |
  sed -n '/^export type Json[[:space:]]*=/,$p' \
  > "$temp_file"

# Verify required tables exist.
for table in tasks task_notes; do
  if ! grep -Eq "\"?${table}\"?[[:space:]]*:" "$temp_file"; then
    echo "ERROR: $table table missing from generated types."
    exit 1
  fi
done

mv "$temp_file" src/types/database.ts

echo "TEST database types generated successfully."