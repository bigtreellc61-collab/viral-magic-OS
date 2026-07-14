# Viral Magic OS — Software Factory Command Center
## Architecture & Implementation Plan (Phase 1)

Status: **DRAFT FOR REVIEW — no code has been written.** This document is the architecture and planning deliverable requested. Implementation should not begin until this plan is approved and open questions (Section 18) are resolved.

---

## 1. Executive Architecture Summary

Viral Magic OS is an internal command center that turns a messy intake conversation with a client into a structured, repeatable pipeline: diagnose the client's business bottlenecks, score and prioritize them, recommend a solution, match it to the right build platform, generate a software blueprint, and track the resulting project through tasks to completion.

Phase 1 is a single-tenant, single-admin internal tool. It is not client-facing, has no billing, and makes no external AI calls. Its value in Phase 1 is entirely in **structured decision-making** (diagnostics → scoring → recommendation → platform match → blueprint → execution), backed by a normalized relational database that preserves history (diagnostic versions, activity log) rather than overwriting it.

The architecture is deliberately "boring and modular": a typical TypeScript/React/Node/PostgreSQL stack, organized so that today's five in-house rule engines (diagnostics, bottleneck scoring, solution architect, platform matcher, blueprint generator) are swappable services behind stable interfaces. This is what lets Phase 2+ modules (AI Agent Builder, Client Portal, White-Label, Subscription Billing, industry suites) plug in later without touching the core schema or workflow engine.

Guiding principles:
- **Contract-first**: every module talks to the rest of the system through a typed API layer and Zod-validated schemas, never through direct cross-module DB reads.
- **History over mutation**: diagnostics, scores, and blueprints are versioned records, not fields that get overwritten.
- **Rule engines, not hardcoded logic**: bottleneck scoring, platform matching, and blueprint generation are driven by data-defined rules/weights stored in the database, so they can be tuned without a redeploy and later swapped for AI-assisted versions.
- **Role-ready, not role-built**: the schema and middleware support multiple roles from day one; Phase 1 only *populates* one Administrator.

---

## 2. Recommended Technology Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (strict) end to end | One type system across client/server/DB, matches existing workspace conventions |
| Frontend | React + Vite | Fast dev loop, already the workspace default |
| Frontend data layer | TanStack Query, generated from OpenAPI (Orval) | Type-safe hooks, no hand-written fetch/parsing code |
| Frontend state | React Query for server state; local component/URL state for UI state (no global client store needed in Phase 1) | Avoids duplicating server state in a separate store (see Section 8) |
| UI components | Existing shared shadcn/ui-based component set | Reuse, consistent design system |
| Backend | Node.js + Express 5 | Matches existing `api-server` artifact already in the workspace |
| Validation | Zod (shared schemas generated from OpenAPI, `drizzle-zod` for DB-aligned schemas) | Single source of truth for request/response and DB shape validation |
| ORM | Drizzle ORM | Already the workspace standard; typed SQL, lightweight migrations, good fit for a normalized relational schema |
| Database | PostgreSQL | Relational integrity for the many foreign-keyed entities (clients → projects → diagnostics → scores → blueprints → tasks) |
| API contract | OpenAPI spec → codegen (Orval + Zod) | Frontend and backend both derive from one contract; prevents drift |
| Auth (Phase 1) | Single internal Administrator session-based auth | See Section 5 |
| Background/report calc | In-process service functions (no queue needed at Phase 1 volume) | Scoring and matching are synchronous, deterministic, sub-second operations |
| Testing | Vitest (unit) + Playwright-based e2e smoke pass per phase | Matches available tooling in the environment |
| Deployment | Single Node process serving API + static built frontend, PostgreSQL as managed DB | Matches existing artifact deployment model |

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React Frontend                        │
│  Dashboard / Clients / Projects / Diagnostics / Solution     │
│  Architect / Platform Matcher / Blueprints / Tasks /         │
│  Activity / Settings                                         │
│  — talks only through generated API hooks (TanStack Query)   │
└───────────────────────────┬───────────────────────────────────┘
                             │ HTTPS (session cookie)
┌───────────────────────────▼───────────────────────────────────┐
│                       Express API Layer                       │
│  Route handlers → Zod validation → Service layer → Drizzle    │
│                                                                 │
│  Services (pure, testable, swappable):                        │
│   - ClientService          - DiagnosticService                │
│   - ProjectService          - BottleneckScoringEngine          │
│   - SolutionArchitectEngine - PlatformMatcherEngine            │
│   - BlueprintService        - TaskService                      │
│   - ActivityLogService      - SettingsService                  │
│                                                                 │
│  Cross-cutting middleware: auth/session, request logging,     │
│  activity logging, error handling, input validation           │
└───────────────────────────┬───────────────────────────────────┘
                             │ SQL (Drizzle)
