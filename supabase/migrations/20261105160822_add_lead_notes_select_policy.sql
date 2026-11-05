create policy "users can view accessible lead notes"
on public.lead_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.leads
    where leads.id = lead_notes.lead_id
  )
);