-- LOCAL DEVELOPMENT / TESTING ONLY.
-- Never run this file against a hosted or production database.
-- Test credentials below are intentionally public and must never be reused.
-- All Gmail addresses below are fictional placeholders; DO NOT send real email to them.
-- Requires the existing CRM migrations to have been applied first.

begin;

-- 1. Supabase Auth users (password sign-in enabled for realistic RLS tests).
-- Every account below uses the LOCAL-ONLY password: Kathmandu@123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, confirmation_token, email_change,
  email_change_token_new, recovery_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  users.id::uuid,
  'authenticated',
  'authenticated',
  users.email,
  extensions.crypt('Kathmandu@123', extensions.gen_salt('bf')),
  now(), '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', users.full_name),
  now(), now()
from (values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'ram@gmail.com', 'Ram Shrestha'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'sita@gmail.com', 'Sita Thapa'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'hari@gmail.com', 'Hari Gurung'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'gita@gmail.com', 'Gita Karki'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'bina@gmail.com', 'Bina Adhikari'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'nima@gmail.com', 'Nima Poudel'),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'ajay@gmail.com', 'Ajay Rai')
) as users(id, email, full_name);

-- Email identities are required for these users to sign in through Supabase Auth.
insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, created_at, updated_at
)
select
  gen_random_uuid(),
  id,
  id::text,
  'email',
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  now(), now()
from auth.users
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',
  'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
);

-- 2. Organizations.
insert into public.organizations (id, name) values
  ('11111111-1111-4111-8111-111111111111', 'Northwind Field Services'),
  ('22222222-2222-4222-8222-222222222222', 'BluePeak Solar');

-- 3. Members: Northwind has TWO admins; BluePeak has ONE (last-admin test).
-- The outsider is deliberately NOT a member of any organization.
insert into public.organization_members (organization_id, user_id, role) values
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'admin'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'admin'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'staff'),
  ('11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'staff'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'admin'),
  ('22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'staff');

-- 4. Leads. Created under an authenticated local test-user context so
-- the existing database activity trigger records a realistic actor_user_id.
select set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);

insert into public.leads (
  id, organization_id, assigned_to, first_name, last_name, email, phone
) values
  ('10000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Anil', 'Shrestha', 'anil@gmail.com', '+15550001001'),
  ('10000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Pooja', 'Thapa', 'pooja@gmail.com', '+15550001002'),
  ('10000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111', null, 'Ramesh', 'Karki', 'ramesh@gmail.com', null),
  ('10000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Sarita', 'Gurung', 'sarita@gmail.com', '+15550001004'),
  ('10000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Prakash', 'Rai', 'prakash@gmail.com', null),
  ('10000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Mina', 'Adhikari', 'mina@gmail.com', null);

-- Exercise allowed status transitions to build actual trigger-generated history.
update public.leads set status = 'contacted' where id in (
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
);
update public.leads set status = 'qualified' where id in (
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004'
);
update public.leads set status = 'converted' where id = '10000000-0000-4000-8000-000000000004';
update public.leads set status = 'lost' where id in (
  '10000000-0000-4000-8000-000000000005',
  '10000000-0000-4000-8000-000000000006'
);
update public.leads set status = 'new' where id = '10000000-0000-4000-8000-000000000006';

select set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', true);

insert into public.leads (
  id, organization_id, assigned_to, first_name, last_name, email, phone
) values
  ('20000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Suman', 'Poudel', 'suman@gmail.com', '+15550002001'),
  ('20000000-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', null, 'Kabita', 'Sharma', 'kabita@gmail.com', null),
  ('20000000-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Deepak', 'Tamang', 'deepak@gmail.com', null);

update public.leads set status = 'contacted' where id = '20000000-0000-4000-8000-000000000001';
update public.leads set status = 'lost' where id = '20000000-0000-4000-8000-000000000003';

-- 5. Notes with multiple authors, including two authors on the same lead.
insert into public.lead_notes (id, lead_id, author_user_id, content) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'Asked for a product demonstration next week.'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Sales manager approved the follow-up.'),
  ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'Customer requested pricing details.'),
  ('30000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'Unassigned lead pending review.'),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2', 'Interested in solar installation options.');

commit;
