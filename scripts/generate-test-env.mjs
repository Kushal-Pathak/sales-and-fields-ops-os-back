
import { execFileSync } from "node:child_process";
import { writeFileSync, chmodSync } from "node:fs";

// Read connection details from the named TEST Supabase stack.
let output;

try {
    output = execFileSync(
        "./node_modules/.bin/supabase",
        ["stack", "status", "--stack", "test", "--env"],
        {
            encoding: "utf8",
            env: {
                ...process.env,
                SUPABASE_EXPERIMENTAL_STACK: "1",
            },
        },
    );
} catch {
    console.error("Could not read TEST Supabase configuration.");
    process.exit(1);
}

// Parse KEY=VALUE output.
const values = {};

for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);

    if (match) {
        values[match[1]] = match[2]
            .trim()
            .replace(/^["']|["']$/g, "");
    }
}

const required = ["API_URL", "PUBLISHABLE_KEY", "SECRET_KEY"];

for (const key of required) {
    if (!values[key]) {
        console.error(`Missing ${key} in TEST Supabase status.`);
        process.exit(1);
    }
}

// Prevent accidental use of a hosted Supabase environment.
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+\/?$/.test(values.API_URL)) {
    console.error("Expected a local TEST Supabase URL.");
    process.exit(1);
}

const config = {
    SUPABASE_URL: values.API_URL,
    SUPABASE_PUBLISHABLE_KEY: values.PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: values.SECRET_KEY,
    FRONTEND_ORIGIN: "http://localhost:5173",
};

const content = Object.entries(config)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n");

writeFileSync(".dev.vars.test", `${content}\n`, {
    mode: 0o600,
});

chmodSync(".dev.vars.test", 0o600);

console.log("Generated .dev.vars.test for TEST Supabase.");
console.log("Supabase URL:", values.API_URL);
console.log("Credentials: hidden");
