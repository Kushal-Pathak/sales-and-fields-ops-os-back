-- 1. Task notes table.

create table public.task_notes (
  id uuid primary key default gen_random_uuid(),

  task_id uuid not null
    references public.tasks(id) on delete cascade,

  author_user_id uuid
    default auth.uid()
    references auth.users(id) on delete set null,

  content text not null
    check (length(trim(content)) between 1 and 5000),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Optimize task note retrieval.

create index task_notes_task_created_idx
on public.task_notes (task_id, created_at desc, id desc);

-- 3. Enable Row Level Security.

alter table public.task_notes
enable row level security;

-- 4. Explicit database privileges.

revoke all on table public.task_notes
from public, anon, authenticated;

grant select, delete
on public.task_notes to authenticated;

grant insert (task_id, content)
on public.task_notes to authenticated;

grant update (content)
on public.task_notes to authenticated;

-- 5. SELECT:
-- Users can read notes only when they can see the parent task.

create policy "view accessible task notes"
on public.task_notes
for select
to authenticated
using (
  exists (
    select 1
    from public.tasks t
    where t.id = task_notes.task_id
  )
);

-- 6. INSERT:
-- Author comes from auth.uid(), not from client input.
-- The parent task must be accessible.

create policy "create accessible task notes"
on public.task_notes
for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.tasks t
    where t.id = task_notes.task_id
  )
);

-- 7. UPDATE:
-- Only the author can edit notes on an accessible task.

create policy "authors update own task notes"
on public.task_notes
for update
to authenticated
using (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.tasks t
    where t.id = task_notes.task_id
  )
)
with check (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.tasks t
    where t.id = task_notes.task_id
  )
);

-- 8. DELETE:
-- Only the author can delete notes on an accessible task.

create policy "authors delete own task notes"
on public.task_notes
for delete
to authenticated
using (
  author_user_id = (select auth.uid())
  and exists (
    select 1
    from public.tasks t
    where t.id = task_notes.task_id
  )
);

-- 9. Maintain updated_at.

create trigger task_notes_set_updated_at
before update on public.task_notes
for each row
execute function public.set_updated_at();