BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(25);

-- ----------------------------------------------
-- SETUP: Temporary test data
-- ----------------------------------------------

INSERT INTO auth.users (id, email)
VALUES
  ('61111111-1111-4111-8111-111111111111', 'ram-db@example.test'),
  ('62222222-2222-4222-8222-222222222222', 'hari-db@example.test'),
  ('63333333-3333-4333-8333-333333333333', 'sita-db@example.test'),
  ('64444444-4444-4444-8444-444444444444', 'gita-db@example.test'),
  ('65555555-5555-4555-8555-555555555555', 'nima-db@example.test');

INSERT INTO public.organizations (id, name)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'CRM Test Organization A'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'CRM Test Organization B');

INSERT INTO public.organization_members (
  organization_id, user_id, role
)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '61111111-1111-4111-8111-111111111111', 'admin'),

  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
   '62222222-2222-4222-8222-222222222222', 'staff'),

  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   '63333333-3333-4333-8333-333333333333', 'admin'),

  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
   '64444444-4444-4444-8444-444444444444', 'staff');

INSERT INTO public.leads (
  id, organization_id, assigned_to, first_name, status
)
VALUES
  (
    'e1111111-1111-4111-8111-111111111111',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    '62222222-2222-4222-8222-222222222222',
    'Ramesh', 'new'
  ),
  (
    'e2222222-2222-4222-8222-222222222222',
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    NULL,
    'Suresh', 'lost'
  ),
  (
    'e3333333-3333-4333-8333-333333333333',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    '64444444-4444-4444-8444-444444444444',
    'Nabin', 'new'
  );

INSERT INTO public.lead_notes (
  id, lead_id, author_user_id, content
)
VALUES (
  'f1111111-1111-4111-8111-111111111111',
  'e1111111-1111-4111-8111-111111111111',
  '62222222-2222-4222-8222-222222222222',
  'Initial customer discussion'
);

-- ----------------------------------------------
-- 1. ORGANIZATION MEMBERSHIP CONSTRAINTS
-- ----------------------------------------------

SELECT throws_ok(
  $sql$
    INSERT INTO public.organization_members
      (organization_id, user_id, role)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '62222222-2222-4222-8222-222222222222',
      'staff'
    )
  $sql$,
  '23505', NULL,
  'Duplicate organization membership is rejected'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.organization_members
      (organization_id, user_id, role)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '65555555-5555-4555-8555-555555555555',
      'superadmin'
    )
  $sql$,
  '23514', NULL,
  'Invalid organization role is rejected'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.organization_members
      (organization_id, user_id, role)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '69999999-9999-4999-8999-999999999999',
      'staff'
    )
  $sql$,
  '23503', NULL,
  'Membership cannot reference a nonexistent user'
);

-- ----------------------------------------------
-- 2. LEAD CONSTRAINTS AND ASSIGNMENTS
-- ----------------------------------------------

SELECT throws_ok(
  $sql$
    INSERT INTO public.leads
      (organization_id, first_name, status)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'Invalid',
      'pending'
    )
  $sql$,
  '23514', NULL,
  'Invalid lead status is rejected'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.leads
      (organization_id, assigned_to, first_name)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '64444444-4444-4444-8444-444444444444',
      'Invalid Assignee'
    )
  $sql$,
  '23503', NULL,
  'Cannot assign a lead to another organization member'
);

SELECT lives_ok(
  $sql$
    INSERT INTO public.leads
      (organization_id, first_name)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      'Unassigned Lead'
    )
  $sql$,
  'A lead can be created without an assignee'
);

SELECT throws_ok(
  $sql$
    UPDATE public.leads
    SET assigned_to = '64444444-4444-4444-8444-444444444444'
    WHERE id = 'e2222222-2222-4222-8222-222222222222'
  $sql$,
  '23503', NULL,
  'Cannot reassign a lead to another organization member'
);

SELECT lives_ok(
  $sql$
    UPDATE public.leads
    SET assigned_to = '62222222-2222-4222-8222-222222222222'
    WHERE id = 'e2222222-2222-4222-8222-222222222222'
  $sql$,
  'A lead can be assigned to a member of its organization'
);

