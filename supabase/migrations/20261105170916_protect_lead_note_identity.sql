create or replace function private.protect_lead_note_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.lead_id is distinct from OLD.lead_id
     or NEW.author_user_id is distinct from OLD.author_user_id
     or NEW.created_at is distinct from OLD.created_at
  then
    raise exception 'Lead note identity fields cannot be changed';
  end if;

  return NEW;
end;
$$;

create trigger lead_notes_protect_identity
before update
on public.lead_notes
for each row
execute function private.protect_lead_note_identity();