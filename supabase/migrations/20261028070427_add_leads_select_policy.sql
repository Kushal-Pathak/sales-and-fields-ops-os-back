create policy "members can view organization leads"
on public.leads
for select
to authenticated
using (
  organization_id in (
    select private.user_organization_ids()
  )
);