import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { growthBlueprintsTable } from "./growthBlueprints";
import { usersTable } from "./users";

// ─── Growth Blueprint Sections ───────────────────────────────────
//
// Architecture decision: normalised table (vs JSONB on the parent row).
//
// Rationale: individual sections need independent editing, regeneration,
// and source traceability. A normalised table supports:
//   - editing one section without touching others
//   - per-section generation status and lock state
//   - per-section source references for future export / traceability
//   - approved-version immutability via isLocked flag
//   - future reordering or conditional inclusion of sections
//
// The 16 section keys are fixed and defined in blueprint-assembly-engine.ts.

export const growthBlueprintSectionsTable = pgTable("growth_blueprint_sections", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  blueprintId: text("blueprint_id")
    .notNull()
    .references(() => growthBlueprintsTable.id, { onDelete: "cascade" }),

  // One of the 16 fixed keys (e.g. 'executive_summary', 'key_strengths')
  sectionKey: text("section_key").notNull(),
  title: text("title").notNull(),
  sectionOrder: integer("section_order").notNull().default(0),

  // Assembly engine output — deterministic, never manually authored.
  // Regeneration rewrites this field only.
  generatedContent: text("generated_content"),

  // Consultant manual override.
  // When present, displayed instead of generatedContent.
  // Regeneration never touches this field.
  // Can be reset to null to revert to generated content.
  consultantContent: text("consultant_content"),

  // References to source fields used for this section's generated content.
  // e.g. { assessmentFields: ['strengthSummary'], planFields: ['executiveRecommendation'] }
  sourceReferences: jsonb("source_references"),

  // pending | complete | error
  generationStatus: text("generation_status").notNull().default("pending"),

  // When true the section is read-only (set on blueprint approval / archive).
  isLocked: boolean("is_locked").notNull().default(false),

  generatedAt: timestamp("generated_at", { withTimezone: true }),

  createdBy: text("created_by").references(() => usersTable.id),
  updatedBy: text("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GrowthBlueprintSection = typeof growthBlueprintSectionsTable.$inferSelect;
