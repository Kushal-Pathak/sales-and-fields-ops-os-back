BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SET LOCAL search_path = public, extensions;

SELECT plan(24);

-- --------------------------------------------------
-- 1. VERIFY RLS IS ENABLED
-- --------------------------------------------------

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.organizations'::regclass),
  'Organizations must have RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.organization_members'::regclass),
  'Organization members must have RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.leads'::regclass),
  'Leads must have RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.lead_notes'::regclass),
  'Lead notes must have RLS enabled'
);

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.lead_activities'::regclass),
  'Lead activities must have RLS enabled'
);

-- --------------------------------------------------
-- 2. CREATE TEMPORARY TEST DATA
-- --------------------------------------------------

INSERT INTO auth.users (id, email)
VALUES
  ('11111111-1111-4111-8111-111111111111', 'rls-admin-a@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'rls-staff-a@example.test'),
  ('33333333-3333-4333-8333-333333333333', 'rls-staff-b@example.test'),
  ('44444444-4444-4444-8444-444444444444', 'rls-admin-b@example.test'),
  ('55555555-5555-4555-8555-555555555555', 'rls-outsider@example.test');

INSERT INTO public.organizations (id, name)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'RLS Test Organization A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'RLS Test Organization B');

INSERT INTO public.organization_members (
  organization_id, user_id, role
)
VALUES
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '11111111-1111-4111-8111-111111111111',
    'admin'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    'staff'
  ),
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'staff'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444444',
    'admin'
  );

INSERT INTO public.leads (
  id, organization_id, assigned_to, first_name
)
VALUES
  (
    'a1111111-1111-4111-8111-111111111111',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '22222222-2222-4222-8222-222222222222',
    'Ramesh'
  ),
  (
    'a2222222-2222-4222-8222-222222222222',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '33333333-3333-4333-8333-333333333333',
    'Suresh'
  ),
  (
    'a3333333-3333-4333-8333-333333333333',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    NULL,
    'Binod'
  ),
  (
    'b1111111-1111-4111-8111-111111111111',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '44444444-4444-4444-8444-444444444444',
    'Nabin'
  );

INSERT INTO public.lead_notes (
  id, lead_id, author_user_id, content
)
VALUES
  (
    'c1111111-1111-4111-8111-111111111111',
    'a1111111-1111-4111-8111-111111111111',
    '22222222-2222-4222-8222-222222222222',
    'Ramesh requested a follow-up'
  ),
  (
    'c2222222-2222-4222-8222-222222222222',
    'a2222222-2222-4222-8222-222222222222',
    '33333333-3333-4333-8333-333333333333',
    'Suresh requested a demo'
  ),
  (
    'd1111111-1111-4111-8111-111111111111',
    'b1111111-1111-4111-8111-111111111111',
    '44444444-4444-4444-8444-444444444444',
    'Nabin requested pricing'
  );

-- Lead activities are generated automatically by
-- the existing PostgreSQL lead activity trigger.

-- --------------------------------------------------
-- 3. TEST ORGANIZATION A ADMIN
-- --------------------------------------------------

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
  '11111111-1111-4111-8111-111111111111';

SELECT is(
  (SELECT COUNT(*) FROM public.leads),
  3::bigint,
  'Admin A sees all three organization A leads'
);

SELECT is(
  (SELECT COUNT(*) FROM public.leads
   WHERE organization_id =
     'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0::bigint,
  'Admin A cannot view organization B leads'
);

SELECT is(
  (SELECT COUNT(*) FROM public.lead_notes),
  2::bigint,
  'Admin A sees notes belonging to accessible leads'
);

SELECT is(
  (SELECT COUNT(*) FROM public.lead_activities),
  3::bigint,
  'Admin A sees activities belonging to accessible leads'
);

-- --------------------------------------------------
-- 4. TEST ORGANIZATION A STAFF MEMBER
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  '22222222-2222-4222-8222-222222222222';

SELECT is(
  (SELECT COUNT(*) FROM public.leads),
  1::bigint,
  'Staff A sees only their assigned lead'
);

SELECT is(
  (SELECT COUNT(*) FROM public.leads
   WHERE id = 'a1111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Staff A can view their assigned lead'
);

SELECT is(
  (SELECT COUNT(*) FROM public.leads
   WHERE id = 'a2222222-2222-4222-8222-222222222222'),
  0::bigint,
  'Staff A cannot view another staff member lead'
);

SELECT is(
  (SELECT COUNT(*) FROM public.leads
   WHERE id = 'a3333333-3333-4333-8333-333333333333'),
  0::bigint,
  'Staff A cannot view an unassigned lead'
);

SELECT is(
  (SELECT COUNT(*) FROM public.leads
   WHERE id = 'b1111111-1111-4111-8111-111111111111'),
  0::bigint,
  'Staff A cannot view another organization lead'
);

SELECT is(
  (SELECT COUNT(*) FROM public.lead_notes),
  1::bigint,
  'Staff A sees notes for accessible leads only'
);

SELECT is(
  (SELECT COUNT(*) FROM public.lead_activities),
  1::bigint,
  'Staff A sees activities for accessible leads only'
);

-- --------------------------------------------------
-- 5. TEST UPDATE AND DELETE RESTRICTIONS
-- --------------------------------------------------

SELECT is_empty(
  $$
    UPDATE public.leads
    SET first_name = 'Blocked'
    WHERE id = 'a2222222-2222-4222-8222-222222222222'
    RETURNING id
  $$,
  'Staff A cannot update another staff member lead'
);

SELECT is_empty(
  $$
    DELETE FROM public.leads
    WHERE id = 'a1111111-1111-4111-8111-111111111111'
    RETURNING id
  $$,
  'Staff A cannot delete leads'
);

SELECT isnt_empty(
  $$
    UPDATE public.leads
    SET first_name = 'Updated'
    WHERE id = 'a1111111-1111-4111-8111-111111111111'
    RETURNING id
  $$,
  'Staff A can update their assigned lead'
);

SELECT is_empty(
  $$
    UPDATE public.lead_notes
    SET content = 'Blocked'
    WHERE id = 'c2222222-2222-4222-8222-222222222222'
    RETURNING id
  $$,
  'Staff A cannot update another author note'
);

SELECT isnt_empty(
  $$
    UPDATE public.lead_notes
    SET content = 'Updated by author'
    WHERE id = 'c1111111-1111-4111-8111-111111111111'
    RETURNING id
  $$,
  'Staff A can update their own note'
);

-- --------------------------------------------------
-- 6. TEST ANOTHER STAFF MEMBER
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  '33333333-3333-4333-8333-333333333333';

SELECT is(
  (SELECT COUNT(*) FROM public.leads),
  1::bigint,
  'Staff B sees only their assigned lead'
);

-- --------------------------------------------------
-- 7. TEST ORGANIZATION B ADMIN
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  '44444444-4444-4444-8444-444444444444';

SELECT is(
  (SELECT COUNT(*) FROM public.leads),
  1::bigint,
  'Admin B sees only organization B leads'
);

-- --------------------------------------------------
-- 8. TEST USER WITHOUT ORGANIZATION
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  '55555555-5555-4555-8555-555555555555';

SELECT is(
  (SELECT COUNT(*) FROM public.leads),
  0::bigint,
  'User without organization cannot view leads'
);

-- --------------------------------------------------
-- FINISH
-- --------------------------------------------------

SELECT * FROM finish();

ROLLBACK;