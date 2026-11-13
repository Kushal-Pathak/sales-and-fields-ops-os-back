
#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")/.."

export SUPABASE_EXPERIMENTAL_STACK=1

started_stack=false
project_dir="$(basename "$PWD")"

# Find only the named TEST database container.
find_test_db() {
  docker ps --format '{{.Names}}' |
    awk -v prefix="supabase-${project_dir}-test-database-" '
      index($0, prefix) == 1 {
        suffix = substr($0, length(prefix) + 1)
        if (suffix ~ /^[0-9a-f]+$/) print
      }
    '
}

cleanup() {
  exit_code=$?
  trap - EXIT

  if [ "$started_stack" = true ]; then
    echo "Stopping TEST Supabase..."
    npx supabase stack stop --stack test || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT

container="$(find_test_db)"

if [ -z "$container" ]; then
  echo "Starting TEST Supabase..."
  npx supabase stack start --stack test
  started_stack=true
  container="$(find_test_db)"
fi

# Never guess which database to use.
if [ -z "$container" ] || [[ "$container" == *$'\n'* ]]; then
  echo "ERROR: Could not uniquely identify TEST database container."
  exit 1
fi

echo "Using TEST database: $container"

# Copy the latest SQL test files into the container.
docker cp supabase/tests/001_crm_rls.test.sql \
  "$container:/tmp/001_crm_rls.test.sql"

docker cp supabase/tests/002_crm_constraints.test.sql \
  "$container:/tmp/002_crm_constraints.test.sql"

echo "Running 49 database tests..."

docker exec \
  -e PGHOST=127.0.0.1 \
  -e PGPORT=5432 \
  -e PGUSER=postgres \
  -e PGPASSWORD=postgres \
  -e PGDATABASE=postgres \
  "$container" \
  pg_prove \
    /tmp/001_crm_rls.test.sql \
    /tmp/002_crm_constraints.test.sql
