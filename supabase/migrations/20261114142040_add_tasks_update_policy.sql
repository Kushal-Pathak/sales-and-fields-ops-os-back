
-- Only task progress fields can be updated directly.
grant update (status, completed_at)
on public.tasks
to authenticated;

-- Admins may update task progress throughout their organization.
-- Staff may update only their visible, assigned tasks.
create policy "role based task progress updating"
on public.tasks
for update
to authenticated
using (
  private.is_organization_admin(organization_id)

  or

  (
    organization_id in (
      select private.user_organization_ids()
    )
    and assigned_to = (select auth.uid())

    and (
      lead_id is null
      or exists (
        select 1
        from public.leads
        where leads.id = tasks.lead_id
          and leads.organization_id = tasks.organization_id
      )
    )
  )
);

-- Automatically maintain updated_at.
create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();
