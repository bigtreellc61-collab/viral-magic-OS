import { numeric, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),
  projectName: text("project_name").notNull(),
  projectType: text("project_type").notNull(),
  projectDescription: text("project_description"),
  businessProblem: text("business_problem"),
  desiredBusinessOutcome: text("desired_business_outcome"),
  recommendedSolution: text("recommended_solution"),
  selectedPlatform: text("selected_platform"),
  projectStatus: text("project_status").notNull().default("discovery"),
  priority: text("priority").notNull().default("normal"),
  estimatedProjectValue: numeric("estimated_project_value"),
  estimatedMonthlyRecurringRevenue: numeric("estimated_monthly_recurring_revenue"),
  startDate: text("start_date"),
  targetCompletionDate: text("target_completion_date"),
  actualCompletionDate: text("actual_completion_date"),
  projectOwner: text("project_owner"),
  internalNotes: text("internal_notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => usersTable.id),
  updatedBy: text("updated_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
