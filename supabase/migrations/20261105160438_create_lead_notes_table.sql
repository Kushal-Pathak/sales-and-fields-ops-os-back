create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),

  lead_id uuid not null
    references public.leads(id) on delete cascade,

  author_user_id uuid
    references auth.users(id) on delete set null,

  content text not null
    check (length(trim(content)) > 0),

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now()
);

create index lead_notes_lead_id_idx
on public.lead_notes(lead_id);

alter table public.lead_notes
enable row level security;