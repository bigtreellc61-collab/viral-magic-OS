import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const tasksTable = pgTable("tasks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  clientId: text("client_id")
    .notNull()
    .references(() => clientsTable.id, { onDelete: "restrict" }),
  projectId: text("project_id").references(() => projectsTable.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  assignedUserId: text("assigned_user_id").references(() => usersTable.id),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("not_started"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  completionDate: text("completion_date"),
  estimatedEffort: text("estimated_effort"),
  notes: text("notes"),
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

export const insertTaskSchema = createInsertSchema(tasksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasksTable.$inferSelect;
