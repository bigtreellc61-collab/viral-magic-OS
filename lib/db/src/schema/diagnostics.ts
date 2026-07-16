import { boolean, integer, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

// ─── Diagnostic Templates ────────────────────────────────────────
export const diagnosticTemplatesTable = pgTable("diagnostic_templates", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  templateName: text("template_name").notNull(),
  templateKey: text("template_key").notNull().unique(),
  description: text("description"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Diagnostic Template Categories ─────────────────────────────
export const diagnosticTemplateCategoriesTable = pgTable("diagnostic_template_categories", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  templateId: text("template_id")
    .notNull()
    .references(() => diagnosticTemplatesTable.id, { onDelete: "cascade" }),
  categoryKey: text("category_key").notNull(),
  categoryLabel: text("category_label").notNull(),
  categoryDescription: text("category_description"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Diagnostics ─────────────────────────────────────────────────
export const diagnosticsTable = pgTable("diagnostics", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),
  diagnosticName: text("diagnostic_name").notNull(),
  diagnosticType: text("diagnostic_type").notNull(),
  status: text("status").notNull().default("draft"),
  currentVersionNumber: integer("current_version_number").notNull().default(0),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: text("reviewed_by").references(() => usersTable.id),
  summaryNotes: text("summary_notes"),
  overallHealthScore: numeric("overall_health_score", { precision: 6, scale: 2 }),
  overallPriorityScore: numeric("overall_priority_score", { precision: 8, scale: 2 }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => usersTable.id),
  updatedBy: text("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Diagnostic Versions ─────────────────────────────────────────
export const diagnosticVersionsTable = pgTable("diagnostic_versions", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  diagnosticId: text("diagnostic_id")
    .notNull()
    .references(() => diagnosticsTable.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull(),
  status: text("status").notNull().default("draft"),
  overallHealthScore: numeric("overall_health_score", { precision: 6, scale: 2 }),
  overallPriorityScore: numeric("overall_priority_score", { precision: 8, scale: 2 }),
  executiveSummary: text("executive_summary"),
  recommendedFirstAction: text("recommended_first_action"),
  recommendedSoftwareOpportunity: text("recommended_software_opportunity"),
  createdBy: text("created_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by").references(() => usersTable.id),
});

// ─── Diagnostic Scores ───────────────────────────────────────────
export const diagnosticScoresTable = pgTable("diagnostic_scores", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  diagnosticVersionId: text("diagnostic_version_id")
    .notNull()
    .references(() => diagnosticVersionsTable.id, { onDelete: "cascade" }),
  categoryKey: text("category_key").notNull(),
  categoryLabel: text("category_label").notNull(),
  categoryDescription: text("category_description"),
  displayOrder: integer("display_order").notNull().default(0),
  currentPerformance: numeric("current_performance", { precision: 4, scale: 1 }),
  businessImpact: numeric("business_impact", { precision: 3, scale: 1 }),
  urgency: numeric("urgency", { precision: 3, scale: 1 }),
  performanceGap: numeric("performance_gap", { precision: 4, scale: 1 }),
  priorityScore: numeric("priority_score", { precision: 8, scale: 2 }),
  severity: text("severity"),
  evidence: text("evidence"),
  observations: text("observations"),
  notes: text("notes"),
  recommendedAction: text("recommended_action"),
  resolutionStatus: text("resolution_status").notNull().default("unresolved"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  resolvedBy: text("resolved_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Bottleneck Recommendations ──────────────────────────────────
export const bottleneckRecommendationsTable = pgTable("bottleneck_recommendations", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  diagnosticScoreId: text("diagnostic_score_id")
    .notNull()
    .references(() => diagnosticScoresTable.id, { onDelete: "cascade" }),
  systemGeneratedDraft: text("system_generated_draft"),
  administratorFinalRecommendation: text("administrator_final_recommendation"),
  recommendationStatus: text("recommendation_status").notNull().default("draft"),
  priorityOrder: integer("priority_order").notNull().default(0),
  approvedBy: text("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DiagnosticTemplate = typeof diagnosticTemplatesTable.$inferSelect;
export type DiagnosticTemplateCategory = typeof diagnosticTemplateCategoriesTable.$inferSelect;
export type Diagnostic = typeof diagnosticsTable.$inferSelect;
export type DiagnosticVersion = typeof diagnosticVersionsTable.$inferSelect;
export type DiagnosticScore = typeof diagnosticScoresTable.$inferSelect;
export type BottleneckRecommendation = typeof bottleneckRecommendationsTable.$inferSelect;
