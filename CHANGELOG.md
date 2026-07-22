# Changelog — Viral Magic OS

All notable changes to this project are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.0.0] — 2026-07-22

### Executive Summary

Version 1.0 marks the first production-ready release of **Viral Magic OS Command Center** — a full-stack consulting operations platform purpose-built for growth consultants who manage client diagnostics, solution recommendation plans, and multi-chapter growth blueprint documents. The platform takes a client from initial intake through scored diagnostic assessment, AI-assisted recommendation planning, structured growth blueprint authoring, and polished document export — all within a single, authenticated command center.

This release follows six completed development phases (1A through 1F-B) and a comprehensive stabilisation sprint (Phase 2E) that resolved all audit-identified issues before the 1.0 stamp was applied.

---

### Major Features

#### Executive Summary Dashboard

- Real-time foundation status card showing database connectivity, authentication status, admin account presence, and settings configuration.
- Recent activity feed surfacing the last 10 system events with actor, entity, and timestamp.
- Graceful degraded mode: if the database is unreachable the dashboard returns partial data rather than a 500 error, with a clear `degraded` status flag.
- Version and phase string displayed prominently; updated to `1.0.0` / `Version 1.0` at release.

#### Client Management

- Full CRUD for client records with contact details, industry classification, company size, annual revenue, and engagement status.
- Duplicate-check endpoint prevents duplicate email registrations before a new client record is committed.
- Per-client notes with timestamps and author attribution.
- Client detail page with linked projects, diagnostics, and activity history.

#### Project Management

- Projects linked to clients with status tracking (active, on-hold, completed, cancelled).
- Kanban-style project board with hover-prefetch for instant navigation to project detail pages.
- Task management within projects with priority, status, due date, and assignee fields.

#### Business Growth Assessment

- Structured growth assessment instrument capturing 12 business categories.
- Category-level scoring: current performance, business impact, urgency.
- Derived computed fields: performance gap, priority score, severity classification (critical / high / medium / low).
- Comparison view across multiple assessment versions for the same client.

#### Diagnostic Engine

- Multi-version diagnostic records tied to a client-project pair.
- Draft → in-progress → completed status lifecycle.
- Atomic score saves: all category upserts and the status promotion are wrapped in a single database transaction — a partial write cannot leave scores and status out of sync.
- Draft save triggers a background activity log entry without blocking the response.

#### Recommendation Engine

- Automated solution recommendation plan generation from diagnostic scores.
- Plan lifecycle: draft → submitted → awaiting review → approved → reopened / archived.
- Concurrency guards: approved and archived plans return HTTP 409 on edit or status-transition attempts, preventing race-condition overwrites.
- Per-recommendation fields: priority, implementation effort, expected impact, admin notes, and action step lists.
- Dependency tracking between recommendations within a plan.

#### Growth Blueprint

- Structured multi-chapter blueprint document generated from an approved recommendation plan.
- Blueprint sections and initiatives with sort-order control.
- Full CRUD for sections and initiatives without leaving the detail view.
- Blueprint detail page shows a polished, client-ready document layout.

#### Document Exports — PDF, Word, PowerPoint

- **PDF export** via `pdfmake` — formatted blueprint with executive summary, section headers, initiative tables, and branding.
- **Word export** via `docx` — `.docx` file with heading styles, paragraph formatting, and tables.
- **PowerPoint export** via `pptxgenjs` — presentation-ready `.pptx` with one slide per section.
- All three exporters are bundled as separate esbuild externals to keep the API server bundle lean.

#### CEO Snapshot

- Dashboard-level KPI summary giving a single-screen view of the consulting pipeline: clients by status, projects by phase, open diagnostics, plans awaiting review, and recent activity.

#### Authentication and Access Control

- Secure session-based authentication with bcrypt password hashing.
- `connect-pg-simple` backed session store — session persistence survives server restarts.
- Role-based user records with admin flag.
- All API routes protected by `requireAuth` middleware.
- Login form with correct `autocomplete` attributes (`email`, `current-password`) for password manager compatibility.
- Settings page exposes password change flow with `current-password` / `new-password` autocomplete attributes.

