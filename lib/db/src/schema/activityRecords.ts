import { jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const activityRecordsTable = pgTable("activity_records", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  activityType: text("activity_type").notNull(),
  actorUserId: text("actor_user_id").references(() => usersTable.id),
  description: text("description").notNull(),
  entityType: text("entity_type"),
  entityId: text("entity_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertActivityRecordSchema = createInsertSchema(
  activityRecordsTable,
).omit({ id: true, createdAt: true });
export type InsertActivityRecord = z.infer<typeof insertActivityRecordSchema>;
export type ActivityRecord = typeof activityRecordsTable.$inferSelect;
