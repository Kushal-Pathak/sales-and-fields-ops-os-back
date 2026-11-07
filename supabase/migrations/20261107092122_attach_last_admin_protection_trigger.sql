create trigger organization_members_prevent_last_admin_removal
before update or delete
on public.organization_members
for each row
execute function private.prevent_last_admin_removal();