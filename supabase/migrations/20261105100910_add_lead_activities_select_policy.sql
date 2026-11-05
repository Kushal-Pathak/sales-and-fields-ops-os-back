create policy "users can view accessible lead activities"
on public.lead_activities
for select
to authenticated
using (
  exists (
    select 1
    from public.leads
    where leads.id = lead_activities.lead_id
  )
);