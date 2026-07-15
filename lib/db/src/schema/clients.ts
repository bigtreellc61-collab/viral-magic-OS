import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const clientsTable = pgTable("clients", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  contactFirstName: text("contact_first_name"),
  contactLastName: text("contact_last_name"),
  companyName: text("company_name"),
  email: text("email"),
  phone: text("phone"),
  website: text("website"),
  industry: text("industry"),
  businessType: text("business_type"),
  customerMarket: text("customer_market"),
  companySize: text("company_size"),
  annualRevenueRange: text("annual_revenue_range"),
  primaryLocation: text("primary_location"),
  currentTechnologyStack: text("current_technology_stack"),
  primaryBusinessConcern: text("primary_business_concern"),
  desiredOutcome: text("desired_outcome"),
  budgetRange: text("budget_range"),
  leadSource: text("lead_source"),
  status: text("status").notNull().default("prospect"),
  internalNotes: text("internal_notes"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdBy: text("created_by").references(() => usersTable.id),
  updatedBy: text("updated_by").references(() => usersTable.id),
});

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;
