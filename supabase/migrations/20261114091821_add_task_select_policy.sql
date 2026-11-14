
-- Allow authenticated users to query the table.
-- RLS determines which rows they can actually see.
grant select on public.tasks to authenticated;

create policy "role based task viewing"
on public.tasks
for select
to authenticated
using (
  -- Admins can view all tasks in their organization.
  private.is_organization_admin(organization_id)

  or

  (
    -- Staff must belong to the organization.
    organization_id in (
      select private.user_organization_ids()
    )

    -- Staff can view only their assigned tasks.
    and assigned_to = (select auth.uid())

    -- If linked to a lead, that lead must be accessible.
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
