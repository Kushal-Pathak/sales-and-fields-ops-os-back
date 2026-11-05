create trigger leads_record_activity
after insert or update
on public.leads
for each row
execute function private.record_lead_activity();