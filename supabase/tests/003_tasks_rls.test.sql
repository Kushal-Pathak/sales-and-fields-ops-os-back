
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(45);

-- 1. Verify task security configuration.

SELECT ok(
  (SELECT relrowsecurity
   FROM pg_class
   WHERE oid = 'public.tasks'::regclass),
  'Tasks must have RLS enabled'
);

SELECT ok(
  has_table_privilege('authenticated', 'public.tasks', 'SELECT'),
  'Authenticated users have SELECT permission'
);

-- 2. Create temporary test users.

INSERT INTO auth.users (id, email)
VALUES
  ('71111111-1111-4111-8111-111111111111', 'tasks-admin-a@example.test'),
  ('72222222-2222-4222-8222-222222222222', 'tasks-staff-a@example.test'),
  ('73333333-3333-4333-8333-333333333333', 'tasks-staff-b@example.test'),
  ('74444444-4444-4444-8444-444444444444', 'tasks-admin-b@example.test'),
  ('75555555-5555-4555-8555-555555555555', 'tasks-outsider@example.test');

INSERT INTO public.organizations (id, name)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'Tasks Test Organization A'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'Tasks Test Organization B');

INSERT INTO public.organization_members (organization_id, user_id, role)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '71111111-1111-4111-8111-111111111111', 'admin'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '72222222-2222-4222-8222-222222222222', 'staff'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '73333333-3333-4333-8333-333333333333', 'staff'),
  ('ffffffff-ffff-4fff-8fff-ffffffffffff',
   '74444444-4444-4444-8444-444444444444', 'admin');

-- 3. Create leads with different access permissions.

INSERT INTO public.leads (id, organization_id, assigned_to, first_name)
VALUES
  ('81111111-1111-4111-8111-111111111111',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '72222222-2222-4222-8222-222222222222', 'Lead A'),
  ('82222222-2222-4222-8222-222222222222',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
   '73333333-3333-4333-8333-333333333333', 'Lead B');

-- 4. Create tasks for both organizations.

INSERT INTO public.tasks
  (id, organization_id, lead_id, assigned_to, title)
VALUES
  (
    '91111111-1111-4111-8111-111111111111',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '81111111-1111-4111-8111-111111111111',
    '72222222-2222-4222-8222-222222222222',
    'Staff A accessible lead task'
  ),
  (
    '92222222-2222-4222-8222-222222222222',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '82222222-2222-4222-8222-222222222222',
    '72222222-2222-4222-8222-222222222222',
    'Staff A inaccessible lead task'
  ),
  (
    '93333333-3333-4333-8333-333333333333',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    NULL,
    '72222222-2222-4222-8222-222222222222',
    'Staff A unlinked task'
  ),
  (
    '94444444-4444-4444-8444-444444444444',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    '82222222-2222-4222-8222-222222222222',
    '73333333-3333-4333-8333-333333333333',
    'Staff B task'
  ),
  (
    '95555555-5555-4555-8555-555555555555',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    NULL,
    NULL,
    'Unassigned task'
  ),
  (
    '96666666-6666-4666-8666-666666666666',
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    NULL,
    '74444444-4444-4444-8444-444444444444',
    'Organization B task'
  );

-- 5. Test organization A admin.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claim.sub =
  '71111111-1111-4111-8111-111111111111';

SELECT is(
  (SELECT COUNT(*) FROM public.tasks),
  5::bigint,
  'Admin A sees all five organization A tasks'
);

SELECT is(
  (SELECT COUNT(*) FROM public.tasks
   WHERE organization_id = 'ffffffff-ffff-4fff-8fff-ffffffffffff'),
  0::bigint,
  'Admin A cannot see organization B tasks'
);

-- 6. Test staff A.

SET LOCAL request.jwt.claim.sub =
  '72222222-2222-4222-8222-222222222222';

SELECT is(
  (SELECT COUNT(*) FROM public.tasks),
  3::bigint,
  'Staff A sees all three assigned tasks'
);

SELECT is(
  (SELECT COUNT(*) FROM public.tasks
   WHERE id = '91111111-1111-4111-8111-111111111111'),
  1::bigint,
  'Staff A sees task linked to accessible lead'
);

SELECT is(
  (SELECT COUNT(*) FROM public.tasks
   WHERE id = '92222222-2222-4222-8222-222222222222'),
  1::bigint,
  'Staff A sees assigned task even without lead access'
);

SELECT is(
  (SELECT COUNT(*) FROM public.tasks
   WHERE id = '93333333-3333-4333-8333-333333333333'),
  1::bigint,
  'Staff A sees assigned task without linked lead'
);

-- 7. Test staff B.

SET LOCAL request.jwt.claim.sub =
  '73333333-3333-4333-8333-333333333333';

SELECT is(
  (SELECT COUNT(*) FROM public.tasks),
  1::bigint,
  'Staff B sees only their permitted task'
);

-- 8. Test organization B admin.

SET LOCAL request.jwt.claim.sub =
  '74444444-4444-4444-8444-444444444444';

