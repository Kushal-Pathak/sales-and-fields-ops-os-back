
-- Allow authenticated users to request deletion.
-- RLS determines which rows they may delete.
grant delete on public.tasks to authenticated;

-- Only organization admins can delete tasks.
create policy "admins can delete tasks"
on public.tasks
for delete
to authenticated
using (
  private.is_organization_admin(organization_id)
);
