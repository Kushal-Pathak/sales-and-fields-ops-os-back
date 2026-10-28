create policy "members can update organization leads"
on public.leads
for update
to authenticated
using (
  organization_id in (
    select private.user_organization_ids()
  )
)
with check (
  organization_id in (
    select private.user_organization_ids()
  )
);