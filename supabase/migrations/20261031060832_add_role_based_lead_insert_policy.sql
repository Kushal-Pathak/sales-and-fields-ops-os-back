drop policy "members can create organization leads"
on public.leads;

create policy "role based lead creation"
on public.leads
for insert
to authenticated
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