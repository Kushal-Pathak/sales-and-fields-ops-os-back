import { readFileSync } from "node:fs";
import { expect } from "vitest";

// Dedicated integration test Worker.
const API_URL = process.env.TEST_API_URL ?? "http://127.0.0.1:8788";

const TEST_PASSWORD = "Kathmandu@123";

// Same configuration file used by the test Worker.
const envFile = readFileSync(".dev.vars.test", "utf8");

// Read a named variable from .dev.vars.test.
function getTestEnv(name: string): string {
  const line = envFile
    .split(/\r?\n/)
    .find((line) => line.trim().startsWith(`${name}=`));

  if (!line) {
    throw new Error(`Missing ${name} in .dev.vars.test`);
  }

  return line
    .slice(line.indexOf("=") + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

const SUPABASE_URL = getTestEnv("SUPABASE_URL");
const publishableKey = getTestEnv("SUPABASE_PUBLISHABLE_KEY");

// Shared types
export type Session = {
  token: string;
  userId: string;
};

export type Lead = {
  id: string;
  organization_id: string;
  assigned_to: string | null;
  status: string;
};

export type Note = {
  id: string;
  content: string;
  author_user_id: string;
};

export type Activity = {
  event_type: string;
};

export type DataResponse<T> = {
  data: T;
};

export type LeadsResponse = DataResponse<Lead[]> & {
  pagination: {
    total: number;
  };
};

export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};

// Authenticate using local Supabase Auth.
export async function login(email: string): Promise<Session> {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: publishableKey,
      },
      body: JSON.stringify({
        email,
        password: TEST_PASSWORD,
      }),
    },
  );

  const result = (await response.json()) as {
    access_token?: string;
    user?: { id: string };
  };

  expect(response.status, JSON.stringify(result)).toBe(200);
  expect(result.access_token).toBeTruthy();
  expect(result.user?.id).toBeTruthy();

  return {
    token: result.access_token!,
    userId: result.user!.id,
  };
}

// Send authenticated or unauthenticated HTTP requests.
export function apiRequest(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

// Assert an HTTP status and parse the JSON response.
export async function expectJson<T>(
  response: Response,
  expectedStatus: number,
): Promise<T> {
  const result = await response.json();

  expect(response.status, JSON.stringify(result)).toBe(expectedStatus);

  return result as T;
}

// Assert an expected API error.
export async function expectError(
  response: Response,
  status: number,
  code: string,
): Promise<void> {
  const result = await expectJson<ApiError>(response, status);

  expect(result.error.code).toBe(code);
}

// Retrieve leads using the real Worker API.
export async function getLeads(token: string): Promise<LeadsResponse> {
  const response = await apiRequest("GET", "/api/v1/leads?limit=100", token);

  return expectJson<LeadsResponse>(response, 200);
}
