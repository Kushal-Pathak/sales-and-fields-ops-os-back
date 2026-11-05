create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),

  lead_id uuid not null
    references public.leads(id) on delete cascade,

  actor_user_id uuid
    references auth.users(id) on delete set null,

  event_type text not null,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index lead_activities_lead_id_idx
on public.lead_activities(lead_id);

alter table public.lead_activities
enable row level security;