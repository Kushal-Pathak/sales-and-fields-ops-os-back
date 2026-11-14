
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export SUPABASE_EXPERIMENTAL_STACK=1

echo "Preparing TEST database..."
npx --no-install supabase stack start --stack test

# Read the TEST database connection automatically.
db_url="$(
  npx --no-install supabase stack status --stack test --env --output-format text |
  sed -nE 's/^[[:space:]]*(export[[:space:]]+)?DB_URL[[:space:]]*=[[:space:]]*//p' |
  head -n 1 |
  tr -d '\r"'"'"
)"

if [ -z "$db_url" ]; then
  echo "ERROR: Could not find TEST database URL."
  exit 1
fi

# Validate the connection using Node.js instead of
# a restrictive regular expression.
DB_URL="$db_url" node - <<'NODE'
const raw = process.env.DB_URL;

let url;
try {
  url = new URL(raw);
} catch {
  console.error("ERROR: Invalid database URL.");
  process.exit(1);
}

const isLocal = ["127.0.0.1", "localhost"].includes(url.hostname);
const isPostgres = ["postgres:", "postgresql:"].includes(url.protocol);
const isExpectedDatabase =
  url.username === "postgres" &&
  url.pathname === "/postgres" &&
  Number(url.port) > 0;

if (!isLocal || !isPostgres || !isExpectedDatabase) {
  console.error("ERROR: Refusing non-local or unexpected database.");
  process.exit(1);
}

console.log("Verified local TEST database connection.");
NODE

echo "Applying pending migrations..."
npx --no-install supabase db push --db-url "$db_url" --yes

echo "TEST migrations applied successfully."
