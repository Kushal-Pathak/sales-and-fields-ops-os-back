import type { AppSupabaseClient } from "../../types/supabase";

export async function getLeadActivities(
  supabase: AppSupabaseClient,
  leadId: string,
) {
  return supabase
    .from("lead_activities")
    .select("id, lead_id, actor_user_id, event_type, metadata, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
}
