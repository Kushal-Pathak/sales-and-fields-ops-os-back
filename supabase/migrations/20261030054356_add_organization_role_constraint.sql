alter table public.organization_members
add constraint organization_members_role_check
check (
  role in (
    'admin',
    'staff'
  )
);