-- ----------------------------------------------
-- 3. LEAD STATUS TRANSITIONS
-- ----------------------------------------------

SELECT throws_ok(
  $sql$
    UPDATE public.leads
    SET status = 'converted'
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Cannot transition directly from new to converted'
);

SELECT lives_ok(
  $sql$
    UPDATE public.leads
    SET status = 'contacted'
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  $sql$,
  'New to contacted is allowed'
);

SELECT lives_ok(
  $sql$
    UPDATE public.leads
    SET status = 'qualified'
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  $sql$,
  'Contacted to qualified is allowed'
);

SELECT lives_ok(
  $sql$
    UPDATE public.leads
    SET status = 'converted'
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  $sql$,
  'Qualified to converted is allowed'
);

SELECT throws_ok(
  $sql$
    UPDATE public.leads
    SET status = 'lost'
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Converted leads cannot transition to lost'
);

SELECT lives_ok(
  $sql$
    UPDATE public.leads
    SET status = 'new'
    WHERE id = 'e2222222-2222-4222-8222-222222222222'
  $sql$,
  'Lost leads can be reopened as new'
);

-- ----------------------------------------------
-- 4. PROTECT LEAD AND NOTE INTEGRITY
-- ----------------------------------------------

SELECT throws_ok(
  $sql$
    UPDATE public.leads
    SET id = 'e9999999-9999-4999-8999-999999999999'
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Lead ID cannot be changed'
);

SELECT throws_ok(
  $sql$
    UPDATE public.leads
    SET organization_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Lead organization cannot be changed'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.lead_notes
      (lead_id, author_user_id, content)
    VALUES (
      'e1111111-1111-4111-8111-111111111111',
      '62222222-2222-4222-8222-222222222222',
      '   '
    )
  $sql$,
  '23514', NULL,
  'Blank lead note content is rejected'
);

SELECT throws_ok(
  $sql$
    UPDATE public.lead_notes
    SET author_user_id = '63333333-3333-4333-8333-333333333333'
    WHERE id = 'f1111111-1111-4111-8111-111111111111'
  $sql$,
  'P0001', NULL,
  'Lead note author cannot be changed'
);

-- ----------------------------------------------
-- 5. LAST-ADMIN PROTECTION
-- ----------------------------------------------

SELECT throws_ok(
  $sql$
    DELETE FROM public.organization_members
    WHERE organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND user_id = '61111111-1111-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Last organization admin cannot be deleted'
);

SELECT throws_ok(
  $sql$
    UPDATE public.organization_members
    SET role = 'staff'
    WHERE organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND user_id = '61111111-1111-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Last organization admin cannot be demoted'
);

SELECT lives_ok(
  $sql$
    INSERT INTO public.organization_members
      (organization_id, user_id, role)
    VALUES (
      'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      '65555555-5555-4555-8555-555555555555',
      'admin'
    )
  $sql$,
  'Organization can have a second admin'
);

SELECT lives_ok(
  $sql$
    UPDATE public.organization_members
    SET role = 'staff'
    WHERE organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND user_id = '65555555-5555-4555-8555-555555555555'
  $sql$,
  'An admin can be demoted when another admin remains'
);

-- ----------------------------------------------
-- 6. MEMBERSHIP DELETION AND ASSIGNMENT
-- ----------------------------------------------

SELECT lives_ok(
  $sql$
    DELETE FROM public.organization_members
    WHERE organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND user_id = '62222222-2222-4222-8222-222222222222'
  $sql$,
  'A staff member can be removed'
);

SELECT is(
  (
    SELECT assigned_to IS NULL
    FROM public.leads
    WHERE id = 'e1111111-1111-4111-8111-111111111111'
  ),
  TRUE,
  'Removing an assigned staff member clears the lead assignment'
);

SELECT throws_ok(
  $sql$
    DELETE FROM public.organization_members
    WHERE organization_id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      AND user_id = '61111111-1111-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Last-admin protection remains active after role changes'
);

SELECT * FROM finish();

ROLLBACK;