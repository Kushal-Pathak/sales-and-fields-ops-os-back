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

export async function listLeadsController(c: Context<AppEnv>) {
  const supabase = c.get("supabase");

  const { data, error } = await listLeads(supabase);

  if (error) {
    return c.json({ error: error.message }, 500);
  }

  return c.json({ data });
}

export async function getLeadController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    return c.json({ error: "Lead ID is required" }, 400);
  }

  const supabase = c.get("supabase");

  const { data, error } = await findLeadById(supabase, leadId);

  if (error || !data) {
    return c.json({ error: "Lead not found!" }, 404);
  }

  return c.json({ data });
}

export async function createLeadController(c: Context<AppEnv>) {
  const body = await c.req.json();

  const result = createLeadSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid request data!", issues: result.error.issues },
      400,
    );
  }

  const supabase = c.get("supabase");

  const { data, error } = await addLead(supabase, result.data);

  if (error) {
    return c.json({ error: error.message }, 400);
  }

  return c.json({ data }, 201);
}

export async function updateLeadController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    return c.json({ error: "Lead ID is required!" }, 400);
  }

  const body = await c.req.json();

  const result = updateLeadSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid request data", issues: result.error.issues },
      400,
    );
  }

  const supabase = c.get("supabase");

  const { data, error } = await editLead(supabase, leadId, result.data);

  if (error || !data) {
    return c.json({ error: "Lead not found or update failed!" }, 404);
  }

  return c.json({ data });
}

export async function deleteLeadController(c: Context<AppEnv>) {
  const leadId = c.req.param("id");

  if (!leadId) {
    return c.json({ error: "Lead ID is required!" }, 400);
  }

  const supabase = c.get("supabase");

  const { data, error } = await removeLead(supabase, leadId);

  if (error || !data) {
    return c.json({ error: "Lead not found or deletion failed!" }, 404);
  }

  return c.json({ data });
}
