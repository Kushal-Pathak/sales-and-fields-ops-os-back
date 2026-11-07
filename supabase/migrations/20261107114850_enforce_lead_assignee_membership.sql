alter table public.leads
add constraint leads_assignee_membership_fk
foreign key (organization_id, assigned_to)
references public.organization_members (organization_id, user_id)
on delete set null (assigned_to);