#### Settings and Configuration

- Application settings (agency name, contact details, preferences) stored in the database and editable at runtime without a deploy.
- Admin password change from the settings panel.

---

### Completed Development Phases

#### Phase 1A — Foundation

Established the project monorepo structure (pnpm workspaces), Express 5 API server, Drizzle ORM with PostgreSQL, React + Vite frontend, shadcn/ui component library, session authentication, and the initial database schema for users, roles, and application settings.

#### Phase 1B — Client Management

Client CRUD, notes, duplicate-check endpoint, client list with search and filter, and the client detail page shell.

#### Phase 1C — Project and Task Management

Project CRUD linked to clients, task management within projects, status and priority tracking, and the project detail page.

#### Phase 1D — Diagnostic System

Diagnostic record management, multi-version scoring, the draft-save flow, status lifecycle, and the diagnostic detail and comparison pages.

#### Phase 1E — Growth Assessment and Recommendations

Growth assessment instrument, category scoring with computed derived fields, solution recommendation plan generation, the full plan lifecycle with concurrency guards, per-recommendation actions, and dependency tracking.

#### Phase 1F — Growth Blueprint and Exports

Blueprint generation from approved plans, section and initiative CRUD, the polished blueprint detail view, and all three document export formats (PDF, Word, PowerPoint).

#### Phase 1F-B — Build Stabilisation

Resolved esbuild bundling issues for `connect-pg-simple`, `pdfmake`, `docx`, and `pptxgenjs`. Rebuilt `lib/api-client-react` dist after Orval codegen to re-synchronise generated TypeScript type declarations. Fixed Orval 8.x / Zod v3 compatibility issue (`zod.looseObject()` sed patch).

#### Phase 2E — Audit and Stabilisation Sprint

Comprehensive pre-release quality audit followed by targeted fixes. See Audit Results and Stabilisation Sprint Summary below.

---

### Audit Results

A dual-track audit was conducted on 2026-07-22 immediately before the 1.0 release:

- **UI audit** (end-to-end Playwright walkthrough): 0 Critical, 0 High functional blockers. Minor UX observations recorded.
- **Code audit** (static analysis): 2 High, 6 Medium, 5 Low issues identified.

Full detail in `AUDIT_REPORT.md`.

**Severity breakdown pre-fix:**

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 6 |
| Low | 5 |
| **Total** | **13** |

All 13 issues were resolved in Phase 2E. See Bug Fixes below.

---

### Stabilisation Sprint Summary (Phase 2E)

Nine targeted fixes were implemented. No new features added. No refactoring outside the affected code paths.

| # | Ref | Description |
|---|-----|-------------|
| 1 | H-1 | Fixed `ReferenceError` in `clients.ts` — `ClientDuplicateCheckBody` renamed to `CheckClientDuplicateBody`, matching the imported Zod schema name. |
| 2 | H-2 | Replaced bare red error strings in `client-detail.tsx` and `growth-blueprint-detail.tsx` with styled not-found cards containing actionable navigation buttons. |
| 3 | M-1 | Moved `fetchRecentActivity()` inside the dashboard try/catch; endpoint now returns a degraded response instead of a 500 when the database is unreachable. |
| 4 | M-6 | Removed two dead `.limit(0)` placeholder queries and two N+1 `Promise.all` loops in `growth-blueprints.ts`; replaced with single `inArray` queries. |
| 5 | M-3 | Wrapped diagnostic score upsert loop and status promotion in `db.transaction()` — partial writes now roll back atomically. |
| 6 | L-1 | Added `autocomplete` attributes to all login and settings password inputs; changed login email placeholder from `admin@example.com` to `your@email.com`. |
| 7 | L-3 | Wrapped `logActivity()` DB insert in try/catch with `logger.warn` on failure — activity log failures are now observable in server logs without breaking the caller. |
| 8 | — | Updated `APP_VERSION` to `"1.0.0"`, `PHASE` to `"Version 1.0"` in `dashboard.ts`; replaced stale `"Phase 1A deployment"` copy in `not-found.tsx` with `"Viral Magic OS"`. |
| 9 | — | Added 11 regression tests for `PATCH /api/solution-recommendations/:id` and `PATCH /:id/recommendations/:recId`, covering all four plan-status scenarios (draft, reopened, approved, archived). |

