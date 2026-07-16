import { Router, type IRouter } from "express";
import { sql } from "drizzle-orm";
import { db, usersTable, applicationSettingsTable } from "@workspace/db";
import { GetFoundationStatusResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { fetchRecentActivity } from "./activity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const APP_VERSION = "1.0.0-rc";
const PHASE = "Phase 1E — Growth Assessment";

router.get("/dashboard/foundation", requireAuth, async (_req, res) => {
  let databaseConnected = false;
  let adminAccountExists = false;
  let settingsConfigured = false;

  try {
    const [{ count: userCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(usersTable);
    databaseConnected = true;
    adminAccountExists = Number(userCount) > 0;

    const [{ count: settingsCount }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(applicationSettingsTable);
    settingsConfigured = Number(settingsCount) > 0;
  } catch (err) {
    logger.error({ err }, "Foundation status database check failed");
  }

  const recentActivity = await fetchRecentActivity(10);

  const data = GetFoundationStatusResponse.parse({
    databaseConnected,
    authConfigured: true,
    adminAccountExists,
    settingsConfigured,
    appVersion: APP_VERSION,
    phase: PHASE,
    generatedAt: new Date(),
    recentActivity,
  });
  res.json(data);
});

export default router;
