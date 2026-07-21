# Growth Blueprint Module 2 — Starting-Point Audit Report

**Date:** July 21, 2026  
**Auditor:** Replit Agent  
**Phase:** Pre-implementation audit — read-only  
**No code was changed during this audit.**

---

## 1. Executive Summary

Phase 1F is complete and fully stabilized as of July 20, 2026. The Solution Recommendation Engine (Phase 1F-A through 1F-C) is live, tested, and pushed to GitHub.

The Growth Blueprint Module 2 does not yet exist in any form in the codebase — no routes, no database tables, no UI components, no navigation items, no stubs, no placeholders, and no comments referencing it. The starting point is a completely clean slate built on a rich, ready foundation.

The existing system provides everything Module 2 needs as inputs:

- Business health scores, ratings, and structured findings (Growth Assessment)
- Prioritized, scored, categorized recommendations with timeframes and business impact (Solution Recommendation Engine)
- Full approval lifecycle and activity history patterns already proven and reusable
- Established client → project → assessment → recommendation plan relationship chain

**Final recommendation: Ready to begin Growth Blueprint Module 2 implementation.**

No prerequisites are blocking work. One housekeeping item (updating `replit.md`) is recommended before implementation begins but does not block it.

---

## 2. Current Project Baseline

| Dimension | Status |
|---|---|
| Repository | github.com/bigtreellc61-collab/viral-magic-OS, branch `main` |
| TypeScript (`lib/api-client-react`) | ✅ exit 0 |
| TypeScript (`artifacts/command-center`) | ✅ exit 0 |
| Frontend production build | ✅ exit 0, 26 code-split chunks, 936 KB total |
| Frontend tests (Vitest) | ✅ 26/26 passed |
| Backend API server | ✅ running, all routes healthy |
| Browser console | ✅ clean — zero errors |
| Phase 1A–1F-C regression | ✅ all verified |

---

## 3. Exact Phase 1F Completion State

| Sub-phase | Description | Status |
|---|---|---|
| Phase 1F-A | Solution Recommendation Engine backend: 20-rule deterministic engine, 5 DB tables, 14 API endpoints, full status lifecycle | ✅ Complete |
| Phase 1F-B | Recommendation UI: 7-tab detail page, panels on client/project/assessment/dashboard | ✅ Complete |
| Phase 1F-C | Testing, polish, stabilization: sidebar nesting fix, end-to-end lifecycle verified, completion report produced | ✅ Complete |

---

## 4. Existing Growth Blueprint Implementation Inventory

**Result: NO GROWTH BLUEPRINT IMPLEMENTATION EXISTS.**

Search conducted across all of `artifacts/command-center/src/`, `artifacts/api-server/src/`, and `lib/db/`:

| Search term | Files found | Notes |
|---|---|---|
| `blueprint`, `Blueprint`, `GrowthBlueprint` | 0 | Not in any filename or source content |
| `growth-blueprint`, `growth_blueprint` | 0 | Not in any route, table, or schema |
| Sidebar nav item for Blueprint | 0 | Shell.tsx has 6 items; none is Blueprint |
| React Router route for Blueprint | 0 | App.tsx has no `/growth-blueprints` route |
| DB table for blueprint | 0 | No `growth_blueprints` or `software_blueprints` table |
| Comments describing future Blueprint | 0 | No TODO or future-module comments |

Related (but not Blueprint) content found:
- `growth-assessment.tsx` line 118: `"Growth Opportunities"` tab — part of the existing Growth Assessment module
- `solution-recommendation-engine.ts` line 158: `"run a 30-day test"` — timeframe description in a recommendation rule
- `growthAssessments.ts` line 40: `systemStrategicFocusSummary` — assessment field, not a Blueprint field

---

## 5. Relevant Files and Paths

