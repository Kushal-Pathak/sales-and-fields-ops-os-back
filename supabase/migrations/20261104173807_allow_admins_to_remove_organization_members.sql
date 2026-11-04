create policy "admins can delete organization members"
on public.organization_members
for delete
to authenticated
using (
  private.is_organization_admin(organization_id)
);