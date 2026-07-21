import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { growthAssessmentsTable } from "./growthAssessments";
import { solutionRecommendationPlansTable } from "./solutionRecommendations";

// ─── Growth Blueprints ────────────────────────────────────────────
//
// The Growth Blueprint is the top-level deliverable that organises and
// references data already captured in the Growth Assessment and
// Solution Recommendation Plan.
//
// Phase 2A: foundation (lifecycle, relationships).
// Phase 2B: versioning, assembly engine, sections, initiatives.

export const growthBlueprintsTable = pgTable("growth_blueprints", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // ── Relationships ─────────────────────────────────────────────
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),

  projectId: text("project_id").references(() => projectsTable.id, {
    onDelete: "set null",
  }),

  growthAssessmentId: text("growth_assessment_id")
    .notNull()
    .references(() => growthAssessmentsTable.id, { onDelete: "restrict" }),

  solutionRecommendationPlanId: text("solution_recommendation_plan_id")
    .notNull()
    .references(() => solutionRecommendationPlansTable.id, {
      onDelete: "restrict",
    }),

  // ── Identity ─────────────────────────────────────────────────
  title: text("title").notNull(),

  // Major version — incremented when a revision is created from an approved blueprint.
  // Monotonically increasing per plan.
  version: integer("version").notNull().default(1),

  // Minor revision — incremented when a draft/in_progress blueprint is regenerated.
  revisionNumber: integer("revision_number").notNull().default(0),

  // Links this blueprint to the prior approved version it supersedes.
  previousVersionId: text("previous_version_id"),
  // FK defined in migration (self-reference)

  // True when this is the authoritative current version for its plan.
  // Only one blueprint per plan should be isCurrent=true at a time.
  isCurrent: boolean("is_current").notNull().default(true),

  // ── Lifecycle ────────────────────────────────────────────────
  // draft | in_progress | ready_for_review | approved | archived
  status: text("status").notNull().default("draft"),

  // ── Generation ───────────────────────────────────────────────
  // null | pending | complete | failed
  generationStatus: text("generation_status"),
  generationError: text("generation_error"),
  generatedAt: timestamp("generated_at", { withTimezone: true }),

  // Snapshot of source statuses at generation time — for historical traceability.
  sourceAssessmentStatus: text("source_assessment_status"),
  sourcePlanStatus: text("source_plan_status"),

  // ── Content ──────────────────────────────────────────────────
  consultantNotes: text("consultant_notes"),

  // ── Approval workflow ─────────────────────────────────────────
  approvedBy: text("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),

  // Set when a newer approved version supersedes this one.
  supersededAt: timestamp("superseded_at", { withTimezone: true }),

  archivedAt: timestamp("archived_at", { withTimezone: true }),

  // ── Audit ─────────────────────────────────────────────────────
  createdBy: text("created_by").references(() => usersTable.id),
  updatedBy: text("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GrowthBlueprint = typeof growthBlueprintsTable.$inferSelect;
