create policy "users can create accessible lead notes"
on public.lead_notes
for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and
  exists (
    select 1
    from public.leads
    where leads.id = lead_notes.lead_id
  )
);