BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(21);

-- --------------------------------------------------
-- 1. SECURITY CONFIGURATION
-- --------------------------------------------------

SELECT ok(
  (SELECT relrowsecurity
   FROM pg_class
   WHERE oid = 'public.task_notes'::regclass),
  'Task notes have RLS enabled'
);

SELECT ok(
  NOT has_table_privilege(
    'anon',
    'public.task_notes',
    'SELECT'
  ),
  'Anonymous users cannot read task notes'
);

SELECT ok(
  NOT has_column_privilege(
    'authenticated',
    'public.task_notes',
    'task_id',
    'UPDATE'
  ),
  'Authenticated users cannot move notes between tasks'
);

-- --------------------------------------------------
-- 2. TEMPORARY FIXTURES
-- --------------------------------------------------

INSERT INTO auth.users (id, email)
VALUES
  ('a1010000-0000-4000-8000-000000000001',
   'task-note-admin-a@example.test'),
  ('a1010000-0000-4000-8000-000000000002',
   'task-note-staff-a@example.test'),
  ('a1010000-0000-4000-8000-000000000003',
   'task-note-staff-b@example.test'),
  ('a1010000-0000-4000-8000-000000000004',
   'task-note-admin-b@example.test');

INSERT INTO public.organizations (id, name)
VALUES
  ('f1010000-0000-4000-8000-000000000001',
   'Task Note Organization A'),
  ('f1010000-0000-4000-8000-000000000002',
   'Task Note Organization B');

INSERT INTO public.organization_members
  (organization_id, user_id, role)
VALUES
  (
    'f1010000-0000-4000-8000-000000000001',
    'a1010000-0000-4000-8000-000000000001',
    'admin'
  ),
  (
    'f1010000-0000-4000-8000-000000000001',
    'a1010000-0000-4000-8000-000000000002',
    'staff'
  ),
  (
    'f1010000-0000-4000-8000-000000000001',
    'a1010000-0000-4000-8000-000000000003',
    'staff'
  ),
  (
    'f1010000-0000-4000-8000-000000000002',
    'a1010000-0000-4000-8000-000000000004',
    'admin'
  );

INSERT INTO public.tasks (
  id,
  organization_id,
  assigned_to,
  title
)
VALUES (
  'b1010000-0000-4000-8000-000000000001',
  'f1010000-0000-4000-8000-000000000001',
  'a1010000-0000-4000-8000-000000000002',
  'Task note RLS fixture'
);

-- --------------------------------------------------
-- 3. STAFF A: AUTHOR
-- --------------------------------------------------

SET LOCAL ROLE authenticated;

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000002';

SELECT lives_ok(
  $sql$
    INSERT INTO public.task_notes (task_id, content)
    VALUES (
      'b1010000-0000-4000-8000-000000000001',
      'Original task note'
    )
  $sql$,
  'Assigned staff can create a task note'
);

SELECT is(
  (
    SELECT author_user_id
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  'a1010000-0000-4000-8000-000000000002'::uuid,
  'Task note author is set automatically'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Assigned staff can read task notes'
);

-- --------------------------------------------------
-- 4. STAFF B: UNASSIGNED USER
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000003';

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Unassigned staff cannot read task notes'
);

SELECT throws_ok(
  $sql$
    INSERT INTO public.task_notes (task_id, content)
    VALUES (
      'b1010000-0000-4000-8000-000000000001',
      'Unauthorized note'
    )
  $sql$,
  '42501',
  NULL,
  'Unassigned staff cannot create task notes'
);

-- --------------------------------------------------
-- 5. AUTHOR UPDATE PERMISSIONS
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000002';

SELECT lives_ok(
  $sql$
    UPDATE public.task_notes
    SET content = 'Updated by author'
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  $sql$,
  'Author can update their own note'
);

SELECT throws_ok(
  $sql$
    UPDATE public.task_notes
    SET author_user_id =
      'a1010000-0000-4000-8000-000000000001'
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  $sql$,
  '42501',
  NULL,
  'Authors cannot change note ownership'
);

-- --------------------------------------------------
-- 6. ADMIN A
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Organization admin can read staff notes'
);

SELECT is_empty(
  $sql$
    UPDATE public.task_notes
    SET content = 'Unauthorized admin edit'
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
    RETURNING id
  $sql$,
  'Admin cannot edit a note belonging to staff'
);

-- --------------------------------------------------
-- 7. ADMIN B
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000004';

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Another organization cannot read task notes'
);

-- --------------------------------------------------
-- 8. REASSIGNMENT SECURITY
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000001';

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET assigned_to =
      'a1010000-0000-4000-8000-000000000003'
    WHERE id =
      'b1010000-0000-4000-8000-000000000001'
  $sql$,
  'Admin can reassign the task'
);

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000002';

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Previous assignee loses note visibility'
);

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000003';

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'New assignee gains note visibility'
);

SELECT is_empty(
  $sql$
    UPDATE public.task_notes
    SET content = 'Unauthorized new assignee edit'
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
    RETURNING id
  $sql$,
  'New assignee cannot edit previous author notes'
);

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000002';

SELECT is_empty(
  $sql$
    DELETE FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
    RETURNING id
  $sql$,
  'Previous assignee cannot delete notes after reassignment'
);

-- --------------------------------------------------
-- 9. ADMIN VISIBILITY AND CASCADE DELETION
-- --------------------------------------------------

SET LOCAL request.jwt.claim.sub =
  'a1010000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'Admin retains note visibility after reassignment'
);

SELECT lives_ok(
  $sql$
    DELETE FROM public.tasks
    WHERE id =
      'b1010000-0000-4000-8000-000000000001'
  $sql$,
  'Admin can delete a task containing notes'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.task_notes
    WHERE task_id =
      'b1010000-0000-4000-8000-000000000001'
  ),
  0::bigint,
  'Deleting the task also deletes its notes'
);

SELECT * FROM finish();

ROLLBACK;