alter table public.leads
add constraint leads_status_check
check (
  status in (
    'new',
    'contacted',
    'qualified',
    'converted',
    'lost'
  )
);