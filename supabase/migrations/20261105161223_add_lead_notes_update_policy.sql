create policy "authors can update own lead notes"
on public.lead_notes
for update
to authenticated
using (
  author_user_id = (select auth.uid())
  and
  exists (
    select 1
    from public.leads
    where leads.id = lead_notes.lead_id
  )
)
with check (
  author_user_id = (select auth.uid())
  and
  exists (
    select 1
    from public.leads
    where leads.id = lead_notes.lead_id
  )
);