create or replace function private.enforce_lead_status_transitions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  allowed boolean;
begin
  -- No status change? Allow the update.
  if OLD.status = NEW.status then
    return NEW;
  end if;

  -- Check whether the requested transition is allowed.
  allowed := case OLD.status
    when 'new'
      then NEW.status in ('contacted', 'lost')

    when 'contacted'
      then NEW.status in ('qualified', 'lost')

    when 'qualified'
      then NEW.status in ('converted', 'lost')

    when 'converted'
      then false

    when 'lost'
      then NEW.status = 'new'

    else false
  end;

  if allowed is not true then
    raise exception 'Invalid lead status transition: % -> %',
      OLD.status, NEW.status
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

create trigger leads_enforce_status_transitions
before update on public.leads
for each row
execute function private.enforce_lead_status_transitions();