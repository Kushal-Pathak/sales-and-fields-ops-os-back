create or replace function private.is_organization_admin(org_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function private.is_organization_admin(uuid) from public;

grant execute
on function private.is_organization_admin(uuid)
to authenticated;