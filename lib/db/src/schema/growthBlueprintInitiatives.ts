import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { growthBlueprintsTable } from "./growthBlueprints";
import { solutionRecommendationsTable } from "./solutionRecommendations";

// ─── Growth Blueprint Initiatives ────────────────────────────────
//
// One initiative per source recommendation placed into the Blueprint roadmap.
//
// Architecture decision: store only Blueprint-specific fields.
// The source recommendation remains the authoritative record for
// problemStatement, whyItMatters, scoring, and action plans.
//
// Snapshot fields (title, domain, priorityClassification, effortLevel) are
// copied at generation time to preserve historical integrity when the
// blueprint is approved. If the source recommendation later changes,
// the approved blueprint is unaffected.
//
// Consultant can override: roadmapPeriod, sequenceOrder, ownerPlaceholder,
// targetPeriodLabel, consultantGuidance.

export const growthBlueprintInitiativesTable = pgTable("growth_blueprint_initiatives", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  blueprintId: text("blueprint_id")
    .notNull()
    .references(() => growthBlueprintsTable.id, { onDelete: "cascade" }),

  // Live link to source — preserved for read-through when blueprint is not approved.
  sourceRecommendationId: text("source_recommendation_id")
    .notNull()
    .references(() => solutionRecommendationsTable.id, { onDelete: "restrict" }),

  // ── Snapshot fields (written at generation time, preserved on approval) ──
  title: text("title").notNull(),
  summary: text("summary"),                    // from problemStatement
  domain: text("domain").notNull(),
  priorityClassification: text("priority_classification").notNull(),
  effortLevel: text("effort_level"),           // low | moderate | high | major_initiative

  // ── Roadmap assignment (deterministic, then consultant-editable) ──
  // 30_days | 60_days | 90_days | longer_term
  roadmapPeriod: text("roadmap_period").notNull(),
  roadmapReason: text("roadmap_reason"),       // machine-readable explanation

  // Tracks whether the consultant manually changed the period.
  overrideRoadmapPeriod: boolean("override_roadmap_period").notNull().default(false),

  // ── Blueprint-specific sequencing and presentation ───────────────
  sequenceOrder: integer("sequence_order").notNull().default(0),
  ownerPlaceholder: text("owner_placeholder"),
  targetPeriodLabel: text("target_period_label"),  // e.g. "Q1 2026"

  // Qualitative business impact from the source recommendation.
  expectedBusinessImpact: text("expected_business_impact"),

  // Consultant-authored guidance specific to this initiative in this blueprint.
  consultantGuidance: text("consultant_guidance"),

  // active | deferred | removed
  status: text("status").notNull().default("active"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GrowthBlueprintInitiative = typeof growthBlueprintInitiativesTable.$inferSelect;
