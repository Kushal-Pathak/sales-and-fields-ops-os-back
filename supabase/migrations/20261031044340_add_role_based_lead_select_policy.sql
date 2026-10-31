drop policy "members can view organization leads"
on public.leads;

create policy "role based lead viewing"
on public.leads
for select
to authenticated
using (
  private.is_organization_admin(organization_id)

  or

  (
    organization_id in (
      select private.user_organization_ids()
    )
    and assigned_to = (select auth.uid())
  )
);