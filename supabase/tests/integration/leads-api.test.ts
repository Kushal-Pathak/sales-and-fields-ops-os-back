import { beforeAll, describe, expect, it } from "vitest";
import { apiRequest, getLeads, login, type Session } from "./helpers";

describe("Leads API - Integration Tests", () => {
  let ram: Session;
  let hari: Session;
  let bina: Session;
  let ajay: Session;

  beforeAll(async () => {
    [ram, hari, bina, ajay] = await Promise.all([
      login("ram@gmail.com"),
      login("hari@gmail.com"),
      login("bina@gmail.com"),
      login("ajay@gmail.com"),
    ]);
  });

  it("rejects unauthenticated requests", async () => {
    const response = await apiRequest("GET", "/api/v1/leads");

    expect(response.status).toBe(401);
  });

  it("keeps leads isolated between organizations", async () => {
    const ramLeads = await getLeads(ram.token);
    const binaLeads = await getLeads(bina.token);

    expect(ramLeads.data.length).toBeGreaterThan(0);
    expect(binaLeads.data.length).toBeGreaterThan(0);

    const ramOrgId = ramLeads.data[0].organization_id;
    const binaOrgId = binaLeads.data[0].organization_id;

    expect(ramOrgId).not.toBe(binaOrgId);

    expect(
      ramLeads.data.every((lead) => lead.organization_id === ramOrgId),
    ).toBe(true);

    expect(
      binaLeads.data.every((lead) => lead.organization_id === binaOrgId),
    ).toBe(true);
  });

  it("only returns leads assigned to staff", async () => {
    const ramLeads = await getLeads(ram.token);
    const hariLeads = await getLeads(hari.token);

    const organizationId = ramLeads.data[0].organization_id;
    const adminLeadIds = new Set(ramLeads.data.map((lead) => lead.id));

    expect(
      hariLeads.data.every(
        (lead) =>
          lead.assigned_to === hari.userId &&
          lead.organization_id === organizationId &&
          adminLeadIds.has(lead.id),
      ),
    ).toBe(true);
  });

  it("hides another organization's lead by ID", async () => {
    const binaLeads = await getLeads(bina.token);
    const foreignLeadId = binaLeads.data[0].id;

    const response = await apiRequest(
      "GET",
      `/api/v1/leads/${foreignLeadId}`,
      ram.token,
    );

    expect(response.status).toBe(404);
  });

  it("rejects users without organization membership", async () => {
    const response = await apiRequest("GET", "/api/v1/leads", ajay.token);

    expect(response.status).toBe(403);

    const result = (await response.json()) as {
      error: { code: string };
    };

    expect(result.error.code).toBe("ORGANIZATION_ACCESS_REQUIRED");
  });
});
