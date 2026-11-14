
-- A composite foreign key needs a matching unique key.
-- This ensures a task can only reference a lead
-- belonging to its own organization.
create unique index leads_organization_id_id_idx
on public.leads (organization_id, id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  lead_id uuid,

  assigned_to uuid,

  created_by uuid
    references auth.users(id) on delete set null,

  title text not null
    check (length(trim(title)) between 1 and 200),

  description text,

  status text not null default 'todo'
    check (status in (
      'todo', 'in_progress', 'completed', 'cancelled'
    )),

  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),

  due_at timestamptz,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_assignee_membership_fk
    foreign key (organization_id, assigned_to)
    references public.organization_members
      (organization_id, user_id)
    on delete set null (assigned_to),

  constraint tasks_organization_lead_fk
    foreign key (organization_id, lead_id)
    references public.leads (organization_id, id)
    on delete set null (lead_id),

  constraint tasks_completion_consistency
    check (
      (status = 'completed') =
      (completed_at is not null)
    )
);

create index tasks_organization_id_idx
on public.tasks (organization_id);

create index tasks_assigned_to_idx
on public.tasks (assigned_to);

create index tasks_lead_id_idx
on public.tasks (lead_id);

create index tasks_due_at_idx
on public.tasks (due_at);

alter table public.tasks enable row level security;
