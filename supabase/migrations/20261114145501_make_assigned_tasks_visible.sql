
-- Task access is determined by assignment,
-- independently of linked lead visibility.

drop policy "role based task viewing"
on public.tasks;

create policy "role based task viewing"
on public.tasks
for select
to authenticated
using (
  private.is_organization_admin(organization_id)

  or

  (
    organization_id in (
      select private.user_organization_ids()
    )
    and assigned_to = (select auth.uid())
  )
);

-- Keep UPDATE permissions consistent with SELECT.
drop policy "role based task progress updating"
on public.tasks;

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
  )
)
with check (
  private.is_organization_admin(organization_id)

  or

  (
    organization_id in (
      select private.user_organization_ids()
    )
    and assigned_to = (select auth.uid())
  )
);
