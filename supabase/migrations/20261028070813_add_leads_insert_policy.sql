create policy "members can create organization leads"
on public.leads
for insert
to authenticated
with check (
  organization_id in (
    select private.user_organization_ids()
  )
);