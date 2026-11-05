create policy "authors can delete own lead notes"
on public.lead_notes
for delete
to authenticated
using (
  author_user_id = (select auth.uid())
  and
  exists (
    select 1
    from public.leads
    where leads.id = lead_notes.lead_id
  )
);