create or replace function private.record_lead_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

  -- When a lead is created
  if TG_OP = 'INSERT' then
    insert into public.lead_activities (
      lead_id, actor_user_id, event_type, metadata
    )
    values (
      NEW.id,
      auth.uid(),
      'lead_created',
      jsonb_build_object('status', NEW.status)
    );

    return NEW;
  end if;

  -- When an existing lead is updated
  if TG_OP = 'UPDATE' then

    -- Record status changes
    if OLD.status is distinct from NEW.status then
      insert into public.lead_activities (
        lead_id, actor_user_id, event_type, metadata
      )
      values (
        NEW.id,
        auth.uid(),
        'status_changed',
        jsonb_build_object(
          'old_status', OLD.status,
          'new_status', NEW.status
        )
      );
    end if;

    -- Record assignment changes
    if OLD.assigned_to is distinct from NEW.assigned_to then
      insert into public.lead_activities (
        lead_id, actor_user_id, event_type, metadata
      )
      values (
        NEW.id,
        auth.uid(),
        'assignment_changed',
        jsonb_build_object(
          'old_assignee', OLD.assigned_to,
          'new_assignee', NEW.assigned_to
        )
      );
    end if;

  end if;

  return NEW;
end;
$$;