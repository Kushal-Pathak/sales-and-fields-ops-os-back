# Sales and Fields Ops OS — Backend

A TypeScript API for managing CRM leads, assignments, notes, lead activity, and organization members. Built with **Cloudflare Workers**, **Hono**, **Supabase Auth**, and **PostgreSQL**.

## Features

- Lead creation, listing, updating, deletion, and assignment
- Lead lifecycle statuses: `new`, `contacted`, `qualified`, `converted`, `lost`
- Lead notes and activity history
- Organization membership management with `admin` and `staff` roles
- Input validation, centralized error handling, and request logging
- Organization-scoped access controls backed by PostgreSQL Row Level Security (RLS)
- Vitest unit tests and a GitHub Actions CI workflow

## Requirements

- **Node.js 22** (used by the project's GitHub Actions workflow)
- **npm**
- Access to a configured **Supabase** project and its database schema
- Cloudflare account/credentials only when deploying

## Local setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/Kushal-Pathak/sales-and-fields-ops-os-back.git
   cd sales-and-fields-ops-os-back
   npm ci
   ```

2. Create your local environment configuration:

   ```bash
   cp .dev.vars.example .dev.vars
   ```

3. Fill in `.dev.vars` with values from your development environment:

   ```dotenv
   SUPABASE_URL=<your-supabase-project-url>
   SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
   SUPABASE_SECRET_KEY=<your-server-only-supabase-secret-key>
   FRONTEND_ORIGIN=http://localhost:5173
   ```

   `FRONTEND_ORIGIN` must match the origin of the frontend you run locally. **Never commit `.dev.vars`, secret keys, access tokens, or production credentials.** The `.gitignore` already excludes local secret files.

4. Start the API:

   ```bash
   npm run dev
   ```

   Wrangler starts a local Cloudflare Worker development server. Use the local URL shown in your terminal (often `http://localhost:8787`).

5. Verify the health endpoint:

   ```bash
   curl http://localhost:8787/health
   ```

   Expected response with valid environment configuration:

   ```json
   { "status": "ok" }
   ```

   Environment configuration is checked for incoming requests, including `/health`. If a required variable is missing, add it to `.dev.vars` and restart the server.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the Worker locally with Wrangler |
| `npm run typecheck` | Validate TypeScript without emitting files |
| `npm test` | Run the Vitest unit test suite once |
| `npm run db:types` | Regenerate Supabase database types from the linked project |
| `npm run deploy` | Deploy with Wrangler after Cloudflare credentials and environment settings are configured |

**Note:** `npm run db:types` requires a correctly linked Supabase project and overwrites `src/types/database.ts`. Review the resulting changes before committing them.

## API routes

All CRM endpoints require a signed-in user and organization access. Admin-only operations are indicated below. The application is mounted in `src/app.ts`.

| Method | Route | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/` | Basic API response | Public |
| GET | `/health` | Health check | Public |
| GET | `/auth-test` | Verify authenticated user | Authenticated |
| GET | `/api/v1/leads` | List leads, with filters and pagination | Organization member |
| GET | `/api/v1/leads/:id` | Get one lead | Organization member |
| POST | `/api/v1/leads` | Create a lead | Organization member |
| PATCH | `/api/v1/leads/:id` | Update a lead | Organization member |
| DELETE | `/api/v1/leads/:id` | Delete a lead | Admin |
| PATCH | `/api/v1/leads/:id/assign` | Assign or unassign a lead | Admin |
| GET | `/api/v1/leads/:id/activities` | View lead activity history | Organization member |
| GET | `/api/v1/leads/:id/notes` | List lead notes | Organization member |
| POST | `/api/v1/leads/:id/notes` | Add a note | Organization member |
| PATCH | `/api/v1/leads/:id/notes/:noteId` | Edit a note | Organization member; note ownership enforced by database policy |
| DELETE | `/api/v1/leads/:id/notes/:noteId` | Delete a note | Organization member; note ownership enforced by database policy |
| GET | `/api/v1/organization-members` | List organization members | Admin |
| POST | `/api/v1/organization-members` | Add an organization member | Admin |
| PATCH | `/api/v1/organization-members/:userId/role` | Change a member's role | Admin |
| DELETE | `/api/v1/organization-members/:userId` | Remove a member | Admin |

The service and PostgreSQL RLS policies further restrict which records a given member can access. The table above describes route-level guards, not a guarantee of access to every record.

## Architecture

The backend follows a feature-based modular monolith:

```text
src/
├── app.ts                   # Hono app, global middleware, and route mounting
├── index.ts                 # Cloudflare Worker entry point
├── config/                  # Environment definitions and validation
├── core/                    # Shared authentication and error handling
├── features/
│   ├── leads/               # Leads, lifecycle, notes, and activity
│   └── organization-members/ # Organization membership management
├── middleware/              # Authentication, organization access, roles, logging
├── platform/                # Database-related utilities
├── shared/                  # Reusable validation helpers
└── types/                   # App and generated database types
```

A typical request flows through:

```text
Request → Middleware → Route → Controller → Service → Repository → Supabase/PostgreSQL
```

- **Routes** define HTTP endpoints and guards.
- **Controllers** validate and translate HTTP input/output.
- **Services** enforce business rules.
- **Repositories** query or update the database.
- **Database constraints and RLS** provide an additional security and integrity boundary.

Read [`AGENTS.md`](./AGENTS.md) for detailed coding standards, security rules, and agent workflow. Claude Code can also load the same instructions through [`CLAUDE.md`](./CLAUDE.md).

## Testing

Run both checks before opening a pull request:

```bash
npm run typecheck
npm test
```

Service unit tests use mocks and **do not require a live Supabase connection**. They verify service behavior but **do not replace database integration tests** for PostgreSQL constraints, RLS policies, and concurrency.

The repository's `.github/workflows/ci.yml` is configured to run type checking and unit tests on pushes and pull requests targeting `main`, provided GitHub Actions can start the runner.

## Security and development notes

- Keep `SUPABASE_SECRET_KEY` strictly server-side. Never expose it to frontend code.
- Do not bypass authentication, organization access checks, or RLS.
- Staff and admin access differ; always check service and database authorization rules before changing an endpoint.
- Preserve last-admin protection, lead lifecycle validation, and note ownership restrictions.
- Never edit the generated database types manually when regeneration is appropriate.
- Prefer small, readable changes with focused tests. See `AGENTS.md` for the full coding guidelines.
