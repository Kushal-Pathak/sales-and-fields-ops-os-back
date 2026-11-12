import { readFileSync } from "node:fs";
import { expect } from "vitest";

const API_URL = "http://127.0.0.1:8787";
const SUPABASE_URL = "http://127.0.0.1:54321";
const TEST_PASSWORD = "Kathmandu@123";

// Local test environment only.
const envFile = readFileSync(".dev.vars", "utf8");

const keyLine = envFile
  .split(/\r?\n/)
  .find((line) => line.trim().startsWith("SUPABASE_PUBLISHABLE_KEY="));

if (!keyLine) {
  throw new Error("Missing SUPABASE_PUBLISHABLE_KEY in .dev.vars");
}

const publishableKey = keyLine
  .split("=")
  .slice(1)
  .join("=")
  .trim()
  .replace(/^["']|["']$/g, "");

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
