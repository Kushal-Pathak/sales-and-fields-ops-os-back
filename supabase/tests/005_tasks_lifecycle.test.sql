BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

SELECT plan(15);

-- Temporary fixtures, rolled back after this test file.
INSERT INTO public.organizations (id, name)
VALUES (
  'aaaa0001-0000-4000-8000-000000000001',
  'Task Lifecycle Test Organization'
);

INSERT INTO public.tasks (id, organization_id, title)
VALUES (
  'bbbb0001-0000-4000-8000-000000000001',
  'aaaa0001-0000-4000-8000-000000000001',
  'Task lifecycle verification'
);

-- --------------------------------------------------
-- 1. NORMAL PROGRESS AND COMPLETION
-- --------------------------------------------------

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'todo -> in_progress is allowed'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'completed', completed_at = now()
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'in_progress -> completed is allowed with completed_at'
);

-- --------------------------------------------------
-- 2. COMPLETED TASKS MUST BE REOPENED FIRST
-- --------------------------------------------------

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'cancelled', completed_at = NULL
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  '23514', NULL,
  'completed -> cancelled is rejected'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'todo', completed_at = NULL
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  '23514', NULL,
  'completed -> todo is rejected'
);

SELECT is(
  (SELECT status FROM public.tasks
   WHERE id = 'bbbb0001-0000-4000-8000-000000000001'),
  'completed',
  'Rejected transitions leave the task completed'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress', completed_at = NULL
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'completed -> in_progress is allowed when reopening'
);

-- --------------------------------------------------
-- 3. MOVING BACK OR COMPLETING DIRECTLY
-- --------------------------------------------------

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'todo'
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'in_progress -> todo is allowed'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'completed', completed_at = now()
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'todo -> completed is allowed for quick tasks'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress', completed_at = NULL
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'Directly completed tasks can also be reopened'
);

-- --------------------------------------------------
-- 4. CANCEL AND RESTORE
-- --------------------------------------------------

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'cancelled'
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'in_progress -> cancelled is allowed'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'in_progress'
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  '23514', NULL,
  'cancelled -> in_progress is rejected'
);

SELECT throws_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'completed', completed_at = now()
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  '23514', NULL,
  'cancelled -> completed is rejected'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'todo'
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'cancelled -> todo is allowed when restoring a task'
);

SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET status = 'cancelled'
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'todo -> cancelled is allowed'
);

-- Other field changes do not require a lifecycle transition.
SELECT lives_ok(
  $sql$
    UPDATE public.tasks
    SET priority = 'high'
    WHERE id = 'bbbb0001-0000-4000-8000-000000000001'
  $sql$,
  'Updating a task without changing status remains valid'
);

SELECT * FROM finish();

ROLLBACK;
