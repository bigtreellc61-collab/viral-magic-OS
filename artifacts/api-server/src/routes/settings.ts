import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, applicationSettingsTable } from "@workspace/db";
import { GetSettingsResponse, UpdateSettingsBody, UpdateSettingsResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

const SETTINGS_ROW_ID = 1;

async function getOrCreateSettings() {
  const rows = await db
    .select()
    .from(applicationSettingsTable)
    .where(eq(applicationSettingsTable.id, SETTINGS_ROW_ID))
    .limit(1);

  if (rows[0]) {
    return rows[0];
  }

  const [created] = await db
    .insert(applicationSettingsTable)
    .values({ id: SETTINGS_ROW_ID })
    .onConflictDoNothing({ target: applicationSettingsTable.id })
    .returning();

  if (created) {
    return created;
  }

  const [existing] = await db
    .select()
    .from(applicationSettingsTable)
    .where(eq(applicationSettingsTable.id, SETTINGS_ROW_ID))
    .limit(1);

  if (!existing) {
    throw new Error("Failed to load application settings singleton row.");
  }

  return existing;
}

router.get("/settings", requireAuth, async (_req, res) => {
  const settings = await getOrCreateSettings();
  const data = GetSettingsResponse.parse(settings);
  res.json(data);
});

router.patch("/settings", requireAuth, async (req, res) => {
  const body = UpdateSettingsBody.parse(req.body);
  await getOrCreateSettings();

  const [updated] = await db
    .update(applicationSettingsTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(applicationSettingsTable.id, SETTINGS_ROW_ID))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Settings not found." });
    return;
  }

  await logActivity({
    activityType: "settings.updated",
    actorUserId: req.authUser?.id,
    description: `${req.authUser?.fullName ?? "An administrator"} updated application settings.`,
    entityType: "application_settings",
    entityId: String(SETTINGS_ROW_ID),
  });

  const data = UpdateSettingsResponse.parse(updated);
  res.json(data);
});

export default router;
