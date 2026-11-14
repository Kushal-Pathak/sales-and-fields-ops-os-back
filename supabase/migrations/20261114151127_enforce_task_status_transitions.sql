-- Enforce valid task lifecycle changes at the database level.
-- The existing tasks_completion_consistency constraint separately
-- requires completed_at for completed tasks and NULL otherwise.
create or replace function private.enforce_task_status_transitions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean;
begin
  -- Updating other task fields should not change lifecycle state.
  if old.status = new.status then
    return new;
  end if;

  allowed := case old.status
    when 'todo'
      then new.status in ('in_progress', 'completed', 'cancelled')

    when 'in_progress'
      then new.status in ('todo', 'completed', 'cancelled')

    when 'completed'
      then new.status = 'in_progress'

    when 'cancelled'
      then new.status = 'todo'

    else false
  end;

  if allowed is not true then
    raise exception 'Invalid task status transition: % -> %',
      old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger tasks_enforce_status_transitions
before update on public.tasks
for each row
execute function private.enforce_task_status_transitions();
