create table public.leads (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  assigned_to uuid
    references auth.users(id) on delete set null,

  first_name text not null,
  last_name text,
  email text,
  phone text,

  status text not null default 'new',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_organization_id_idx
  on public.leads(organization_id);

create index leads_assigned_to_idx
  on public.leads(assigned_to);

alter table public.leads enable row level security;