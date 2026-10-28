create policy "members can delete organization leads"
on public.leads
for delete
to authenticated
using (
  organization_id in (
    select private.user_organization_ids()
  )
);