┌───────────────────────────▼───────────────────────────────────┐
│                     PostgreSQL (normalized)                   │
│  Users/Roles, Clients, Projects, Diagnostics (versioned),     │
│  Scores, Recommendations, Platform Evaluations, Blueprints,   │
│  Tasks, Activity, Settings, Templates                         │
└─────────────────────────────────────────────────────────────┘
```

Each "engine" (Bottleneck Scoring, Solution Architect, Platform Matcher, Blueprint generation) is a **pure service module**: given inputs it reads from the DB, it computes a deterministic result and writes a versioned record. None of them call each other directly — they are orchestrated by route handlers per workflow (Section 8). This is what allows a future AI-assisted engine to be swapped in behind the same interface.

---

## 4. Folder and Code Organization

Following the existing monorepo conventions (`artifacts/*` for deployable apps, `lib/*` for shared libraries):

```
lib/
  api-spec/                 # OpenAPI source of truth + orval config
  api-client-react/         # Generated TanStack Query hooks (frontend consumes this)
  api-zod/                  # Generated Zod schemas (backend + frontend validation)
  db/
    src/schema/
      users.ts  roles.ts  clients.ts  client-notes.ts
      projects.ts
      diagnostics.ts  diagnostic-versions.ts  diagnostic-categories.ts  diagnostic-scores.ts
      bottleneck-recommendations.ts
      solution-architect-records.ts
      platforms.ts  platform-evaluations.ts
      blueprints.ts  blueprint-sections.ts
      tasks.ts
      activity-records.ts
      settings.ts
      industry-templates.ts  prompt-templates.ts
      index.ts               # barrel export + relations

artifacts/
  api-server/
    src/
      routes/
        clients.ts  projects.ts  diagnostics.ts  scoring.ts
        solution-architect.ts  platform-matcher.ts  blueprints.ts
        tasks.ts  activity.ts  settings.ts  dashboard.ts  auth.ts
      services/
        client-service.ts  project-service.ts
        diagnostic-service.ts
        bottleneck-scoring-engine.ts
        solution-architect-engine.ts
        platform-matcher-engine.ts
        blueprint-service.ts
        task-service.ts
        activity-log-service.ts
        settings-service.ts
      middlewares/
        auth.ts  activity-logger.ts  error-handler.ts  validate.ts
      lib/  (existing logger, db client)

  command-center/            # new react-vite artifact (the actual product UI)
    src/
      pages/
        dashboard/  clients/  projects/  diagnostics/
        solution-architect/  platform-matcher/  blueprints/
        tasks/  activity/  settings/
      components/            # shared presentational components
      lib/                   # frontend-only helpers (formatting, routing)
```

Rules carried over from the monorepo conventions already in place: `artifacts/*` packages never import from each other directly; shared logic goes in `lib/*`; the OpenAPI spec in `lib/api-spec` is the single contract gate before any frontend or backend work begins.

---

## 5. Database Schema

All tables use `id` (UUID, primary key, default `gen_random_uuid()`), `createdAt` and `updatedAt` (`timestamptz`, default `now()`, `updatedAt` maintained on write). Soft-delete strategy is noted per table — the default is a nullable `archivedAt timestamptz` column (soft delete / archive) rather than hard deletes, so history stays intact for reporting and auditing.

### users
- Purpose: internal operators who log into the system.
- Key fields: `email` (unique, required), `passwordHash` or auth-provider subject id, `fullName` (required), `roleId` (FK → roles, required), `isActive` (boolean, default true).
- Relationships: `roleId` → `roles.id`. Referenced by `activityRecords.userId`, `tasks.assignedToUserId`, `clientNotes.authorUserId`.
- Archive strategy: `archivedAt` (deactivate instead of delete, to preserve historical attribution on activity/tasks).

### roles
- Purpose: defines the permission tiers (Administrator, Team Member, Contractor, Client, Read-Only User) even though Phase 1 only uses Administrator.
- Key fields: `name` (unique, required), `permissions` (jsonb — array/map of permission keys), `isSystemRole` (boolean).
- Relationships: referenced by `users.roleId`.
- Archive strategy: none needed (small static reference table); soft-delete via `archivedAt` for safety if a custom role is retired.

### clients
- Purpose: the businesses being consulted for.
- Key fields: `name` (required), `industry`, `website`, `primaryContactName`, `primaryContactEmail`, `primaryContactPhone`, `status` (enum: prospect/active/inactive), `notes` (short summary field; detailed notes live in `clientNotes`).
- Relationships: parent of `projects`, `diagnostics`, `clientNotes`.
- Archive strategy: `archivedAt` (soft delete; clients are rarely truly deleted since projects/diagnostics reference them).

### client_notes
- Purpose: freeform timestamped notes/log entries about a client (calls, context, decisions).
- Key fields: `clientId` (FK, required), `authorUserId` (FK, required), `body` (text, required).
- Relationships: `clientId` → `clients.id`; `authorUserId` → `users.id`.
- Archive strategy: `archivedAt` (soft delete only; notes are audit trail, never hard-deleted).

### projects
- Purpose: a unit of work/build tracked from creation through completion, tied to a client (or standalone per Workflow 2).
- Key fields: `clientId` (FK, nullable — a project can be created before a client is fully diagnosed), `name` (required), `description`, `status` (enum: planning/in_progress/blocked/completed/cancelled), `solutionArchitectRecordId` (FK, nullable), `selectedPlatformId` (FK → platforms, nullable), `activeBlueprintId` (FK → software_blueprints, nullable), `startedAt`, `targetCompletionAt`.
- Relationships: `clientId` → `clients.id`; parent of `tasks`, `softwareBlueprints`; links to `solutionArchitectRecords` and `platformEvaluations`.
- Archive strategy: `archivedAt` (soft delete/archive when cancelled or closed out long-term).

### diagnostics
- Purpose: the "container" for a business diagnostic run against a client — one diagnostic can have multiple versions over time (Workflow 4).
- Key fields: `clientId` (FK, required), `title` (required, e.g. "Q1 2026 Diagnostic"), `currentVersionId` (FK → diagnostic_versions, nullable until first version is scored), `status` (enum: draft/scored/archived).
- Relationships: `clientId` → `clients.id`; parent of `diagnosticVersions`.
- Archive strategy: `archivedAt`.

### diagnostic_versions
- Purpose: an immutable snapshot of one scoring pass of a diagnostic — created every time the diagnostic is edited and rescored (Workflow 4: "Preserve Previous Results").
- Key fields: `diagnosticId` (FK, required), `versionNumber` (int, required, sequential per diagnostic), `overallSeverityLabel` (enum: healthy/monitor/moderate/high/critical — computed from scores), `overallPriorityTotal` (numeric — sum/aggregate of category priority scores), `createdByUserId` (FK), `notes`.
- Relationships: `diagnosticId` → `diagnostics.id`; parent of `diagnosticScores`; referenced by `diagnostics.currentVersionId` and by `bottleneckRecommendations.diagnosticVersionId`.
- Archive strategy: versions are never deleted (immutable history); no archive field needed, they are simply superseded by a newer `currentVersionId` pointer.

### diagnostic_categories
- Purpose: the fixed (but data-driven, so future categories can be added) list of the 15 categories being scored (Lead Generation, Traffic and Visibility, Lead Capture, Speed to Lead, Follow-Up, Sales Conversion, Customer Retention, Reputation and Reviews, Content Marketing, Website Performance, Automation, Technology Integration, Reporting and Analytics, Operational Efficiency, Scalability).
- Key fields: `key` (unique slug, required), `label` (required), `description`, `sortOrder` (int).
- Relationships: referenced by `diagnosticScores.categoryId`.
- Archive strategy: `archivedAt` (retire a category without breaking historical score records that reference it).

### diagnostic_scores
- Purpose: one row per category per diagnostic version — holds the raw inputs and the computed result (Section 11 has the formula).
- Key fields: `diagnosticVersionId` (FK, required), `categoryId` (FK, required), `currentPerformance` (numeric 0–10, required), `businessImpact` (numeric 1–5, required), `urgency` (numeric 1–5, required), `performanceGap` (numeric, computed = 10 − currentPerformance), `priorityScore` (numeric, computed = performanceGap × businessImpact × urgency), `severityLabel` (enum: healthy/monitor/moderate/high/critical, computed).
- Relationships: `diagnosticVersionId` → `diagnostic_versions.id`; `categoryId` → `diagnostic_categories.id`. Unique constraint on (`diagnosticVersionId`, `categoryId`).
- Archive strategy: none (immutable, tied to an immutable version).

### bottleneck_recommendations
- Purpose: the ranked output of the Bottleneck Scoring step — which categories are the priority bottlenecks and the recommended action/solution direction for each, feeding into the Solution Architect step.
- Key fields: `diagnosticVersionId` (FK, required), `categoryId` (FK, required), `rank` (int — priority order), `recommendationText` (text), `suggestedSolutionType` (text/enum, e.g. "automation", "CRM implementation", "content system").
- Relationships: `diagnosticVersionId` → `diagnostic_versions.id`; `categoryId` → `diagnostic_categories.id`; feeds into `solution_architect_records.sourceRecommendationId`.
- Archive strategy: none needed (immutable, tied to immutable version); superseded naturally by a new diagnostic version's recommendations.

### solution_architect_records
- Purpose: the recommended business solution produced from one or more bottleneck recommendations, prior to picking a build platform.
- Key fields: `clientId` (FK, required), `sourceDiagnosticVersionId` (FK, nullable — a solution can also be authored manually), `projectId` (FK, nullable until attached to a project), `problemSummary` (text, required), `recommendedSolution` (text, required), `expectedOutcome` (text), `status` (enum: draft/approved/superseded), `createdByUserId` (FK).
- Relationships: `clientId` → `clients.id`; `sourceDiagnosticVersionId` → `diagnostic_versions.id`; `projectId` → `projects.id`; parent of `platformEvaluations`.
- Archive strategy: `archivedAt` (superseded records are archived, not deleted, to preserve the decision trail).

### platforms
- Purpose: the fixed reference list of buildable platforms (Replit, Lovable, DCS AI Studio, WordPress, Airtable, Custom Development) plus their scoring metadata.
- Key fields: `key` (unique slug, required), `name` (required), `description`, `strengths` (jsonb), `limitations` (jsonb), `isActive` (boolean).
- Relationships: referenced by `platformEvaluations.platformId`, `projects.selectedPlatformId`.
- Archive strategy: `archivedAt` (retire a platform without breaking historical evaluations).

### platform_evaluations
- Purpose: one row per platform scored against a given solution architect record during a Platform Matcher run (Workflow 1 and 2).
- Key fields: `solutionArchitectRecordId` (FK, required), `platformId` (FK, required), `totalScore` (numeric, computed), `scoreBreakdown` (jsonb — per-criterion sub-scores: project type, complexity, custom logic, DB requirements, auth, API integrations, CRM requirements, design importance, dev speed, budget, scalability, ownership, maintenance capability, internal/public use), `isRecommended` (boolean — top-ranked flag), `runAt` (timestamptz).
- Relationships: `solutionArchitectRecordId` → `solution_architect_records.id`; `platformId` → `platforms.id`.
- Archive strategy: none needed (immutable snapshot of one matcher run); a re-run simply creates a new set of rows tied to a new `runAt`/or a `matcherRunId` grouping if multiple re-runs per record are needed later (see open question in Section 18).

### software_blueprints
- Purpose: the top-level blueprint record for a project — see Section 13 for the storage-model tradeoff.
- Key fields: `projectId` (FK, required), `productName` (required), `status` (enum: draft/final/superseded), `recommendedPlatformId` (FK, nullable), `versionNumber` (int), `createdByUserId` (FK).
- Relationships: `projectId` → `projects.id`; `recommendedPlatformId` → `platforms.id`; parent of `blueprintSections`.
- Archive strategy: `archivedAt` for superseded blueprint versions.

### blueprint_sections
- Purpose: one row per named section of the blueprint (Executive Summary, Business Problem, Target User, ... Acceptance Criteria — the 24 sections listed in scope).
- Key fields: `blueprintId` (FK, required), `sectionKey` (enum/slug, required — matches the fixed section list), `content` (text or jsonb depending on section type), `sortOrder` (int).
- Relationships: `blueprintId` → `software_blueprints.id`. Unique constraint on (`blueprintId`, `sectionKey`).
- Archive strategy: none needed at the row level; the whole blueprint is archived as a unit via `software_blueprints.archivedAt`.

### tasks
- Purpose: actionable work items tracked per project (Workflow 3).
- Key fields: `projectId` (FK, required), `title` (required), `description`, `status` (enum: todo/in_progress/blocked/done), `priority` (enum: low/medium/high), `assignedToUserId` (FK, nullable), `dueDate` (date, nullable), `completedAt` (timestamptz, nullable).
- Relationships: `projectId` → `projects.id`; `assignedToUserId` → `users.id`.
- Archive strategy: `archivedAt` (archive completed/cancelled tasks after reporting window instead of deleting).

### activity_records
- Purpose: append-only audit/activity log across the whole system (Workflow 3: "Record Activity").
- Key fields: `userId` (FK, nullable — system-generated events may have no user), `entityType` (enum/text: client/project/diagnostic/task/blueprint/etc.), `entityId` (uuid), `action` (enum/text: created/updated/status_changed/scored/archived/etc.), `summary` (text, human-readable), `metadata` (jsonb — structured before/after or extra context).
- Relationships: `userId` → `users.id`; polymorphic reference via (`entityType`, `entityId`) rather than a hard FK, since it spans many entity tables.
- Archive strategy: none (append-only; retention/pruning strategy is a Phase 2+ operational concern, not a soft-delete concern).

### application_settings
- Purpose: single-row (or small key/value table) for system-wide configuration editable from the Settings screen (e.g. default scoring weights reference, company info, feature flags for future modules).
- Key fields: `key` (unique, required), `value` (jsonb, required), `description`.
- Relationships: none (standalone key/value store).
- Archive strategy: none needed (settings are updated in place; keep an `activity_records` entry per change for auditability).

### industry_templates
- Purpose: future-facing — pre-built diagnostic/solution/blueprint starting points per industry (e.g. HVAC, Real Estate). Table is created now so Phase 2 industry suites can attach without a schema change, but Phase 1 does not build UI for it.
- Key fields: `key` (unique), `name`, `description`, `defaultDiagnosticWeights` (jsonb, nullable), `defaultBlueprintSections` (jsonb, nullable), `isActive` (boolean).
- Relationships: optionally referenced by `clients.industryTemplateId` in a future migration (not in Phase 1 scope).
- Archive strategy: `archivedAt`.

### prompt_templates
- Purpose: future-facing — stores the platform-specific "build prompt" templates that will eventually be generated from a blueprint (e.g. a Replit-specific prompt template vs. a Lovable-specific one). Created now, not surfaced in Phase 1 UI beyond Settings visibility.
- Key fields: `platformId` (FK, nullable), `name` (required), `templateBody` (text, required — supports variable placeholders), `isActive` (boolean).
- Relationships: `platformId` → `platforms.id`.
- Archive strategy: `archivedAt`.

---

## 6. Entity Relationship Summary

```
roles ─< users
users ─< client_notes (author)
users ─< tasks (assignee)
users ─< activity_records

clients ─< client_notes
clients ─< diagnostics
clients ─< projects
clients ─< solution_architect_records

diagnostics ─< diagnostic_versions ─< diagnostic_scores >─ diagnostic_categories
diagnostic_versions ─< bottleneck_recommendations >─ diagnostic_categories
diagnostic_versions ─< solution_architect_records (sourceDiagnosticVersionId, optional)

solution_architect_records ─< platform_evaluations >─ platforms
solution_architect_records ─ projects (optional link)

projects ─< tasks
projects ─< software_blueprints ─< blueprint_sections
projects ─ platforms (selectedPlatformId)
projects ─ software_blueprints (activeBlueprintId)

platforms ─< platform_evaluations
platforms ─< prompt_templates

application_settings (standalone)
industry_templates (standalone, future FK target)
activity_records (polymorphic, references any entity by type+id)
```

Key design choice: **diagnostics are versioned as a separate table from scores**, and **solution architect records are separate from platform evaluations**, so each stage of the pipeline (diagnose → score → recommend → architect → match platform → blueprint → build) has its own immutable or independently-editable record. This is what supports Workflow 4 (edit diagnostic → new version → old results preserved) without cascading rewrites elsewhere.

---

## 7. Screen Inventory

| Screen | Purpose | Main components | Primary actions | Data shown | Forms | Filters | Related tables | Empty state | Error state | Mobile behavior |
|---|---|---|---|---|---|---|---|---|---|---|
| Dashboard | At-a-glance health of the whole pipeline | Metric cards, recent activity feed, priority bottleneck list, active projects summary | Jump to client/project | Counts (clients, active projects, open tasks), top bottlenecks across clients, recent activity | none | date range (optional) | projects, tasks, activity_records, diagnostic_scores | "No activity yet — create your first client" with CTA | Inline retry banner if metrics fail to load | Stacks metric cards vertically; activity feed becomes a simple list |
| Clients List | Browse/search all clients | Table/list, status badges | Create client, open client | Name, industry, status, active project count | none (search bar) | status, industry, search | clients | "No clients yet" + Create Client CTA | Table falls back to error row with retry | Table becomes stacked cards |
| Client Detail | Full view of one client | Tabs: Overview, Notes, Diagnostics, Projects | Edit client, add note, start diagnostic, create project | Client info, notes timeline, diagnostic history, linked projects | Add note inline form | none | clients, client_notes, diagnostics, projects | Empty tab states per section (e.g. "No diagnostics yet") | Section-level error banners | Tabs become a scrollable segment control |
| Client Form | Create/edit a client | Form fields, validation | Save, cancel | Existing client data (edit mode) | Client create/edit form | n/a | clients | n/a | Field-level + top-level validation errors | Full-screen form |
| Projects List | Browse/search all projects | Table/list, status badges, platform tag | Create project, open project | Name, client, status, platform, task progress | none (search bar) | status, client, platform | projects | "No projects yet" + Create Project CTA | Retry row | Stacked cards |
| Project Detail | Full view of one project | Tabs: Overview, Solution & Platform, Blueprint, Tasks | Update status, open blueprint, manage tasks, run platform matcher | Project info, linked client, solution architect record, platform evaluations, active blueprint, task list | Status update control | task status filter | projects, tasks, solution_architect_records, platform_evaluations, software_blueprints | "No tasks yet" / "No blueprint yet" per tab | Section-level error banners | Tabs → segmented scroll |
| Project Form | Create/edit a project | Form fields, client picker | Save, cancel | Existing project data (edit mode) | Project create/edit form | n/a | projects, clients | n/a | Validation errors | Full-screen form |
| Diagnostics List | Browse diagnostics across/within a client | Table/list | Start new diagnostic, open diagnostic | Client, title, latest severity, version count | none | client, severity | diagnostics, diagnostic_versions | "No diagnostics yet" + CTA | Retry row | Stacked cards |
| Diagnostic Form | Input the 15-category scoring form | Category rows with sliders/inputs for current performance, business impact, urgency | Save & score | Category list with computed live preview of performance gap / priority score | Score entry form (15 rows) | none | diagnostic_categories, diagnostic_versions, diagnostic_scores | Pre-filled with 0s/defaults on first run | Field-level validation (ranges) | One category per row, stacked full-width |
| Diagnostic Results | View a scored diagnostic version | Ranked bottleneck list, severity badge per category, overall severity | Create new version (edit), view recommendation, send to Solution Architect | Category scores, priority ranking, severity labels, recommendations | none | version selector (compare versions) | diagnostic_versions, diagnostic_scores, bottleneck_recommendations | n/a (always has data once scored) | Retry banner | Ranked list stacks vertically |
| Solution Architect | Turn bottleneck recommendations into a proposed solution | Recommendation summary, solution input form | Save solution, send to Platform Matcher | Linked diagnostic recommendations, problem summary, recommended solution | Solution record form | client/project filter | solution_architect_records, bottleneck_recommendations | "No solution yet — start from a diagnostic or write one manually" | Validation + retry | Single column form |
| Platform Matcher | Score platforms against a solution | Platform score table/cards, breakdown per criterion | Run/re-run matcher, select recommended platform | Per-platform scores and breakdown, recommended pick | Criteria input form (project type, complexity, etc.) | none | platform_evaluations, platforms, solution_architect_records | "Run the matcher to see platform scores" | Retry banner | Cards stack vertically |
| Blueprints List | Browse blueprints across projects | Table/list | Create blueprint, open blueprint | Project, product name, status, version | none | project, status | software_blueprints | "No blueprints yet" + CTA | Retry row | Stacked cards |
| Blueprint Editor | Edit all blueprint sections | Section-by-section editor (accordion or tabbed) | Save section, mark final, export/copy | All 24 blueprint sections' content | Per-section text/structured forms | section jump/search | software_blueprints, blueprint_sections | Sections start empty with placeholder guidance text | Per-section save error inline | Sections become a vertical accordion |
| Tasks List | Cross-project task board/list | Table or kanban-lite list, status/priority badges | Create task, update status | Title, project, assignee, status, priority, due date | none | project, status, assignee, priority | tasks | "No tasks yet" + CTA | Retry row | Stacked cards, status as a dropdown per row |
| Task Form | Create/edit a task | Form fields, project/assignee pickers | Save, cancel | Existing task data (edit mode) | Task create/edit form | n/a | tasks, projects, users | n/a | Validation errors | Full-screen form |
| Settings | System configuration | Sections: Company info, Scoring weight reference, Users (Admin only, read-mostly in Phase 1), Platforms reference | Update settings, view platform/category reference lists | Current settings values, static reference lists (categories, platforms) | Settings forms per section | none | application_settings, users, platforms, diagnostic_categories | n/a (settings always exist, seeded on init) | Validation + retry | Sections stack vertically |

Activity is not a separate top-level screen table row above because it appears embedded (Dashboard feed) but also deserves its own full screen:

| Activity History | Full audit trail | Filterable timeline/table | Filter, open related entity | Actor, action, entity, timestamp, summary | none | entity type, user, date range | activity_records | "No activity recorded yet" | Retry row | Timeline collapses to stacked entries |

---

## 8. Core User Workflows

**Workflow 1 — Full pipeline from scratch**
1. User creates a **Client** (`clients` insert; `activity_records` "client created").
2. User starts a **Diagnostic** for that client (`diagnostics` insert, status `draft`).
3. User fills the 15-category form and submits → **Bottleneck Scoring Engine** computes `performanceGap`, `priorityScore`, `severityLabel` per category, creates a new **diagnostic_versions** row (versionNumber 1) and its **diagnostic_scores** rows, updates `diagnostics.currentVersionId`, and writes an activity record.
4. Scoring engine (or a follow-up explicit action, see Section 18 open question) generates **bottleneck_recommendations** ranked by `priorityScore` for that version.
5. User opens **Solution Architect**, reviews recommendations, writes/edits `problemSummary` and `recommendedSolution`, saves a **solution_architect_records** row linked to `sourceDiagnosticVersionId`.
6. User runs the **Platform Matcher** against that solution record → **Platform Matcher Engine** scores all active platforms, writes **platform_evaluations** rows, flags the top pick `isRecommended`.
7. User creates a **Project**, links `clientId`, sets `solutionArchitectRecordId`, and optionally sets `selectedPlatformId` from the recommended platform.
8. User generates a **Software Blueprint** for the project → **Blueprint Service** seeds a `software_blueprints` row plus the fixed set of `blueprint_sections` (pre-filled where derivable from the solution/diagnostic, blank elsewhere), sets `projects.activeBlueprintId`.
9. User creates **Tasks** under the project (manually, or from a blueprint's Core Features section as a convenience — Phase 1 keeps this manual to avoid over-engineering).
10. Every step above writes an `activity_records` row; the Dashboard aggregates these.

**Workflow 2 — Project-first path**
1. User creates a **Project** directly (`clientId` optional at creation, can be attached later).
2. User attaches/creates a **Client** if not already set.
3. User adds a **Solution** by creating a `solution_architect_records` row manually (no `sourceDiagnosticVersionId`), linked to `projectId`.
4. User runs the **Platform Matcher** against that solution record (same engine as Workflow 1 step 6).
5. User creates the **Blueprint** for the project (same as Workflow 1 step 8).
6. User tracks the build via **Tasks** and status updates on the project (feeds into Workflow 3).

**Workflow 3 — Ongoing project tracking**
1. User updates `projects.status` (planning → in_progress → blocked/completed/cancelled) → activity record written, dashboard project counts recompute on next read (no cached materialized counts in Phase 1 — see Section 17).
2. User marks tasks `done` (sets `completedAt`) → activity record written.
3. Dashboard metrics (active projects, open tasks, recent activity) are computed live via query aggregation, not stored — keeps them always correct without a sync job.

**Workflow 4 — Diagnostic edit / re-score**
1. User opens an existing **Diagnostic**, chooses "Edit / Re-score."
2. Diagnostic Service loads the latest `diagnostic_versions` row's `diagnostic_scores` as the starting form values (editable), but does **not** mutate them.
3. On save, a **new** `diagnostic_versions` row is created with `versionNumber = previous + 1`, a fresh set of `diagnostic_scores` rows is inserted, and `diagnostics.currentVersionId` is repointed to the new version.
4. The previous version and its scores remain untouched in the database — visible via the version selector on the Diagnostic Results screen.
5. `bottleneck_recommendations` are recalculated for the new version only; old recommendations stay attached to the old version.

---

## 9. API and Service Structure

REST API, one Express router per domain, mounted under `/api`. All routes require an authenticated session (Section 5) except the login route itself. Every route validates input/output against the Zod schemas generated from the OpenAPI spec (`lib/api-zod`), and every mutating route writes to `activity_records` via a shared `ActivityLogService.record(...)` call (invoked from the service layer, not duplicated per route).

Representative endpoint groups (full list is finalized in the OpenAPI spec, not hand-written here):

- `GET/POST /api/clients`, `GET/PATCH/DELETE(archive) /api/clients/:id`, `POST /api/clients/:id/notes`
- `GET/POST /api/projects`, `GET/PATCH /api/projects/:id`, `PATCH /api/projects/:id/status`
- `GET/POST /api/diagnostics`, `GET /api/diagnostics/:id`, `POST /api/diagnostics/:id/versions` (submits scores → creates new version), `GET /api/diagnostics/:id/versions/:versionId`
- `GET /api/diagnostic-categories` (reference data)
- `GET /api/diagnostic-versions/:id/recommendations`
- `GET/POST /api/solution-architect-records`, `GET/PATCH /api/solution-architect-records/:id`
- `GET /api/platforms` (reference data), `POST /api/solution-architect-records/:id/platform-matcher` (runs the matcher, returns `platform_evaluations`)
- `GET/POST /api/blueprints`, `GET /api/blueprints/:id`, `PATCH /api/blueprints/:id/sections/:sectionKey`
- `GET/POST /api/tasks`, `GET/PATCH /api/tasks/:id`
- `GET /api/activity` (filterable feed)
- `GET/PATCH /api/settings`
- `GET /api/dashboard/summary` (aggregated counts + top bottlenecks + recent activity, computed live)
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`

Each route handler is thin: validate → call one service method → return. All business logic (scoring math, matcher rules, blueprint seeding) lives in the service layer so it is independently unit-testable without spinning up HTTP.

---

## 10. Security and Validation

- **Server-side validation everywhere**: every write endpoint validates its body against a Zod schema derived from the DB schema (`drizzle-zod`) before touching the database; the same schemas are reused to type the generated frontend hooks so the client can't send a shape the server would reject.
- **Auth**: session-based (Section 5), `httpOnly` + `secure` cookies, session secret from environment configuration (already provisioned as `SESSION_SECRET` in this environment) — never hardcoded, never logged.
- **Authorization**: middleware checks `req.session.user.role.permissions` against a route's declared required permission before the handler runs, even though Phase 1 only has one role that passes everything — this is what makes Team Member/Contractor/Client roles a config change later, not a rewrite.
- **Input sanitization**: rely on parameterized queries via Drizzle (no raw string SQL concatenation anywhere).
- **Rate limiting / brute-force protection on login**: basic attempt throttling on `/api/auth/login`.
- **No secrets in the client bundle**: all DB credentials and session secrets stay server-side; frontend only ever talks to `/api/*`.
- **CSRF**: same-site cookie policy plus origin checks on state-changing requests, since this is a single-origin app with no third-party embeds in Phase 1.
- **Error responses never leak internals**: stack traces and raw DB errors are logged server-side only; client receives a sanitized error code/message.

---

## 11. Diagnostic Scoring Architecture

**Where it runs:** entirely server-side, inside `DiagnosticService` / a dedicated `BottleneckScoringEngine` module. The frontend may show a **live preview** of the formula as the user types (pure client-side arithmetic for UX feedback only), but the value that gets persisted is always recomputed and validated server-side on submit — the client-side preview is never trusted as the source of truth.

**Formula (per category, per diagnostic version):**
```
performanceGap = 10 − currentPerformance        (currentPerformance: 0–10)
priorityScore   = performanceGap × businessImpact × urgency
                  (businessImpact: 1–5, urgency: 1–5 → priorityScore range 0–250)
```

**Severity mapping** (applied to `priorityScore` per category, and also to the version's `overallPriorityTotal` if an aggregate severity is shown):
| Range | Label |
|---|---|
| 0–39 | Healthy |
| 40–79 | Monitor |
| 80–129 | Moderate |
| 130–189 | High |
| 190–250 | Critical |

**Storage:** each category's `currentPerformance`, `businessImpact`, `urgency`, plus the computed `performanceGap`, `priorityScore`, and `severityLabel` are stored as columns on `diagnostic_scores` (not recomputed on every read) — this keeps historical versions stable even if the severity band thresholds are later tuned, and makes the Diagnostic Results screen a simple read with no runtime computation needed. `bottleneck_recommendations` are derived by ranking `diagnostic_scores` by `priorityScore` descending within a version and are persisted as their own rows (not computed on the fly) so they can carry a human-editable `recommendationText` layered on top of the raw ranking.

---

## 12. Platform Matcher Architecture

**Approach:** an expandable, data-driven **rule/weight engine** — not an external AI call (explicitly excluded from Phase 1).

- Each platform (`platforms` table) and each scoring criterion (project type, complexity, custom business logic, database requirements, authentication, API integrations, CRM requirements, design importance, development speed, budget, scalability, ownership, maintenance capability, internal-or-public use) has a **weight/fit table** — implemented as a `platformCriteriaWeights` structure. For Phase 1 this can live as `jsonb` on the `platforms` row (e.g. `platforms.fitProfile: { complexity: {low: 5, medium: 3, high: 1}, ... }`) rather than a fully separate table, keeping the schema lean while still being data-driven and editable without code changes.
- The **Platform Matcher Engine** takes the solution's criteria inputs (captured on the Platform Matcher screen as a small form tied to the `solution_architect_records`/project context — e.g. dropdowns for complexity, budget tier, etc.), looks up each platform's fit value per criterion, sums a weighted total, and writes one `platform_evaluations` row per platform with a `scoreBreakdown` jsonb showing the per-criterion contribution (so the UI can explain *why* a platform scored the way it did, not just show a number).
- The engine is implemented as a single pure function `scorePlatforms(criteriaInput, platforms[]): PlatformEvaluationResult[]`, unit-testable in isolation, and registered behind a `PlatformMatcherEngine` interface — so a future version (e.g. AI-assisted or ML-tuned weights) can implement the same interface without touching the route or the schema.
- Re-running the matcher for the same `solution_architect_records` row simply inserts a fresh batch of `platform_evaluations` (see open question in Section 18 about whether to keep full history or overwrite).

---

## 13. Software Blueprint Architecture

**Storage model recommendation: hybrid — separate records per section (`blueprint_sections`), with structured sections optionally storing `jsonb` content instead of plain text.**

Tradeoffs considered:
- **All content in one big JSON blob on `software_blueprints`**: simplest to implement, fastest to write, but loses per-section editing history, makes partial updates awkward (must rewrite the whole blob), and makes it hard to query/report on individual sections later (e.g. "show me all blueprints missing Security Requirements").
- **Fully separate rows per section (`blueprint_sections`, one per fixed section key)** — **recommended**: each section is independently editable, independently timestamped, and independently validated (e.g. "Acceptance Criteria" can enforce a checklist structure while "Executive Summary" is free text). New sections can be added later (industry-specific sections, Phase 2) without a schema migration — just a new `sectionKey` value.
- **Content type per section**: most sections (Executive Summary, Business Problem, Target User, etc.) are stored as plain `text`. A few structurally list-like sections (User Roles, Pages and Screens, Core Features, Optional Features, Integrations) are stored as `jsonb` arrays so the UI can render them as editable lists/tables rather than a single textarea, while still living in the same `content` column typed as `jsonb` for those section keys (the API layer knows which section keys are text vs. structured, via a shared section-type map).

This hybrid gives per-section granularity (better UX, better history, better future querying) without over-normalizing into dozens of one-off tables for each section type.

---

## 14. Future Module Strategy

The following modules are explicitly out of Phase 1 scope but must be able to attach later without disrupting the core:

- **Viral Growth Engine / Viral Tracker** — will consume `clients`/`projects` as its subject entities; expected to add its own tables referencing `clients.id`/`projects.id` by FK, no core schema changes needed.
- **Master Prompt Library** — extends `prompt_templates` (already scaffolded in Phase 1 schema) with a management UI and platform-specific generation logic; the table exists now precisely so this is additive.
- **Real Estate / HVAC / Local Business / Medical Business / Affiliate Marketing Suites** — each is expected to be an `industry_templates`-driven module: pre-populated diagnostic weight sets, blueprint section defaults, and possibly custom diagnostic categories scoped to that industry. The `industry_templates` table and the category/section being keyed by slug (not hardcoded enums baked into application code) is what makes this additive rather than a rewrite.
- **Content Engine** — a new module owning its own content-entity tables, referencing `clients`/`projects` by FK.
- **Client Portal** — introduces the `Client` role (already reserved in `roles`) and a client-scoped, permission-filtered view over existing tables (`projects`, `tasks`, `software_blueprints`) — the API/service layer's permission checks (Section 10) are what make this a filtering change, not a new backend.
- **AI Agent Builder** — a net-new module; would plug into the Solution Architect / Platform Matcher stage as an optional engine implementation behind the same `SolutionArchitectEngine`/`PlatformMatcherEngine` interfaces described in Sections 11–12.
- **White-Label Accounts** — requires a tenancy layer (an `organizations`/`accounts` table above `clients`/`users`); the schema's consistent use of FKs (rather than implicit global tables) makes adding a top-level tenant FK a additive migration, not a redesign.
- **Subscription Billing** — a new module handling billing entities entirely separate from the operational schema; would attach to whatever tenancy model White-Label introduces.

None of these require Phase 1 to guess their exact schema — the point is that Phase 1's normalized, FK-driven, slug-keyed design gives each of them a clean attachment point.

---

## 15. Development Phases

**Phase 1A — Foundation**
- Features built: repo/app scaffolding for the new `command-center` frontend artifact, navigation shell, auth (single admin login/session), Settings screen skeleton, base layout.
- Database changes: `roles`, `users`, `application_settings` tables + seed one Administrator role/user.
- Testing checklist: login/logout works; protected routes redirect when unauthenticated; nav renders all Phase 1 sections (even as stubs).
- Completion criteria: an admin can log in and see an empty shell for every Phase 1 screen.
- Dependencies: none (first phase).
- Risks: session/auth approach chosen here is hard to change later without touching every route — get Section 5 sign-off before starting.

**Phase 1B — Client Management**
- Features built: Clients List, Client Detail, Client Form, Client Notes.
- Database changes: `clients`, `client_notes` tables.
- Testing checklist: create/edit/archive a client; add a note; search/filter the list; empty state renders with zero clients.
- Completion criteria: full CRUD + notes flow works end-to-end against real data.
- Dependencies: Phase 1A (auth, nav).
- Risks: none significant — lowest-risk phase, good for validating the OpenAPI/codegen pipeline end to end.

**Phase 1C — Project Management and Tasks**
- Features built: Projects List, Project Detail, Project Form, Tasks List, Task Form, project status updates.
- Database changes: `projects`, `tasks` tables.
- Testing checklist: create a project attached to a client; create/edit/complete tasks; status transitions reflected on Project Detail; task filters work.
- Completion criteria: a project can be created, tracked through status changes, and have tasks completed.
- Dependencies: Phase 1B (clients must exist to attach a project, though `clientId` is nullable so this could technically run in parallel — sequenced after B to reuse the same list/detail/form patterns).
- Risks: deciding the exact status enum values now — changing them later touches UI badges + any dashboard aggregation.

**Phase 1D — Business Diagnostics and Bottleneck Scoring**
- Features built: Diagnostics List, Diagnostic Form (15-category input), Diagnostic Results (scored view + severity), version history/versioning (Workflow 4).
- Database changes: `diagnostic_categories` (+ seed the 15 fixed categories), `diagnostics`, `diagnostic_versions`, `diagnostic_scores`, `bottleneck_recommendations`.
- Testing checklist: submit a diagnostic and verify computed `performanceGap`/`priorityScore`/`severityLabel` match the formula exactly for boundary values (e.g. exactly 39/40, 79/80, 129/130, 189/190); edit and confirm a new version is created and the old one is preserved untouched; recommendations rank correctly by priority score.
- Completion criteria: a full diagnostic can be scored, re-scored as a new version, and both versions remain independently viewable.
- Dependencies: Phase 1B (diagnostics belong to a client).
- Risks: formula/severity boundary correctness is the highest-stakes logic in the whole app — needs explicit unit tests per boundary, not just a happy-path check.

**Phase 1E — Solution Architect**
- Features built: Solution Architect screen — create from diagnostic recommendations or manually, edit, link to a project.
- Database changes: `solution_architect_records`.
- Testing checklist: create a solution from a diagnostic's recommendations (Workflow 1 path) and directly without a diagnostic (Workflow 2 path); link/unlink from a project.
- Completion criteria: both workflow entry points produce a valid, project-linkable solution record.
- Dependencies: Phase 1D (for the diagnostic-linked path) and Phase 1C (to link to a project).
- Risks: none major; mostly a CRUD screen with two entry points.

**Phase 1F — Platform Matcher**
- Features built: Platform Matcher screen, criteria input form, scoring engine, platform reference data.
- Database changes: `platforms` (+ seed the 6 fixed platforms with fit profiles), `platform_evaluations`.
- Testing checklist: run the matcher against a known solution and manually verify the weighted score math for at least two platforms; confirm `isRecommended` flags the top score; re-running produces a fresh evaluation set.
- Completion criteria: matcher produces explainable, correct scores and a clear top recommendation.
- Dependencies: Phase 1E (needs a solution record to score against).
- Risks: initial fit-profile weights are a judgment call, not a formula from the spec — flag for Owner review before committing seed data (see Section 18).

**Phase 1G — Software Blueprint System**
- Features built: Blueprint Editor (all sections), Blueprints List, blueprint creation from a project.
- Database changes: `software_blueprints`, `blueprint_sections` (+ seed the fixed section key list).
- Testing checklist: create a blueprint, edit every section type (text and structured/jsonb sections), confirm sections persist independently, confirm a blueprint links back to its project.
- Completion criteria: a complete blueprint can be authored and read back accurately across all 24 sections.
- Dependencies: Phase 1C (blueprint attaches to a project) and ideally 1F (recommended platform pre-fills the blueprint's platform field).
- Risks: structured (jsonb) sections need clear UI conventions decided before building the editor, or the editor will need rework.

**Phase 1H — Dashboard, Search, Activity History, Testing & Cleanup**
- Features built: Dashboard metrics/aggregation, global search/filter polish across list screens, Activity History screen, cross-cutting activity logging verification, final QA pass.
- Database changes: `activity_records` (if not already introduced incrementally per phase — recommend introducing the table in 1A and wiring writes progressively through B–G so 1H is verification, not first-time plumbing).
- Testing checklist: dashboard numbers match manual counts; activity log has an entry for every mutating action across every module; search/filter works consistently across all list screens; full workflow 1 and workflow 2 run end-to-end without errors.
- Completion criteria: Phase 1 scope (all 12 items) is functionally complete, internally consistent, and passes the full workflow smoke tests.
- Dependencies: all prior phases.
- Risks: this is where cross-module inconsistencies (naming, status enums, empty states) surface — budget real time for polish, not just new features.

*(Note: `activity_records` and its logging middleware are listed under 1H for final verification, but the table and the `ActivityLogService` should be built in 1A and wired incrementally as each phase adds its own mutations — waiting until 1H to retrofit logging into six phases of code would be far riskier than building it in from the start.)*

---

## 16. Testing Plan

- **Unit tests** on all pure service logic — especially `BottleneckScoringEngine` (formula + every severity boundary) and `PlatformMatcherEngine` (weighted scoring math) — these are the two places a silent math error would be hardest to notice visually.
- **Integration tests** per route: validation rejects bad input (out-of-range scores, missing required fields), authorized/unauthorized access is enforced, and a full create → read → update → archive cycle works per entity.
- **Workflow-level smoke tests** (Playwright-based, run at the end of each build phase per Section 15's checklists, and again as a full pass at the end of Phase 1H): Workflow 1 end to end, Workflow 2 end to end, Workflow 4 (diagnostic re-versioning) end to end.
- **Data integrity checks**: foreign key constraints enforced at the DB level (not just app-level checks) so orphaned records are impossible; unique constraints (e.g. `diagnostic_scores` per version+category) enforced at the DB level.
- **No automated testing of visual design** — testing focuses on data correctness and workflow completion, not pixel-level UI checks.

---

## 17. Risks and Preventive Measures

| Risk | Preventive measure |
|---|---|
| Diagnostic formula/severity boundaries implemented incorrectly | Explicit boundary-value unit tests (Section 16); store computed values rather than recomputing with possibly-changed logic later |
| Platform Matcher weights are subjective and could feel "wrong" to the business owner | Store weights as editable data (`platforms.fitProfile` jsonb), not hardcoded constants, and flag initial seed weights for Owner review (Section 18) before Phase 1F is considered done |
| Blueprint's structured (jsonb) sections become inconsistent in shape over time | Define and document a fixed TypeScript/Zod shape per structured section key up front, validated server-side on save |
| Dashboard metrics computed live could get slow as data grows | Not a Phase 1 concern at expected internal-tool volume; if it becomes one, add targeted indexes or a materialized summary table without changing the API contract |
| Role/permission system is unused in Phase 1 and could bit-rot before Phase 2 needs it | Exercise the permission-check middleware even with a single all-access Administrator role, so the code path is proven, not theoretical |
| Diagnostic categories, platforms, or blueprint sections hardcoded as enums instead of data | Explicitly modeled as seeded rows in `diagnostic_categories` / `platforms` / a section-key reference list, keyed by slug, so future additions are data changes, not migrations |
| Activity logging retrofitted late and inconsistently across modules | Build `ActivityLogService` in Phase 1A and require every service-layer mutation to call it from day one (Section 15 note) |
| Scope creep into public registration/billing/AI calls during Phase 1 | This document explicitly excludes them (per the stated requirements); any request to add them mid-phase should be treated as a new phase, not a Phase 1 addendum |

---

## 18. Questions or Decisions Requiring Owner Approval

1. **Platform Matcher seed weights**: the six platforms' fit profiles per criterion (e.g. how "WordPress" scores on "custom business logic" vs. "Custom Development") are a judgment call. Should these be drafted by the agent for review, or provided directly by the business owner from existing consulting experience?
2. **Platform Matcher re-run history**: when a user re-runs the matcher for the same solution record, should every run be kept as history (append-only `platform_evaluations`, filterable by `runAt`/a `matcherRunId`), or should only the latest run be considered current (with older rows archived)? This plan assumes append-only for auditability, but confirm.
3. **Bottleneck recommendation authoring**: should `bottleneck_recommendations` be fully auto-generated text from a rule table (e.g. "Speed to Lead" + "Critical" → a canned recommendation string), or should the system only auto-rank the categories and leave `recommendationText` for the admin to write manually? This affects whether a "recommendation content" table/seed is needed in Phase 1D.
4. **Blueprint structured section shapes**: for sections like "Pages and Screens," "Core Features," and "User Roles" — confirm the exact list-item shape wanted (e.g. does "Core Features" need a priority/complexity field per feature, or just a name + description?) before the Blueprint Editor is built in Phase 1G.
5. **Task-to-blueprint linkage**: Workflow 1/2 currently treat blueprint creation and task creation as separate manual steps. Should Phase 1 include an optional "generate starter tasks from blueprint Core Features" convenience action, or should that wait for a later phase to avoid scope creep?
6. **Diagnostic category customization**: are the 15 listed categories fixed for all clients in Phase 1, or should there be any per-client/per-industry variation even before `industry_templates` is actively used? This plan assumes one fixed global list for Phase 1.
7. **Session length / login policy** for the single Administrator account (e.g. session duration, whether "remember me" is needed) — a minor detail but worth confirming before Phase 1A auth is finalized.
8. **Dashboard scope**: confirm which metrics matter most for the first version (this plan assumes: active project count, open task count, top bottlenecks across clients, and a recent activity feed) versus anything else the owner specifically wants surfaced first.

---

*End of Phase 1 architecture plan. No implementation has begun. Awaiting review and answers to Section 18 before Phase 1A starts.*