### Database schema files
| File | Tables |
|---|---|
| `lib/db/src/schema/clients.ts` | `clients` |
| `lib/db/src/schema/projects.ts` | `projects` |
| `lib/db/src/schema/diagnostics.ts` | `diagnostics`, `diagnostic_versions`, `diagnostic_scores`, `diagnostic_template_categories` |
| `lib/db/src/schema/growthAssessments.ts` | `growth_assessments` |
| `lib/db/src/schema/solutionRecommendations.ts` | `solution_recommendation_plans`, `solution_recommendations`, `solution_recommendation_actions`, `solution_recommendation_dependencies`, `solution_recommendation_rules` |
| `lib/db/src/schema/activityRecords.ts` | `activity_records` |

### API route files
| File | Endpoints |
|---|---|
| `artifacts/api-server/src/routes/growth-assessments.ts` | 8 endpoints |
| `artifacts/api-server/src/routes/solution-recommendations.ts` | 14 endpoints |
| `artifacts/api-server/src/routes/clients.ts` | ~10 endpoints |
| `artifacts/api-server/src/routes/projects.ts` | ~8 endpoints |
| `artifacts/api-server/src/routes/dashboard.ts` | 6 endpoints |

### Frontend pages
| File | Purpose |
|---|---|
| `artifacts/command-center/src/pages/growth-assessment.tsx` | 10-tab Growth Assessment detail page |
| `artifacts/command-center/src/pages/solution-recommendation-detail.tsx` | 7-tab Recommendation detail page |
| `artifacts/command-center/src/pages/client-detail.tsx` | Client detail with recommendation panel |
| `artifacts/command-center/src/pages/project-detail.tsx` | Project detail with recommendation section |
| `artifacts/command-center/src/pages/dashboard.tsx` | Dashboard with recommendation metrics |
| `artifacts/command-center/src/components/layout/shell.tsx` | Sidebar navigation (6 items) |
| `artifacts/command-center/src/App.tsx` | React Router routes |

### Supporting files
| File | Purpose |
|---|---|
| `lib/api-spec/openapi.yaml` | OpenAPI contract — source of truth for all API hooks |
| `lib/api-client-react/` | Generated TanStack Query hooks (consumed by frontend) |
| `lib/api-zod/` | Generated Zod schemas |
| `artifacts/api-server/src/lib/solution-recommendation-engine.ts` | 20-rule deterministic engine |
| `docs/viral-magic-os-architecture.md` | Full architecture plan (Phase 1A–1H) |
| `docs/phase-1fc-completion-report.md` | Phase 1F-C completion report |

---

## 6. Current Database and Relationship Map

```
clients (id)
  └── projects (clientId)
  └── diagnostics (clientId)
        └── diagnostic_versions (diagnosticId)
              └── growth_assessments (diagnosticId, diagnosticVersionId, clientId, projectId)
                    └── solution_recommendation_plans (assessmentId, clientId, projectId)
                          └── solution_recommendations (planId)
                                └── solution_recommendation_actions (recommendationId)
                                └── solution_recommendation_dependencies (recommendationId)
                    
activity_records (entityType, entityId) ← logs events for all entities
solution_recommendation_rules ← 20 seeded engine rules
```

**The complete ownership chain for a Blueprint will be:**
```
client → project → growth_assessment → solution_recommendation_plan → [growth_blueprint]
```

All relationship FKs already exist. A Blueprint only needs to add a new table with FKs pointing into this chain.

---

## 7. Reusable Business Growth Assessment Capabilities

### What the Growth Assessment provides

