import { boolean, integer, jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { diagnosticsTable, diagnosticVersionsTable } from "./diagnostics";
import { growthAssessmentsTable } from "./growthAssessments";

// ─── Solution Recommendation Plans ───────────────────────────────
export const solutionRecommendationPlansTable = pgTable("solution_recommendation_plans", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Source references
  growthAssessmentId: text("growth_assessment_id")
    .notNull()
    .references(() => growthAssessmentsTable.id, { onDelete: "restrict" }),
  diagnosticId: text("diagnostic_id")
    .notNull()
    .references(() => diagnosticsTable.id, { onDelete: "restrict" }),
  diagnosticVersionId: text("diagnostic_version_id")
    .notNull()
    .references(() => diagnosticVersionsTable.id, { onDelete: "restrict" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),

  // Status
  // draft | awaiting_review | approved | reopened | superseded | archived
  status: text("status").notNull().default("draft"),

  // Scores
  overallPriorityScore: numeric("overall_priority_score", { precision: 6, scale: 2 }),

  // System-generated text (stored at generation time — never overwritten)
  systemExecutiveRecommendation: text("system_executive_recommendation"),
  systemBusinessImpactSummary: text("system_business_impact_summary"),
  systemDependencySummary: text("system_dependency_summary"),

  // Admin-editable overrides
  executiveRecommendation: text("executive_recommendation"),
  businessImpactSummary: text("business_impact_summary"),
  dependencySummary: text("dependency_summary"),
  consultantNotes: text("consultant_notes"),

  // Metadata
  generatedMetadata: jsonb("generated_metadata"),
  recommendationEngineVersion: text("recommendation_engine_version").notNull().default("1.0"),

  // Approval workflow
  reviewedBy: text("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedBy: text("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  reopenedBy: text("reopened_by").references(() => usersTable.id),
  reopenedAt: timestamp("reopened_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  // Audit
  createdBy: text("created_by").references(() => usersTable.id),
  updatedBy: text("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Solution Recommendations ─────────────────────────────────────
export const solutionRecommendationsTable = pgTable("solution_recommendations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  planId: text("plan_id")
    .notNull()
    .references(() => solutionRecommendationPlansTable.id, { onDelete: "cascade" }),

  // Source
  sourceCategoryKey: text("source_category_key"),
  sourceAssessmentData: jsonb("source_assessment_data"),

  // Ranking & identity
  rank: integer("rank").notNull(),
  title: text("title").notNull(),
  domain: text("domain").notNull(),

  // Content
  problemStatement: text("problem_statement"),
  whyItMatters: text("why_it_matters"),
  recommendedOutcome: text("recommended_outcome"),

  // Scoring components (all 0–100 normalized)
  priorityScore: numeric("priority_score", { precision: 6, scale: 2 }).notNull(),
  priorityClassification: text("priority_classification").notNull(),
  severityScore: numeric("severity_score", { precision: 6, scale: 2 }),
  businessImpactScore: numeric("business_impact_score", { precision: 6, scale: 2 }),
  urgencyScore: numeric("urgency_score", { precision: 6, scale: 2 }),
  performanceGapScore: numeric("performance_gap_score", { precision: 6, scale: 2 }),
  quickWinBonus: numeric("quick_win_bonus", { precision: 6, scale: 2 }).default("0"),
  dependencyBonus: numeric("dependency_bonus", { precision: 6, scale: 2 }).default("0"),
  effortPenalty: numeric("effort_penalty", { precision: 6, scale: 2 }).default("0"),

  // Classification flags
  quickWinFlag: boolean("quick_win_flag").notNull().default(false),

  // Effort / timeframe / owner
  // effort: low | moderate | high | major_initiative
  effort: text("effort"),
  // confidence: 0.0–1.0
  confidence: numeric("confidence", { precision: 4, scale: 2 }),
  // timeframe: immediate | 7_days | 30_days | 60_90_days | strategic_90_plus_days
  timeframe: text("timeframe"),
  suggestedOwner: text("suggested_owner"),
  successMetric: text("success_metric"),
  dependencyNotes: text("dependency_notes"),

  // Explainability
  scoringExplanation: jsonb("scoring_explanation"),

  // Editable
  adminNotes: text("admin_notes"),
  status: text("status").notNull().default("active"),

  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Solution Recommendation Actions ─────────────────────────────
export const solutionRecommendationActionsTable = pgTable("solution_recommendation_actions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  recommendationId: text("recommendation_id")
    .notNull()
    .references(() => solutionRecommendationsTable.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description"),
  // time_horizon: immediate | 7_days | 30_days | 60_90_days
  timeHorizon: text("time_horizon").notNull(),
  suggestedOwner: text("suggested_owner"),
  expectedOutcome: text("expected_outcome"),
  successMetric: text("success_metric"),
  // completion_status: pending | in_progress | completed | skipped
  completionStatus: text("completion_status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Solution Recommendation Dependencies ─────────────────────────
export const solutionRecommendationDependenciesTable = pgTable("solution_recommendation_dependencies", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  planId: text("plan_id")
    .notNull()
    .references(() => solutionRecommendationPlansTable.id, { onDelete: "cascade" }),
  recommendationId: text("recommendation_id")
    .notNull()
    .references(() => solutionRecommendationsTable.id, { onDelete: "cascade" }),
  dependsOnRecommendationId: text("depends_on_recommendation_id")
    .notNull()
    .references(() => solutionRecommendationsTable.id, { onDelete: "cascade" }),

  // dependency_type: blocking | recommended | optional
  dependencyType: text("dependency_type").notNull().default("recommended"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Solution Recommendation Rules ───────────────────────────────
export const solutionRecommendationRulesTable = pgTable("solution_recommendation_rules", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  ruleKey: text("rule_key").notNull().unique(),
  version: text("version").notNull().default("1.0"),
  domain: text("domain").notNull(),
  categoryMatch: text("category_match"),

  // JSONB fields for rule templates and conditions
  triggerConditions: jsonb("trigger_conditions"),
  templates: jsonb("templates"),
  defaultActions: jsonb("default_actions"),

  // Defaults
  defaultEffort: text("default_effort"),
  defaultTimeframe: text("default_timeframe"),
  defaultOwner: text("default_owner"),
  defaultMetrics: jsonb("default_metrics"),
  dependencyRules: jsonb("dependency_rules"),

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────
export type SolutionRecommendationPlan = typeof solutionRecommendationPlansTable.$inferSelect;
export type SolutionRecommendation = typeof solutionRecommendationsTable.$inferSelect;
export type SolutionRecommendationAction = typeof solutionRecommendationActionsTable.$inferSelect;
export type SolutionRecommendationDependency = typeof solutionRecommendationDependenciesTable.$inferSelect;
export type SolutionRecommendationRule = typeof solutionRecommendationRulesTable.$inferSelect;
