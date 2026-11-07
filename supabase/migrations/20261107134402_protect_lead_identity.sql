create or replace function private.protect_lead_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.id is distinct from OLD.id
     or NEW.organization_id is distinct from OLD.organization_id
     or NEW.created_at is distinct from OLD.created_at
  then
    raise exception 'Lead identity fields cannot be changed'
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

create trigger leads_protect_identity
before update on public.leads
for each row
execute function private.protect_lead_identity();