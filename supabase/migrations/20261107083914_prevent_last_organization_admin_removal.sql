create or replace function private.prevent_last_admin_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_count integer;
begin
  -- Only check when an admin is being demoted or deleted
  if TG_OP = 'UPDATE' then
    if OLD.role <> 'admin' or NEW.role = 'admin' then
      return NEW;
    end if;
  elsif TG_OP = 'DELETE' then
    if OLD.role <> 'admin' then
      return OLD;
    end if;
  end if;

  -- Lock the organization so concurrent checks wait
  perform 1
  from public.organizations
  where id = OLD.organization_id
  for update;

  -- Count admins after acquiring the lock
  select count(*) into admin_count
  from public.organization_members
  where organization_id = OLD.organization_id
    and role = 'admin';

  if admin_count <= 1 then
    raise exception 'Cannot remove the last organization admin'
      using errcode = '23514';
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;

  return NEW;
end;
$$;