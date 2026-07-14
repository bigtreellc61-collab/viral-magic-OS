import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Single-row settings table. Application code always reads/writes the row
// where id = 1 (the singleton). Phase 1A has a fixed, known set of fields,
// so explicit typed columns are simpler to bind to the UI than a generic
// key/value store.
export const applicationSettingsTable = pgTable("application_settings", {
  id: integer("id").primaryKey().default(1),

  // Business profile
  businessName: text("business_name"),
  ownerName: text("owner_name"),
  businessEmail: text("business_email"),
  businessPhone: text("business_phone"),
  website: text("website"),
  address: text("address"),

  // Branding
  appName: text("app_name").notNull().default("Viral Magic OS"),
  appSubtitle: text("app_subtitle"),
  logoUrl: text("logo_url"),
  primaryAccentColor: text("primary_accent_color").notNull().default("#7C3AED"),
  secondaryAccentColor: text("secondary_accent_color").notNull().default("#3B82F6"),

  // Project defaults
  defaultCurrency: text("default_currency").notNull().default("USD"),
  defaultTimezone: text("default_timezone").notNull().default("UTC"),
  defaultProjectStatus: text("default_project_status").notNull().default("planning"),
  defaultTaskPriority: text("default_task_priority").notNull().default("medium"),
  defaultEstimatedTimelineDays: integer("default_estimated_timeline_days")
    .notNull()
    .default(30),
  defaultProjectOwnerName: text("default_project_owner_name"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertApplicationSettingsSchema = createInsertSchema(
  applicationSettingsTable,
).omit({ updatedAt: true });
export type InsertApplicationSettings = z.infer<
  typeof insertApplicationSettingsSchema
>;
export type ApplicationSettings = typeof applicationSettingsTable.$inferSelect;
