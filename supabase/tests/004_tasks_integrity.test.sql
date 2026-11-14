
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(17);

-- --------------------------------------------------
-- 1. TEST FIXTURES
-- --------------------------------------------------

INSERT INTO auth.users (id, email)
VALUES
  ('71111111-aaaa-4111-8111-111111111111', 'task-integrity-admin-a@example.test'),
  ('72222222-bbbb-4222-8222-222222222222', 'task-integrity-admin-b@example.test'),
  ('73333333-cccc-4333-8333-333333333333', 'task-integrity-staff-a@example.test');

INSERT INTO public.organizations (id, name)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000071', 'Integrity Organization A'),
  ('bbbbbbbb-0000-4000-8000-000000000072', 'Integrity Organization B');

INSERT INTO public.organization_members
  (organization_id, user_id, role)
VALUES
  (
    'aaaaaaaa-0000-4000-8000-000000000071',
    '71111111-aaaa-4111-8111-111111111111',
    'admin'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000072',
    '72222222-bbbb-4222-8222-222222222222',
    'admin'
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000071',
    '73333333-cccc-4333-8333-333333333333',
    'staff'
  );

INSERT INTO public.leads
  (id, organization_id, assigned_to, first_name)
VALUES
  (
    '81111111-aaaa-4111-8111-111111111111',
    'aaaaaaaa-0000-4000-8000-000000000071',
    '73333333-cccc-4333-8333-333333333333',
    'Lead A'
  ),
  (
    '82222222-bbbb-4222-8222-222222222222',
    'bbbbbbbb-0000-4000-8000-000000000072',
    '72222222-bbbb-4222-8222-222222222222',
    'Lead B'
  );

INSERT INTO public.tasks
  (id, organization_id, lead_id, assigned_to, created_by, title)
VALUES
  (
    '91111111-aaaa-4111-8111-111111111111',
    'aaaaaaaa-0000-4000-8000-000000000071',
    '81111111-aaaa-4111-8111-111111111111',
    '73333333-cccc-4333-8333-333333333333',
    '71111111-aaaa-4111-8111-111111111111',
    'Follow up with customer'
  );

-- --------------------------------------------------
-- 2. PROTECT TASK IDENTITY
-- --------------------------------------------------

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET id = gen_random_uuid()
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Task ID cannot be changed'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET organization_id =
      'bbbbbbbb-0000-4000-8000-000000000072'
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Task organization cannot be changed'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET created_at = created_at + interval '1 day'
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Task creation timestamp cannot be changed'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET title = 'Updated customer follow-up'
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  'Legitimate task detail updates remain possible'
);

-- --------------------------------------------------
-- 3. VALIDATE TASK DATA
-- --------------------------------------------------

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks (organization_id, title)
    VALUES (
      'aaaaaaaa-0000-4000-8000-000000000071',
      '   '
    )
  $sql$,
  '23514', NULL,
  'Blank task title is rejected'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks (organization_id, title, priority)
    VALUES (
      'aaaaaaaa-0000-4000-8000-000000000071',
      'Invalid priority task',
      'urgent'
    )
  $sql$,
  '23514', NULL,
  'Invalid task priority is rejected'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks (organization_id, title, status)
    VALUES (
      'aaaaaaaa-0000-4000-8000-000000000071',
      'Invalid status task',
      'pending'
    )
  $sql$,
  '23514', NULL,
  'Invalid task status is rejected'
);

-- --------------------------------------------------
-- 4. COMPLETION CONSISTENCY
-- --------------------------------------------------

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'completed'
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Completed task requires completion timestamp'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET completed_at = now()
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  '23514', NULL,
  'Incomplete task cannot have completion timestamp'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'completed',
        completed_at = now()
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  'Task can be completed with a timestamp'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress',
        completed_at = NULL
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  $sql$,
  'Task can be reopened when completion timestamp is cleared'
);

-- --------------------------------------------------
-- 5. CROSS-ORGANIZATION RELATIONSHIPS
-- --------------------------------------------------

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks
      (organization_id, lead_id, title)
    VALUES (
      'aaaaaaaa-0000-4000-8000-000000000071',
      '82222222-bbbb-4222-8222-222222222222',
      'Invalid cross-organization lead'
    )
  $sql$,
  '23503', NULL,
  'Task cannot reference a lead from another organization'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks
      (organization_id, assigned_to, title)
    VALUES (
      'aaaaaaaa-0000-4000-8000-000000000071',
      '72222222-bbbb-4222-8222-222222222222',
      'Invalid cross-organization assignee'
    )
  $sql$,
  '23503', NULL,
  'Task cannot be assigned to another organization member'
);

-- --------------------------------------------------
-- 6. FOREIGN KEY DELETION BEHAVIOR
-- --------------------------------------------------

SELECT lives_ok(
  $sql$
    DELETE FROM public.leads
    WHERE id = '81111111-aaaa-4111-8111-111111111111'
  $sql$,
  'Deleting a linked lead succeeds'
);

SELECT is(
  (
    SELECT lead_id
    FROM public.tasks
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  ),
  NULL::uuid,
  'Deleting a linked lead clears task lead_id'
);

SELECT lives_ok(
  $sql$
    DELETE FROM public.organization_members
    WHERE organization_id =
      'aaaaaaaa-0000-4000-8000-000000000071'
      AND user_id =
      '73333333-cccc-4333-8333-333333333333'
  $sql$,
  'Removing an assigned staff member succeeds'
);

SELECT is(
  (
    SELECT assigned_to
    FROM public.tasks
    WHERE id = '91111111-aaaa-4111-8111-111111111111'
  ),
  NULL::uuid,
  'Removing an assignee clears task assignment'
);

SELECT * FROM finish();

ROLLBACK;
