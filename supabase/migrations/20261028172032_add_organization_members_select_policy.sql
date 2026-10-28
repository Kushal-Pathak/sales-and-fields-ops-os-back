create policy "users can view own memberships"
on public.organization_members
for select
to authenticated
using (
  user_id = (select auth.uid())
);