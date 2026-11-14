
-- Automatically record the authenticated task creator.
alter table public.tasks
alter column created_by set default auth.uid();

-- Grant only the currently supported operations.
revoke all on table public.tasks
from public, anon, authenticated;

grant select, insert on public.tasks
to authenticated;

-- Only organization admins may create tasks.
-- The creator must be the authenticated user.
create policy "admins can create tasks"
on public.tasks
for insert
to authenticated
with check (
  private.is_organization_admin(organization_id)
  and created_by = (select auth.uid())
);