| Field/Capability | Available | Description |
|---|---|---|
| `healthScore` | ✅ | Numeric 0–100 business health score |
| `healthRating` | ✅ | `strong` / `stable` / `vulnerable` / `at_risk` / `critical` |
| `strengthSummary` | ✅ | System-generated + admin-editable strength narrative |
| `vulnerabilitySummary` | ✅ | System-generated + admin-editable vulnerability narrative |
| `riskSummary` | ✅ | System-generated + admin-editable risk narrative |
| `growthOpportunitySummary` | ✅ | System-generated + admin-editable opportunities narrative |
| `quickWinSummary` | ✅ | System-generated + admin-editable quick-win narrative |
| `strategicFocusSummary` | ✅ | System-generated + admin-editable strategic focus narrative |
| `consultantNotes` | ✅ | Private admin notes |
| `generatedSections` | ✅ | Full JSONB: per-category strengths, risks, vulnerabilities, priorities, quick wins, opportunities — each with scores, severity, evidence, suggested owner, time horizon |
| Lifecycle status | ✅ | `draft` / `awaiting_review` / `approved` / `superseded` / `archived` |
| Approval history | ✅ | `reviewedBy`, `reviewedAt`, `approvedBy`, `approvedAt` |
| API endpoint | ✅ | `GET /growth-assessments/:id` returns full record |

### What Module 2 can reuse directly
- The health score and rating as the opening health baseline of the Blueprint executive section
- All six summary narratives (verbatim or as starting-point text for Blueprint sections)
- The full `generatedSections` JSONB as structured source for strengths, risks, vulnerabilities, priorities, quick wins, and opportunities — ready for Blueprint rendering without re-querying
- The lifecycle/approval pattern (same draft → submitted → approved → archived model proven in both Growth Assessment and Solution Recommendation)
- The activity logging pattern (`activity_records` with `entityType` / `entityId`)

---

## 8. Reusable Solution Recommendation Capabilities

### Plan-level fields available
| Field | Description |
|---|---|
| `status` | `draft` / `awaiting_review` / `approved` / `reopened` / `superseded` / `archived` |
| `executiveSummary` | High-level narrative |
| `strategicContext` | Why these recommendations now |
| `implementationApproach` | How to execute |
| `expectedOutcomes` | What success looks like |
| `successMetrics` | Measurable targets |
| `approvalNotes` | Reviewer notes |
| `consultantNotes` | Private admin notes |
| `approvedBy`, `approvedAt` | Approval audit trail |
| `totalRecommendations`, `criticalCount`, `highCount`, `quickWinCount`, `averagePriorityScore`, `overallHealthScore` | Aggregate metrics |

### Individual recommendation fields available
| Field | Description |
|---|---|
| `title`, `description` | Recommendation identity |
| `priority` | `critical` / `high` / `medium` / `low` |
| `priorityScore` | 0–100 numeric score |
| `classificationBand` | `immediate_action` / `high_priority` / `strategic_priority` / `monitor` |
| `rationale` | Why this recommendation was generated |
| `businessImpact` | Projected business impact narrative |
| `estimatedEffort` | `low` / `medium` / `high` / `very_high` |
| `estimatedTimeline` | Free text or structured |
| `timeframe` | `immediate` / `7_days` / `30_days` / `60_90_days` / `strategic_90_plus_days` |
| `category` | Diagnostic category that generated this recommendation |
| `adminNotes` | Per-recommendation consultant notes |

### Action fields available
| Field | Description |
|---|---|
| `title`, `description` | Action identity |
| `owner` | Responsible party |
| `dueDate` | Target date |
| `status` | `pending` / `in_progress` / `complete` / `skipped` |
| `priority` | `critical` / `high` / `medium` / `low` |
| `estimatedHours` | Effort estimate |
| `notes` | Admin notes |

### What Module 2 can consume without duplicating
- The approved plan's `executiveSummary`, `strategicContext`, `implementationApproach`, `expectedOutcomes`, `successMetrics` as Blueprint source content
- Recommendations grouped by `timeframe` to build the 30/60/90-day structure naturally — `immediate` + `7_days` → 30-day, `30_days` → 60-day, `60_90_days` → 90-day, `strategic_90_plus_days` → roadmap
- Recommendations grouped by `priority` / `classificationBand` for the prioritized initiatives section
- Actions as the initial action-item list within each implementation stage
- The entire lifecycle state machine (submit → approve → reopen → archive) — proven, API-enforced, activity-logged
- The `activity_records` table and logging pattern — no new infrastructure needed
- The `solution_recommendation_plans.id` as the FK anchor for the Blueprint record

