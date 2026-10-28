create table public.organization_members (
  organization_id uuid not null
    references public.organizations(id) on delete cascade,

  user_id uuid not null
    references auth.users(id) on delete cascade,

  role text not null default 'staff',

  created_at timestamptz not null default now(),

  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members(user_id);

alter table public.organization_members enable row level security;