create policy "admins can add organization members"
on public.organization_members
for insert
to authenticated
with check (
  private.is_organization_admin(organization_id)
);