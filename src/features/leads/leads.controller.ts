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

export async function listLeadsController(c: Context<AppEnv>) {
  const supabase = c.get("supabase");

  const data = await listLeads(supabase);

  return c.json({ data });
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

  const data = await addLead(supabase, input);

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
