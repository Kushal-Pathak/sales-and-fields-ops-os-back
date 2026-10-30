import { Context } from "hono";
import { AppEnv } from "../../types/app";
import {
  addLead,
  listLeads,
  findLeadById,
  editLead,
  removeLead,
} from "./leads.service";
import { createLeadSchema, updateLeadSchema } from "./lead.schema";
import { validate } from "../../shared/validation/validate";
import { listLeadsQuerySchema } from "./lead.schema";

export async function listLeadsController(c: Context<AppEnv>) {
  const query = validate(listLeadsQuerySchema, c.req.query());

  const supabase = c.get("supabase");

  const result = await listLeads(supabase, query);

  return c.json({
    data: result.data,
    pagination: { page: query.page, limit: query.limit, total: result.count },
  });
}

export async function getLeadController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    return c.json({ error: "Lead ID is required" }, 400);
  }

  const supabase = c.get("supabase");

  const data = await findLeadById(supabase, leadId);

  return c.json({ data });
}

export async function createLeadController(c: Context<AppEnv>) {
  const body = await c.req.json();

  const input = validate(createLeadSchema, body);

  const supabase = c.get("supabase");

  const organizationId = c.get("organizationId");

  const data = await addLead(supabase, organizationId, input);

  return c.json({ data }, 201);
}

export async function updateLeadController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    return c.json({ error: "Lead ID is required!" }, 400);
  }

  const body = await c.req.json();

  const input = validate(updateLeadSchema, body);

  const supabase = c.get("supabase");

  const data = await editLead(supabase, leadId, input);

  return c.json({ data });
}

export async function deleteLeadController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    return c.json({ error: "Lead ID is required!" }, 400);
  }

  const supabase = c.get("supabase");

  const data = await removeLead(supabase, leadId);

  return c.json({ data });
}