---

## 9. Missing Capabilities

The following do not exist yet and must be built for Module 2:

### A. Data already available (in existing tables, directly readable)
- Client name, industry, business concern, desired outcome
- Health score and rating
- All six assessment summaries
- Recommendation priorities, timeframes, business impacts
- Actions with owners, due dates, estimated hours
- Approval status and history

### B. Data that can be referenced (via FK, no duplication)
- `clients.id` → client context
- `projects.id` → project context
- `growth_assessments.id` → assessment inputs
- `solution_recommendation_plans.id` → recommendation source
- `solution_recommendations` rows → individual initiative source

### C. Data that is missing (new tables required)
| Data Element | Notes |
|---|---|
| Blueprint record (`growth_blueprints`) | id, version, status, title, clientId, projectId, assessmentId, planId, createdBy, approvedBy, approvedAt, archivedAt |
| Executive growth strategy | Admin-authored narrative field on the blueprint record |
| Implementation stages | Structured 30/60/90-day and roadmap groupings, likely as JSONB or child rows |
| Stage-level success metrics | Distinct from recommendation-level success metrics |
| Stage-level projected impact | Quantified impact per implementation stage |
| Stage-level risk | Risk narrative per stage |
| Client-facing summary | A curated, client-readable executive summary distinct from consultant notes |
| Blueprint-level consultant guidance | Separate from recommendation-level `adminNotes` |
| Blueprint approval status | Lifecycle mirroring the proven `solution_recommendation_plans` pattern |
| Blueprint activity history | Via `activity_records` (infrastructure already exists) |
| Blueprint version tracking | Which plan version the blueprint was generated from (for regeneration scenarios) |

### D. Data that should NOT be duplicated
- Do not re-store health scores (read from `growth_assessments`)
- Do not re-store recommendation text (read from `solution_recommendations`)
- Do not re-store action items (read from `solution_recommendation_actions`)
- Do not re-create the lifecycle state machine (reuse the same pattern)
- Do not re-create activity logging infrastructure (reuse `activity_records`)

---

## 10. Recommended Growth Blueprint Ownership Model

**A Blueprint belongs to: an approved Solution Recommendation Plan.**

Rationale:
- A plan already carries `clientId`, `projectId`, and `assessmentId` FKs — the Blueprint inherits all three relationships for free
- A plan is approved before a Blueprint is meaningful — the Blueprint is the delivery artifact of an approved plan
- When a plan is superseded (regenerated), the prior Blueprint should be linked to the prior (superseded) plan, and a new Blueprint can be generated from the new plan — versioning is handled naturally
- The single source of truth for Blueprint inputs (health scores, priorities, timeframes, actions) is always traceable to a specific plan version

**Schema anchor:**
```
growth_blueprints.planId → solution_recommendation_plans.id (not null)
growth_blueprints.assessmentId → growth_assessments.id (not null)
growth_blueprints.clientId → clients.id (not null)
growth_blueprints.projectId → projects.id (nullable — projects are optional)
```

**One blueprint per approved plan.** Regenerating a plan creates a new plan record (old becomes superseded); a new blueprint can then be generated from the new plan. Prior blueprints remain viewable and read-only, linked to their superseded plan.

---

## 11. Recommended Lifecycle

```
[Plan approved]
     ↓
  generate → draft
     ↓
  submit → awaiting_review
     ↓
  approve → approved  ←→  reopen → reopened
     ↓
  archive → archived
```

This mirrors the proven Solution Recommendation Plan lifecycle exactly. No new lifecycle logic needs to be invented — the same backend pattern (status field + action endpoints + 409 on invalid transitions + activity logging) applies directly.

