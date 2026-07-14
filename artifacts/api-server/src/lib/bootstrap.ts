import { sql } from "drizzle-orm";
import { db, rolesTable, applicationSettingsTable } from "@workspace/db";
import { logger } from "./logger";

const ADMINISTRATOR_ROLE_ID = "administrator";

/**
 * Idempotent startup seeding: ensures the Administrator role and the
 * application_settings singleton row exist. Never creates fake business
 * data and never creates a user account -- the first Administrator is
 * always created through the UI-driven /auth/setup first-run gate.
 */
export async function runStartupSeed(): Promise<void> {
  await db
    .insert(rolesTable)
    .values({
      id: ADMINISTRATOR_ROLE_ID,
      name: "Administrator",
      description: "Full access to the Software Factory Command Center.",
      isSystemRole: true,
    })
    .onConflictDoNothing({ target: rolesTable.id });

  await db
    .insert(applicationSettingsTable)
    .values({ id: 1 })
    .onConflictDoNothing({ target: applicationSettingsTable.id });

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rolesTable);
  logger.info({ roleCount: Number(count) }, "Startup seed complete");
}
