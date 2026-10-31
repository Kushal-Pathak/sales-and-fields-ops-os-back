drop policy "members can delete organization leads"
on public.leads;

create policy "admins can delete organization leads"
on public.leads
for delete
to authenticated
using (
  private.is_organization_admin(organization_id)
);