# Backend Agent Instructions

## Project Overview

This project is a multi-tenant CRM backend for managing leads, their lifecycle, activities, notes, organization members, and staff assignments.

The goal is to build reliable business functionality with code that is straightforward for new developers and interns to understand, review, test, and maintain.

## Technology Stack

- Cloudflare Workers and Hono
- TypeScript
- Supabase Auth and PostgreSQL
- PostgreSQL Row Level Security (RLS)
- Zod for input validation
- Vitest for unit testing

## Architecture

Follow the existing modular monolith structure:

**Routes → Controllers → Services → Repositories → Database**

- **Routes:** Define endpoints and apply middleware.
- **Controllers:** Translate HTTP requests into service calls and return responses.
- **Services:** Implement business logic, permissions, and business rules.
- **Repositories:** Perform database queries and persistence operations.
- **Middleware:** Handle authentication, authorization, and request context.

Keep feature-specific code in `src/features/`. Reuse established utilities in `src/core/`, `src/shared/`, and `src/platform/`.

Respect existing project conventions before introducing new patterns.

## Coding Rules

1. Read the relevant existing code before making changes.
2. Follow established naming conventions, module boundaries, and file structure.
3. Keep business logic in services and database operations in repositories.
4. Validate external input with Zod and existing shared validation helpers.
5. Use `AppError` for recognized application failures and preserve centralized error handling.
6. Never expose sensitive database details or internal errors to API clients.
7. Prefer TypeScript's type safety; avoid `any` unless there is a documented reason.
8. Avoid unnecessary dependencies, frameworks, configuration, and architectural changes.
9. Change only the files needed for the requested behavior.
10. Preserve existing behavior unless the task explicitly requires changing it.

## Code Quality and Maintainability

Write **clean, minimal, readable, maintainable, and testable code**. Optimize for humans reading and changing the code, not for cleverness or fewer lines at any cost.

- **Prioritize readability:** Make control flow and intent clear to developers at different experience levels.
- **Keep solutions simple:** Prefer direct, understandable implementations over clever tricks and overengineering.
- **Write only necessary code:** Avoid redundant logic, excessive boilerplate, speculative features, and premature abstraction.
- **Use meaningful names:** Make variables, functions, types, and files describe their purpose accurately.
- **Keep functions focused:** Give each function one clear responsibility; split complex logic when it improves comprehension.
- **Avoid duplication thoughtfully:** Reuse existing utilities, but do not create abstractions for one-off logic without a real benefit.
- **Make reviews easy:** Prefer small, cohesive changes and predictable behavior over large refactors.
- **Design for testing:** Keep business logic separate from I/O and external services where practical.
- **Comment with purpose:** Explain non-obvious decisions, constraints, and business rules; do not narrate obvious code.
- **Optimize for onboarding:** A new developer or intern should be able to trace a request, understand the behavior, and change it safely.

**Guiding principle:** Write code for humans first. If two approaches meet the requirements, choose the simpler one that preserves correctness, security, and future maintainability.

## Security and Business Rules

- Preserve authentication and authorization middleware.
- Enforce organization-level data isolation and respect database RLS policies.
- Never bypass RLS or trust client-supplied organization or user identity without verification.
- Preserve admin and staff access restrictions.
- Prevent removal or demotion of an organization's last administrator.
- Validate lead status transitions and protect against conflicting updates.
- Preserve lead-note ownership and access restrictions.
- Do not commit secrets, credentials, access tokens, or production environment files.
- Do not weaken security constraints merely to make tests pass.

## Database Conventions

- Use `.maybeSingle()` when zero matching rows is an expected possibility.
- Use `.single()` when exactly one returned row is required.
- Handle database failures through established service error patterns.
- Map known PostgreSQL constraint failures to appropriate application errors.
- Preserve database constraints, RLS, and transactional integrity.
- Treat client-visible `404`, `409`, and `500` behavior carefully; do not mask unexpected failures as missing records.
- Review the effects of concurrent changes when implementing assignments, status changes, and organization-role operations.

## Testing Requirements

- Use Vitest for unit tests and mock external dependencies when testing services.
- Cover successful operations, expected edge cases, missing records, database errors, and relevant business rules.
- Add or update tests when behavior changes; keep tests focused, readable, and deterministic.
- Do not confuse mocked unit tests with actual verification of PostgreSQL constraints or RLS policies; those require integration tests.
- Do not claim a test passed unless it was actually run.

## Verification

Before reporting a coding task as complete, run:

```bash
npm run typecheck
npm test
```

If a command cannot run or fails, report that clearly and include the reason. GitHub Actions status is separate from local checks; an infrastructure or billing failure is not proof of a code failure or a successful CI run.

## Agent Workflow

For each development task:

1. Understand the requirement and expected behavior.
2. Inspect the relevant implementation and related tests.
3. Identify affected files, security constraints, and business rules.
4. Implement the smallest clear change that satisfies the requirement.
5. Add or update appropriate tests.
6. Run type checking and tests when possible.
7. Summarize what changed, what was verified, and any remaining limitations or risks.

Do not modify unrelated files, introduce speculative features, or perform large refactors without a concrete need.
