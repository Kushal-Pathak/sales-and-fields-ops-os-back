drop policy "members can update organization leads"
on public.leads;

create policy "role based lead updating"
on public.leads
for update
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
)
with check (
  private.is_organization_admin(organization_id)
  or
  (
    organization_id in (
      select private.user_organization_ids()
    )
    and assigned_to = (select auth.uid())
  )
);