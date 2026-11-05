create trigger lead_notes_set_updated_at
before update
on public.lead_notes
for each row
execute function public.set_updated_at();