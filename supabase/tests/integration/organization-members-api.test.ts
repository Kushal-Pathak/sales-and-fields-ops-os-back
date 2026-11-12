import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

import {
  apiRequest,
  expectError,
  expectJson,
  login,
  type DataResponse,
  type Session,
} from "./helpers";

type Member = {
  user_id: string;
  role: "admin" | "staff";
};

describe("Organization Members API - Integration Tests", () => {
  let ram: Session;
  let hari: Session;
  let bina: Session;
  let nima: Session;
  let ajay: Session;

  const PATH = "/api/v1/organization-members";

  beforeAll(async () => {
    [ram, hari, bina, nima, ajay] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("bina@gmail.com"),
      login("nima@gmail.com"),
      login("ajay@gmail.com"),
    ]);
  });

  // --------------------------------------------------
  // 1. AUTHENTICATION AND MEMBER VISIBILITY
  // --------------------------------------------------

  it("rejects unauthenticated requests", async () => {
    const response = await apiRequest("GET", PATH);

    expect(response.status).toBe(401);
  });

  it("admin can list members of their organization", async () => {
    const response = await apiRequest("GET", PATH, ram.token);

    const result = await expectJson<DataResponse<Member[]>>(response, 200);

    const memberIds = result.data.map((member) => member.user_id);

    expect(memberIds).toContain(ram.userId);
    expect(memberIds).toContain(hari.userId);
    expect(memberIds).not.toContain(bina.userId);
  });

  it("another organization's admin sees only their members", async () => {
    const response = await apiRequest("GET", PATH, bina.token);

    const result = await expectJson<DataResponse<Member[]>>(response, 200);

    const memberIds = result.data.map((member) => member.user_id);

    expect(memberIds).toContain(bina.userId);
    expect(memberIds).toContain(nima.userId);
    expect(memberIds).not.toContain(ram.userId);
  });

  it("staff cannot list organization members", async () => {
    const response = await apiRequest("GET", PATH, hari.token);

    await expectError(response, 403, "FORBIDDEN");
  });

  it("users without an organization cannot access members", async () => {
    const response = await apiRequest("GET", PATH, ajay.token);

    await expectError(response, 403, "ORGANIZATION_ACCESS_REQUIRED");
  });

  // --------------------------------------------------
  // 2. MEMBER CREATION PERMISSIONS
  // --------------------------------------------------

  it("staff cannot add organization members", async () => {
    const response = await apiRequest("POST", PATH, hari.token, {
      user_id: ajay.userId,
      role: "staff",
    });

    await expectError(response, 403, "FORBIDDEN");
  });

  it("admin cannot add an existing member again", async () => {
    const response = await apiRequest("POST", PATH, ram.token, {
      user_id: hari.userId,
      role: "staff",
    });

    await expectError(response, 409, "MEMBER_ALREADY_EXISTS");
  });

  it("rejects invalid organization roles", async () => {
    const response = await apiRequest("POST", PATH, ram.token, {
      user_id: ajay.userId,
      role: "superadmin",
    });

    await expectError(response, 400, "VALIDATION_ERROR");
  });

  it("rejects nonexistent users", async () => {
    const response = await apiRequest("POST", PATH, ram.token, {
      user_id: randomUUID(),
      role: "staff",
    });

    await expectError(response, 400, "INVALID_USER");
  });

  // --------------------------------------------------
  // 3. LAST-ADMIN PROTECTION
  // --------------------------------------------------

  it("cannot demote the last organization admin", async () => {
    const response = await apiRequest(
      "PATCH",
      `${PATH}/${bina.userId}/role`,
      bina.token,
      { role: "staff" },
    );

    await expectError(response, 409, "LAST_ADMIN_REQUIRED");
  });

  it("cannot delete the last organization admin", async () => {
    const response = await apiRequest(
      "DELETE",
      `${PATH}/${bina.userId}`,
      bina.token,
    );

    await expectError(response, 409, "LAST_ADMIN_REQUIRED");
  });

  // --------------------------------------------------
  // 4. NONEXISTENT MEMBERS
  // --------------------------------------------------

  it("returns 404 when updating a nonexistent member", async () => {
    const response = await apiRequest(
      "PATCH",
      `${PATH}/${randomUUID()}/role`,
      ram.token,
      { role: "staff" },
    );

    await expectError(response, 404, "ORGANIZATION_MEMBER_NOT_FOUND");
  });

  it("returns 404 when deleting a nonexistent member", async () => {
    const response = await apiRequest(
      "DELETE",
      `${PATH}/${randomUUID()}`,
      ram.token,
    );

    await expectError(response, 404, "ORGANIZATION_MEMBER_NOT_FOUND");
  });
});
