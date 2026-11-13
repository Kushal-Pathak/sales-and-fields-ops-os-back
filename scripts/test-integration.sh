
#!/usr/bin/env bash

set -euo pipefail

# Run from the backend project root.
cd "$(dirname "$0")/.."

# Enable Supabase's experimental stack manager.
export SUPABASE_EXPERIMENTAL_STACK=1

started_stack=false

# Check whether the test database is actually running.
stack_status="$(npx supabase stack status --stack test 2>&1 || true)"

if echo "$stack_status" | grep -Eq 'database.*running'; then
  echo "Test database is already running. Reusing it."
else
  echo "Starting isolated test database..."
  npx supabase stack start --stack test
  started_stack=true
fi

# Clean up when the script finishes, including on test failure.
cleanup() {
  exit_code=$?

  trap - EXIT

  if [ "$started_stack" = true ]; then
    echo "Stopping isolated test database..."
    npx supabase stack stop --stack test || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT

node scripts/generate-test-env.mjs

# Ask the operating system to find an available local port.
export TEST_WORKER_PORT="$(
  node -e '
    const net = require("node:net");
    const server = net.createServer();

    server.listen(0, "127.0.0.1", () => {
      console.log(server.address().port);
      server.close();
    });
  '
)"

# Tell integration tests where the Worker will run.
export TEST_API_URL="http://127.0.0.1:${TEST_WORKER_PORT}"

echo "Using TEST Worker port: ${TEST_WORKER_PORT}"

echo "Starting test Worker and running integration tests..."

# Start Worker, wait for /health, execute tests,
# then automatically stop the Worker.
npx --no-install start-server-and-test \
  dev:test \
  "$TEST_API_URL/health" \
  test:integration
