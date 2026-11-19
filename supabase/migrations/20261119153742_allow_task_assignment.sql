
-- Permit task assignment updates.
-- API authorization restricts assignment operations to admins.
--
-- The existing tasks UPDATE RLS policy also prevents staff from
-- changing assigned_to: staff must be the assignee both before
-- and after an UPDATE. Only admins can change its value.
--
-- The existing composite foreign key rejects assignees that
-- do not belong to the task's organization.

grant update (assigned_to)
on table public.tasks
to authenticated;