**Draft fields:** all Blueprint narrative sections are editable  
**Awaiting review:** editing locked, approval available  
**Approved:** read-only, reopen available  
**Reopened:** editable again  
**Archived:** read-only, excluded from current-plan displays  

---

## 12. Recommended Navigation and UI Placement

### Sidebar
Add one entry between Diagnostics and Settings:
```
• Growth Blueprints   /growth-blueprints   icon: FileText or Map
```

### React Router
```
/growth-blueprints           → BlueprintsListPage
/growth-blueprints/:id       → BlueprintDetailPage
```

### Cross-linking surfaces (add Blueprint panels/buttons to existing pages)
| Page | Addition |
|---|---|
| Growth Assessment detail → Recommendations tab | "View Blueprint" button / link if blueprint exists for this assessment's approved plan |
| Solution Recommendation detail | New "Growth Blueprint" tab or "Generate Blueprint" action button |
| Client detail | "Current Growth Blueprint" panel (mirrors the existing recommendation panel) |
| Project detail | "Growth Blueprints" section (mirrors the existing recommendation section) |
| Dashboard | Blueprint metrics card: total blueprints, approved, awaiting review |

---

## 13. Proposed Minimum Viable Module 2 Scope

The smallest useful Growth Blueprint that delivers real value to consulting workflows:

### Backend (Phase 2A)
1. New DB tables: `growth_blueprints`, `growth_blueprint_sections` (or JSONB sections on the blueprint record)
2. API endpoints: generate (from approved plan), get, update, list, submit, approve, reopen, archive, get-activity
3. Generation logic: auto-draft all Blueprint sections from the linked assessment and plan data
4. OpenAPI spec additions + Orval codegen

### Frontend (Phase 2B)
1. Blueprint detail page with tabbed sections:
   - Executive Growth Strategy
   - Prioritized Initiatives (from recommendations, grouped by priority band)
   - 30-Day Action Plan (from `immediate` + `7_days` timeframe recommendations and their actions)
   - 60-Day Plan (from `30_days` timeframe)
   - 90-Day Plan (from `60_90_days` timeframe)
   - Strategic Roadmap (from `strategic_90_plus_days` timeframe)
   - Consultant Guidance (private notes)
   - Client-Facing Summary (curated output)
   - Approval
2. Blueprints list page
3. Blueprint panels on client detail, project detail, assessment detail, recommendation detail
4. Dashboard Blueprint metrics
5. Sidebar navigation item

### Lifecycle (included in both)
- Full draft → awaiting_review → approved → reopened → archived lifecycle
- Activity history for every lifecycle event
- Approval validation (required fields must be populated)

---

## 14. Items to Defer

| Feature | Reason |
|---|---|
| Client-facing portal / client login | Phase 2+ scope; no client auth exists |
| PDF export of Blueprint | Phase 2+ scope; not in architecture plan |
| Print-specific styling | Not needed for v1 internal tool |
| AI-generated Blueprint content | Explicitly out of scope (no external AI calls in Phase 1) |
| Signal Hunter integration | Signal Hunter is a separate platform; data flows in via export, not API |
| Multi-tenant blueprints | Phase 2+ (white-label) |
| Blueprint template library | Nice to have; defer until pattern is proven with one client |
| Automated reminders / scheduling | Out of scope for Phase 1 |
| Revenue / ROI projections with financial data | No financial tracking exists yet |

---

## 15. Risks and Dependencies

| Risk | Mitigation |
|---|---|
| Blueprint generation producing empty sections when plan is partially filled | Generate from whatever data exists; allow admin to complete sections manually; do not block on completeness |
| Regenerating a plan (superseding it) orphaning a Blueprint | Blueprint's `planId` FK preserves the link to the superseded plan; the new plan gets its own Blueprint |
| Reusable lifecycle pattern diverging from proven pattern | Use identical status enum, action endpoint convention, and 409 transition rejection — do not invent new patterns |
| Orval codegen + Zod v3 `looseObject` issue | Known issue (documented in `.agents/memory/orval-zod-looseobject.md`); run sed patch after every codegen |
| `lib/api-client-react` dist rebuild forgotten after codegen | Known issue (documented in `.agents/memory/api-client-react-dist-rebuild.md`); run `pnpm tsc --build` in that package |
| `replit.md` is stale (describes project as Phase 1A only) | Update `replit.md` before implementation begins — low effort, prevents future confusion |