SELECT is(
  (SELECT COUNT(*) FROM public.tasks),
  1::bigint,
  'Admin B sees only organization B task'
);

-- 9. Test outsider.

SET LOCAL request.jwt.claim.sub =
  '75555555-5555-4555-8555-555555555555';

SELECT is(
  (SELECT COUNT(*) FROM public.tasks),
  0::bigint,
  'User without organization cannot view tasks'
);


-- --------------------------------------------------
-- 10. TEST TASK CREATION PERMISSIONS
-- --------------------------------------------------

SELECT ok(
  NOT has_table_privilege('anon', 'public.tasks', 'INSERT'),
  'Anonymous users cannot insert tasks'
);

-- Organization A admin can create tasks.
SET LOCAL request.jwt.claim.sub =
  '71111111-1111-4111-8111-111111111111';

SELECT lives_ok(
  $sql$
    INSERT INTO public.tasks
      (organization_id, assigned_to, title)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '72222222-2222-4222-8222-222222222222',
      'Task created by admin'
    )
  $sql$,
  'Organization admin can create tasks'
);

SELECT is(
  (SELECT created_by
   FROM public.tasks
   WHERE title = 'Task created by admin'),
  '71111111-1111-4111-8111-111111111111'::uuid,
  'Task creator is automatically recorded'
);

-- Admin cannot impersonate another user.
SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks
      (organization_id, created_by, title)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      '72222222-2222-4222-8222-222222222222',
      'Spoofed creator'
    )
  $sql$,
  '42501', NULL,
  'Admin cannot create a task as another user'
);

-- Staff cannot create tasks.
SET LOCAL request.jwt.claim.sub =
  '72222222-2222-4222-8222-222222222222';

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks (organization_id, title)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'Unauthorized staff task'
    )
  $sql$,
  '42501', NULL,
  'Staff cannot create tasks'
);

-- Admin B cannot create tasks in organization A.
SET LOCAL request.jwt.claim.sub =
  '74444444-4444-4444-8444-444444444444';

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks (organization_id, title)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'Cross organization task'
    )
  $sql$,
  '42501', NULL,
  'Admin cannot create tasks in another organization'
);

-- A user without membership cannot create tasks.
SET LOCAL request.jwt.claim.sub =
  '75555555-5555-4555-8555-555555555555';

SELECT throws_ok(
  $sql$
    INSERT INTO public.tasks (organization_id, title)
    VALUES (
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      'Outsider task'
    )
  $sql$,
  '42501', NULL,
  'Outsider cannot create tasks'
);


-- --------------------------------------------------
-- 11. TEST TASK UPDATE PERMISSIONS
-- --------------------------------------------------

SELECT ok(
  has_column_privilege(
    'authenticated', 'public.tasks', 'status', 'UPDATE'
  ),
  'Authenticated users can update task status'
);

SELECT ok(
  has_column_privilege(
    'authenticated', 'public.tasks', 'completed_at', 'UPDATE'
  ),
  'Authenticated users can update completion time'
);

SELECT ok(
  NOT has_column_privilege(
    'authenticated', 'public.tasks', 'assigned_to', 'UPDATE'
  ),
  'Users cannot directly change task assignments'
);

SELECT ok(
  NOT has_column_privilege(
    'authenticated', 'public.tasks', 'organization_id', 'UPDATE'
  ),
  'Users cannot change task organization'
);

SELECT ok(
  NOT has_column_privilege(
    'authenticated', 'public.tasks', 'title', 'UPDATE'
  ),
  'Task title cannot be directly updated yet'
);

-- Organization A admin.
SET LOCAL request.jwt.claim.sub =
  '71111111-1111-4111-8111-111111111111';

SELECT isnt_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = '95555555-5555-4555-8555-555555555555'
    RETURNING id
  $sql$,
  'Admin can update an unassigned organization task'
);

SELECT is_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = '96666666-6666-4666-8666-666666666666'
    RETURNING id
  $sql$,
  'Admin cannot update another organization task'
);

-- Staff A.
SET LOCAL request.jwt.claim.sub =
  '72222222-2222-4222-8222-222222222222';

SELECT isnt_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'completed',
        completed_at = now()
    WHERE id = '91111111-1111-4111-8111-111111111111'
    RETURNING id
  $sql$,
  'Staff can complete their assigned task'
);

SELECT is_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = '94444444-4444-4444-8444-444444444444'
    RETURNING id
  $sql$,
  'Staff cannot update another staff member task'
);

SELECT isnt_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = '92222222-2222-4222-8222-222222222222'
    RETURNING id
  $sql$,
  'Staff A can update assigned task independently of lead access'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET assigned_to =
      '73333333-3333-4333-8333-333333333333'
    WHERE id = '93333333-3333-4333-8333-333333333333'
  $sql$,
  '42501', NULL,
  'Staff cannot reassign tasks'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET completed_at = now()
    WHERE id = '93333333-3333-4333-8333-333333333333'
  $sql$,
  '23514', NULL,
  'Completion timestamp requires completed status'
);

