alter table public.organizations enable row level security;

revoke all on table public.organizations from anon, authenticated;