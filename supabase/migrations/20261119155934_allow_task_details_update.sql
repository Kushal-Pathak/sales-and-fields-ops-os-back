
-- Permit updates to task detail columns.
-- The existing UPDATE RLS policy restricts accessible rows.
grant update (title, description, priority, due_at, lead_id)
on public.tasks
to authenticated;

-- RLS alone cannot distinguish which columns staff changed.
-- Explicitly require organization-admin membership whenever
-- task details change, including through direct Supabase access.
create or replace function private.protect_task_details()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.priority is distinct from old.priority
    or new.due_at is distinct from old.due_at
    or new.lead_id is distinct from old.lead_id
  ) and not private.is_organization_admin(old.organization_id) then
    raise exception 'Task details require organization admin'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger tasks_protect_details
before update on public.tasks
for each row
execute function private.protect_task_details();
