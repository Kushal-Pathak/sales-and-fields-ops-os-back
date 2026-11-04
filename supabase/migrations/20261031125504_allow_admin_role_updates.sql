create policy "admins can update organization members"
on public.organization_members
for update
to authenticated
using (
  private.is_organization_admin(organization_id)
)
with check (
  private.is_organization_admin(organization_id)
);