---

## 16. Recommended Task Breakdown

Suggested isolated tasks for the task queue, each independently executable:

| # | Title | Dependencies | Notes |
|---|---|---|---|
| 2A | Blueprint backend: DB tables, API endpoints, generation engine, OpenAPI spec | None (greenfield) | Mirrors Phase 1F-A pattern |
| 2B | Blueprint UI: detail page, list page, all lifecycle tabs | 2A merged | Mirrors Phase 1F-B pattern |
| 2C | Blueprint integrations: panels on client/project/assessment/recommendation/dashboard + sidebar nav | 2B merged | Mirrors Phase 1F integrations work |
| 2D | Blueprint testing, polish, stabilization | 2C merged | Mirrors Phase 1F-C |

Each task should be given its own phase spec (as was done for 1F-A through 1F-C) for scope clarity.

---

## 17. Test/Build Baseline

All commands run read-only against the current codebase. No files were changed.

| Check | Command | Exit Code | Result |
|---|---|---|---|
| Frontend TypeScript | `pnpm --filter @workspace/command-center exec tsc --noEmit` | **0** | ✅ Zero errors |
| Frontend production build | `PORT=3001 BASE_PATH=/ pnpm --filter @workspace/command-center run build` | **0** | ✅ 26 chunks, 936 KB |
| Frontend tests (Vitest) | `pnpm --filter @workspace/command-center run test` | **0** | ✅ 26/26 passed |
| Backend API server | Running in workflow | N/A | ✅ All routes healthy |
| Browser console | Checked via logs | N/A | ✅ Zero errors |

No backend test suite exists yet (noted as a known limitation in Phase 1F-C report). All Phase 1A–1F regression verification was performed via live API calls.

---

## 18. Confirmation: No Code Was Changed

This audit was read-only. The following were NOT performed:
- No source file edits
- No database migrations
- No schema changes
- No new routes added
- No UI components created
- No codegen (Orval, tsc) run in write mode
- No package installations

The only file written is this audit report: `docs/growth-blueprint-module2-audit.md`.

---

## 19. Confirmation: Signal Hunter Functionality Not Added

No Signal Hunter functionality was added, referenced, or designed into this audit or its recommendations. The architecture boundary is maintained:

```
Signal Hunter OS (separate platform)
  → research and evidence collection
  → export
  → Viral Magic OS
  → Growth Blueprint
  → client recommendations
```

The Growth Blueprint Module 2 design consumes only data already inside Viral Magic OS (Growth Assessment outputs and Solution Recommendation Plan outputs). No YouTube search, viral signal discovery, tracked creator accounts, competitor intelligence, social-content research, Signal Library, Signal Hunter scoring, or Signal Hunter APIs are included or planned.

---

## 20. Final Recommendation

**Ready to begin Growth Blueprint Module 2 implementation.**

The codebase is clean, stable, and fully tested. The relationship model, lifecycle pattern, API conventions, codegen pipeline, and UI component library are all proven and directly reusable. No prerequisites are blocking work.

One recommended action before starting implementation:
- Update `replit.md` to reflect the actual project state (Phase 1F-C complete, not Phase 1A)

Suggested first task: **Phase 2A — Growth Blueprint backend** (DB tables, generation engine, API endpoints, OpenAPI spec). This follows the exact same pattern as Phase 1F-A and can be executed as an isolated task agent.

---

*End of audit report. No Phase 1G / Growth Blueprint Module 2 implementation was begun.*
