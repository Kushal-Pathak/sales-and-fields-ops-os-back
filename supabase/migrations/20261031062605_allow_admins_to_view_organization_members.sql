create policy "admins can view organization members"
on public.organization_members
for select
to authenticated
using (
  private.is_organization_admin(organization_id)
);