-- Staff B.
SET LOCAL request.jwt.claim.sub =
  '73333333-3333-4333-8333-333333333333';

SELECT isnt_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = '94444444-4444-4444-8444-444444444444'
    RETURNING id
  $sql$,
  'Staff B can update their assigned task'
);

-- Organization B admin.
SET LOCAL request.jwt.claim.sub =
  '74444444-4444-4444-8444-444444444444';

SELECT isnt_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'cancelled'
    WHERE id = '96666666-6666-4666-8666-666666666666'
    RETURNING id
  $sql$,
  'Admin B can update their organization task'
);

-- Outsider.
SET LOCAL request.jwt.claim.sub =
  '75555555-5555-4555-8555-555555555555';

SELECT is_empty(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = '91111111-1111-4111-8111-111111111111'
    RETURNING id
  $sql$,
  'Outsider cannot update tasks'
);


-- --------------------------------------------------
-- 12. TEST TASK DELETE PERMISSIONS
-- --------------------------------------------------

SELECT ok(
  has_table_privilege(
    'authenticated', 'public.tasks', 'DELETE'
  ),
  'Authenticated role has DELETE privilege'
);

SELECT ok(
  NOT has_table_privilege(
    'anon', 'public.tasks', 'DELETE'
  ),
  'Anonymous users cannot delete tasks'
);

-- Organization A admin.
SET LOCAL request.jwt.claim.sub =
  '71111111-1111-4111-8111-111111111111';

SELECT isnt_empty(
  $sql$
    DELETE FROM public.tasks
    WHERE id = '95555555-5555-4555-8555-555555555555'
    RETURNING id
  $sql$,
  'Admin A can delete an organization A task'
);

SELECT is_empty(
  $sql$
    DELETE FROM public.tasks
    WHERE id = '96666666-6666-4666-8666-666666666666'
    RETURNING id
  $sql$,
  'Admin A cannot delete an organization B task'
);

-- Staff A cannot delete even their own task.
SET LOCAL request.jwt.claim.sub =
  '72222222-2222-4222-8222-222222222222';

SELECT is_empty(
  $sql$
    DELETE FROM public.tasks
    WHERE id = '91111111-1111-4111-8111-111111111111'
    RETURNING id
  $sql$,
  'Staff A cannot delete their assigned task'
);

-- Staff B.
SET LOCAL request.jwt.claim.sub =
  '73333333-3333-4333-8333-333333333333';

SELECT is_empty(
  $sql$
    DELETE FROM public.tasks
    WHERE id = '94444444-4444-4444-8444-444444444444'
    RETURNING id
  $sql$,
  'Staff B cannot delete their assigned task'
);

-- Outsider.
SET LOCAL request.jwt.claim.sub =
  '75555555-5555-4555-8555-555555555555';

SELECT is_empty(
  $sql$
    DELETE FROM public.tasks
    WHERE id = '93333333-3333-4333-8333-333333333333'
    RETURNING id
  $sql$,
  'Outsider cannot delete organization tasks'
);

-- Organization B admin.
SET LOCAL request.jwt.claim.sub =
  '74444444-4444-4444-8444-444444444444';

SELECT isnt_empty(
  $sql$
    DELETE FROM public.tasks
    WHERE id = '96666666-6666-4666-8666-666666666666'
    RETURNING id
  $sql$,
  'Admin B can delete their organization task'
);

-- --------------------------------------------------
-- 13. TASK VISIBILITY AFTER LEAD REASSIGNMENT
-- --------------------------------------------------

-- Admin A reassigns the lead from Staff B to Staff A.
SET LOCAL request.jwt.claim.sub =
  '71111111-1111-4111-8111-111111111111';

SELECT isnt_empty(
  $sql$
    UPDATE public.leads
    SET assigned_to =
      '72222222-2222-4222-8222-222222222222'
    WHERE id = '82222222-2222-4222-8222-222222222222'
    RETURNING id
  $sql$,
  'Admin can reassign a lead'
);

-- Staff B still sees their task, but cannot see the reassigned lead.
SET LOCAL request.jwt.claim.sub =
  '73333333-3333-4333-8333-333333333333';

SELECT is(
  (SELECT COUNT(*) FROM public.tasks
   WHERE id = '94444444-4444-4444-8444-444444444444'),
  1::bigint,
  'Lead reassignment does not hide Staff B task'
);

SELECT is(
  (SELECT COUNT(*) FROM public.leads
   WHERE id = '82222222-2222-4222-8222-222222222222'),
  0::bigint,
  'Staff B cannot access the reassigned lead'
);

-- Staff A continues to see their own assigned task.
SET LOCAL request.jwt.claim.sub =
  '72222222-2222-4222-8222-222222222222';

SELECT is(
  (SELECT COUNT(*) FROM public.tasks
   WHERE id = '92222222-2222-4222-8222-222222222222'),
  1::bigint,
  'Assigned task remains accessible after lead reassignment'
);

SELECT * FROM finish();

ROLLBACK;
