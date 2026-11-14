
create or replace function private.protect_task_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Task identity fields must remain unchanged.
  if NEW.id is distinct from OLD.id
     or NEW.organization_id is distinct from OLD.organization_id
     or NEW.created_at is distinct from OLD.created_at
  then
    raise exception 'Task identity fields cannot be changed'
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

create trigger tasks_protect_identity
before update on public.tasks
for each row
execute function private.protect_task_identity();