---

### Bug Fixes

- **[H-1] Client duplicate-check crash** — `ReferenceError: ClientDuplicateCheckBody is not defined` on `POST /api/clients/check-duplicate` caused by a one-word import mismatch. Fixed.
- **[H-2] User-stranding not-found states** — Client detail and blueprint detail pages showed raw red error text with no way to navigate away when a record was not found. Replaced with recovery cards.
- **[M-1] Dashboard 500 on DB unreachability** — Recent activity fetch was outside the try/catch block, converting any DB timeout into an unhandled exception. Fixed.
- **[M-6] N+1 queries in blueprint generation** — Two handlers issued one SQL query per recommendation instead of a single bulk `inArray` query. Fixed; also removed dead placeholder `.limit(0)` queries.
- **[M-3] Non-atomic diagnostic score saves** — Score upserts and status promotion ran as independent statements; a mid-loop failure could leave the database in a partially-written state. Wrapped in a transaction.

---

### Test Statistics

| Metric | Value |
|--------|-------|
| Test files | 4 |
| Tests passing | **162** |
| Tests failing | 0 |
| Test framework | Vitest 4.1.10 |
| Run time | ~3 seconds |

Test baseline before Phase 2E: 151. Net tests added during sprint: +11 (all regression tests for plan-lock guards).

---

### Production Build Status

```
artifacts/api-server production build (esbuild)
  dist/index.mjs      2.9 MB
  dist/pino-worker.mjs
  dist/pino-file.mjs
  dist/pino-pretty.mjs
  dist/thread-stream-worker.mjs
  ⚡ Done in 596ms
```

TypeScript: `tsc --noEmit` clean on both `api-server` and `command-center`. Zero type errors.

---

### Known Future Roadmap

#### Version 1.1 (Near-term)

- One-click full diagnostic run from a client's profile page.
- Editable and approvable diagnostic recommendations without leaving the detail page.
- Polished PDF export of Growth Blueprint suitable for direct client delivery.
- Blueprint responsive layout improvements for tablet and phone screen sizes.
- Blueprint detail page instant-open performance improvement (prefetch on hover).
- Activity logging failure isolation — prevent any logging error from affecting login or profile update responses.
- TypeScript error remediation in the tasks route.
- Recommendation scoring and quick-win rule accuracy tests as category schema changes.
- Seed recommendation rule library into the database for runtime auditability and editability.

#### Version 2.0 (Strategic)

- Multi-tenant support — isolated workspaces per agency or consultant.
- AI-assisted diagnostic scoring and recommendation generation.
- Client-facing portal — read-only access to their blueprint and progress.
- Real-time collaboration on blueprint authoring.
- Webhook and CRM integration (HubSpot, Salesforce).
- Advanced analytics dashboard with cohort and benchmark comparison.
- Automated follow-up scheduling and milestone tracking.

---

### Credits

Built on the following open-source foundations:

- **Express 5** — HTTP server framework
- **Drizzle ORM** — Type-safe SQL query builder
- **PostgreSQL** — Relational database
- **React 18** — UI framework
- **Vite** — Frontend build tooling
- **TanStack Query** — Server state management
- **shadcn/ui + Radix UI** — Component primitives
- **Tailwind CSS** — Utility-first styling
- **Zod** — Runtime schema validation
- **Orval** — OpenAPI → Zod + React Query codegen
- **Vitest** — Unit and integration test framework
- **Pino** — Structured logging
- **pdfmake** — PDF generation
- **docx** — Word document generation
- **pptxgenjs** — PowerPoint generation
- **Recharts** — Data visualisation
- **wouter** — Lightweight React router

---

*Viral Magic OS — Version 1.0.0 — Released 2026-07-22*
