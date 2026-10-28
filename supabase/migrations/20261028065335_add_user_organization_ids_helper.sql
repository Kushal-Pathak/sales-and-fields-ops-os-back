create schema if not exists private;

create or replace function private.user_organization_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select organization_id
  from public.organization_members
  where user_id = (select auth.uid());
$$;

revoke execute on function private.user_organization_ids() from public;

grant usage on schema private to authenticated;
grant execute on function private.user_organization_ids() to authenticated;