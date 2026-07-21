import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { growthAssessmentsTable } from "./growthAssessments";
import { solutionRecommendationPlansTable } from "./solutionRecommendations";

// ─── Growth Blueprints ────────────────────────────────────────────
//
// The Growth Blueprint is the top-level deliverable that organises and
// references data already captured in the Growth Assessment and
// Solution Recommendation Plan.  Phase 2A establishes the foundation
// only — generation logic, sections, and exports come in later phases.

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

  // Monotonically increasing; bumped when a superseded blueprint is
  // replaced by a new one for the same plan.
  version: integer("version").notNull().default(1),

  // ── Lifecycle ────────────────────────────────────────────────
  // draft | in_progress | ready_for_review | approved | archived
  status: text("status").notNull().default("draft"),

  // ── Content (stub — generation comes in later phases) ─────────
  consultantNotes: text("consultant_notes"),

  // ── Approval workflow ─────────────────────────────────────────
  approvedBy: text("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
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
