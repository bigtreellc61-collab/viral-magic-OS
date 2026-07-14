# Viral Magic OS — Software Factory Command Center

An internal command center for running a software-development agency: one Administrator manages clients, projects, diagnostics, and delivery pipelines. **Currently at Phase 1A: foundation only** — authentication, app shell, dashboard, and settings. No business modules (clients, projects, diagnostics, blueprints, billing, client portal) exist yet.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm --filter @workspace/command-center run dev` — run the web frontend (artifact preview path `/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec after editing `lib/api-spec/openapi.yaml`
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` (Postgres, already provisioned), `SESSION_SECRET` (already configured as a secret)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5, session-based auth (`express-session` + `connect-pg-simple` + `bcryptjs` + `express-rate-limit`)
- DB: PostgreSQL + Drizzle ORM
- Frontend: React + Vite + wouter + TanStack Query, shadcn/ui + Tailwind
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec) → Zod request/response schemas + React Query hooks
- Build: esbuild (ESM bundle)

## Where things live

- API contract: `lib/api-spec/openapi.yaml` (source of truth) → codegen produces `lib/api-zod/src/generated/api.ts` (Zod) and `lib/api-client-react/src/generated/api.ts` (React Query hooks)
- DB schema: `lib/db/src/schema/*.ts` (`roles`, `users`, `applicationSettings`, `activityRecords`)
- Backend routes: `artifacts/api-server/src/routes/*.ts` (`auth`, `settings`, `activity`, `dashboard`, `health`)
- Auth/session config: `artifacts/api-server/src/lib/auth.ts`; auth guard: `artifacts/api-server/src/middlewares/authMiddleware.ts`
- Startup seeding (idempotent): `artifacts/api-server/src/lib/bootstrap.ts`
- Frontend app shell/pages: `artifacts/command-center/src/{App.tsx,pages,components}`

## Architecture decisions

- **Custom session auth, not Replit OIDC.** The product needs a traditional email+password Administrator login (bcrypt + rate limiting + first-run setup), which doesn't fit the "Sign in with Replit" flow, so auth is hand-rolled with `express-session`.
- **First-run setup is a "zero-user gate", not a token-based flow.** `POST /auth/setup` only succeeds while the `users` table is empty; it's a deliberate Phase 1A simplification of the fuller `setup_tokens` design in the architecture doc — avoids needing email delivery while still preventing public registration.
- **Settings are one singleton row with typed columns** (`application_settings`, `id = 1`), not a generic key/value store — Phase 1A's settings fields are fixed and known, so explicit columns bind directly to the Settings UI.
- **The session table (`session`) is NOT part of the Drizzle-managed schema.** `connect-pg-simple` auto-creates it (`createTableIfMissing: true`). It must NOT be added to Drizzle schema files — that would fight the library's own migrations.
- **`connect-pg-simple` must stay external in the esbuild bundle.** It reads a sibling `table.sql` file via path traversal at runtime; if esbuild bundles it into `dist/index.mjs`, that read fails with `ENOENT`. It's excluded in `artifacts/api-server/build.mjs`'s `external` list — keep it there if the build config is ever rewritten.
- Passwords are hashed with `bcryptjs` (pure JS, no native build step). Changing a password rotates `passwordChangedAt`, which invalidates all other active sessions for that account (checked in `requireAuth`).

## Product

Phase 1A gives a single Administrator:
- A one-time setup screen to create the first (and only) admin account.
- Email/password login with "remember me" (8-hour rolling session vs. 30-day).
- A dashboard showing real foundation status (DB, auth, admin account, settings) and a recent activity feed.
- A settings page for business profile, branding, project defaults, and account/password management.

Later phases (not built yet): clients, projects, diagnostics, bottleneck scoring, platform matcher, blueprints, tasks, AI integrations, billing, public registration, client portal, viral growth engine.

## User preferences

- Visual direction: premium executive SaaS — deep navy/near-black background, electric violet primary accent, blue secondary, emerald/amber/red status colors, minimal gradients, clean sans-serif.

## Gotchas

- After editing `lib/api-spec/openapi.yaml`, always run the codegen command, then `pnpm -w run typecheck:libs` (bundled into the codegen script) before touching backend/frontend code that uses the new types.
- Component/request schema names in the OpenAPI spec must be entity-shaped (e.g. `SetupInput`, not `CompleteSetupBody`) — Orval still names the generated Zod schema after the operation (e.g. `CompleteSetupBody`), but keeping the *component* name entity-shaped avoids `<OperationIdPascal>Body` collisions during codegen.
- After changing `lib/db/src/schema/*.ts`, run `pnpm --filter @workspace/db run push`, then rebuild the package's TS project refs (`pnpm exec tsc --build --force` inside `lib/db`) before typechecking consumers — otherwise consumers see stale `.d.ts` files and report missing exports that actually exist.
- Zod v3 (pinned in this workspace) has no top-level `z.email()`/`format: email` helper the way Zod v4 does; don't add `format: email` to OpenAPI string schemas or codegen's generated Zod file fails to typecheck.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Full multi-phase architecture: `docs/viral-magic-os-architecture.md`
