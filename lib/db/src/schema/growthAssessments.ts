import { jsonb, numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";
import { diagnosticsTable, diagnosticVersionsTable } from "./diagnostics";

// ─── Growth Assessments ──────────────────────────────────────
export const growthAssessmentsTable = pgTable("growth_assessments", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Links
  diagnosticId: text("diagnostic_id")
    .notNull()
    .references(() => diagnosticsTable.id, { onDelete: "cascade" }),
  diagnosticVersionId: text("diagnostic_version_id")
    .notNull()
    .references(() => diagnosticVersionsTable.id, { onDelete: "cascade" }),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),
  projectId: text("project_id").references(() => projectsTable.id, { onDelete: "set null" }),

  // Status
  status: text("status").notNull().default("draft"),
  // draft | awaiting_review | approved | superseded | archived

  // Health snapshot
  healthScore: numeric("health_score", { precision: 6, scale: 2 }),
  healthRating: text("health_rating"),
  // strong | stable | vulnerable | at_risk | critical

  // System-generated interpretation text (stored at generation time — never overwritten)
  systemStrengthSummary: text("system_strength_summary"),
  systemVulnerabilitySummary: text("system_vulnerability_summary"),
  systemRiskSummary: text("system_risk_summary"),
  systemGrowthOpportunitySummary: text("system_growth_opportunity_summary"),
  systemQuickWinSummary: text("system_quick_win_summary"),
  systemStrategicFocusSummary: text("system_strategic_focus_summary"),

  // Admin-editable final text (overrides system text when present)
  strengthSummary: text("strength_summary"),
  vulnerabilitySummary: text("vulnerability_summary"),
  riskSummary: text("risk_summary"),
  growthOpportunitySummary: text("growth_opportunity_summary"),
  quickWinSummary: text("quick_win_summary"),
  strategicFocusSummary: text("strategic_focus_summary"),
  consultantNotes: text("consultant_notes"),

  // Structured interpretation (JSON — all section arrays stored for display)
  generatedSections: jsonb("generated_sections"),

  // Approval workflow
  reviewedBy: text("reviewed_by").references(() => usersTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  approvedBy: text("approved_by").references(() => usersTable.id),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  // Audit
  createdBy: text("created_by").references(() => usersTable.id),
  updatedBy: text("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GrowthAssessment = typeof growthAssessmentsTable.$inferSelect;
