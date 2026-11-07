create or replace function private.protect_organization_member_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.user_id is distinct from OLD.user_id
     or NEW.organization_id is distinct from OLD.organization_id
     or NEW.created_at is distinct from OLD.created_at
  then
    raise exception 'Organization membership identity fields cannot be changed';
  end if;

  return NEW;
end;
$$;

create trigger organization_members_protect_identity
before update
on public.organization_members
for each row
execute function private.protect_organization_member_identity();