import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  growthBlueprintsTable,
  growthBlueprintInitiativesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_PERIODS = ["30_days", "60_days", "90_days", "longer_term"] as const;

// ─── GET /api/growth-blueprints/:id/initiatives ───────────────────

router.get("/growth-blueprints/:id/initiatives", requireAuth, async (req, res) => {
  try {
    const blueprintId = String(req.params.id);

    const [blueprint] = await db
      .select({ id: growthBlueprintsTable.id })
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, blueprintId))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });

    const initiatives = await db
      .select()
      .from(growthBlueprintInitiativesTable)
      .where(eq(growthBlueprintInitiativesTable.blueprintId, blueprintId))
      .orderBy(
        asc(growthBlueprintInitiativesTable.roadmapPeriod),
        asc(growthBlueprintInitiativesTable.sequenceOrder),
      );

    res.json({ data: initiatives });
  } catch (err) {
    logger.error({ err }, "Get blueprint initiatives failed");
    res.status(500).json({ error: "Failed to get blueprint initiatives." });
  }
});

// ─── PATCH /api/growth-blueprints/:id/initiatives/:initiativeId ──
// Edit Blueprint-specific fields: roadmapPeriod, sequenceOrder,
// ownerPlaceholder, targetPeriodLabel, consultantGuidance, status.

router.patch(
  "/growth-blueprints/:id/initiatives/:initiativeId",
  requireAuth,
  async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const blueprintId = String(req.params.id);
      const initiativeId = String(req.params.initiativeId);

      const [blueprint] = await db
        .select()
        .from(growthBlueprintsTable)
        .where(eq(growthBlueprintsTable.id, blueprintId))
        .limit(1);

      if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
      if (blueprint.status === "approved" || blueprint.status === "archived" || blueprint.archivedAt) {
        return void res
          .status(409)
          .json({ error: "Initiatives of an approved or archived blueprint are read-only. Create a revision to make changes." });
      }

      const [initiative] = await db
        .select()
        .from(growthBlueprintInitiativesTable)
        .where(
          and(
            eq(growthBlueprintInitiativesTable.id, initiativeId),
            eq(growthBlueprintInitiativesTable.blueprintId, blueprintId),
          ),
        )
        .limit(1);

      if (!initiative) return void res.status(404).json({ error: "Initiative not found." });

      const {
        roadmapPeriod,
        sequenceOrder,
        ownerPlaceholder,
        targetPeriodLabel,
        consultantGuidance,
        status,
      } = req.body;

      // Validate roadmapPeriod if provided
      if (roadmapPeriod !== undefined && !VALID_PERIODS.includes(roadmapPeriod)) {
        return void res.status(400).json({
          error: `Invalid roadmapPeriod. Must be one of: ${VALID_PERIODS.join(", ")}.`,
        });
      }

      const periodChanged = roadmapPeriod !== undefined && roadmapPeriod !== initiative.roadmapPeriod;

      const [updated] = await db
        .update(growthBlueprintInitiativesTable)
        .set({
          roadmapPeriod: roadmapPeriod ?? initiative.roadmapPeriod,
          sequenceOrder: sequenceOrder !== undefined ? Number(sequenceOrder) : initiative.sequenceOrder,
          ownerPlaceholder: ownerPlaceholder !== undefined ? ownerPlaceholder : initiative.ownerPlaceholder,
          targetPeriodLabel: targetPeriodLabel !== undefined ? targetPeriodLabel : initiative.targetPeriodLabel,
          consultantGuidance: consultantGuidance !== undefined ? consultantGuidance : initiative.consultantGuidance,
          status: status !== undefined ? status : initiative.status,
          overrideRoadmapPeriod: periodChanged ? true : initiative.overrideRoadmapPeriod,
          updatedAt: new Date(),
        })
        .where(eq(growthBlueprintInitiativesTable.id, initiativeId))
        .returning();

      const activityType = periodChanged
        ? "GROWTH_BLUEPRINT.INITIATIVE_ROADMAP_PERIOD_CHANGED"
        : "GROWTH_BLUEPRINT.INITIATIVE_UPDATED";

      await logActivity({
        activityType,
        description: periodChanged
          ? `Initiative "${initiative.title}" moved from ${initiative.roadmapPeriod} to ${roadmapPeriod}`
          : `Initiative "${initiative.title}" updated`,
        actorUserId: userId,
        entityType: "growth_blueprint",
        entityId: blueprintId,
        metadata: { initiativeId, changes: req.body },
      }).catch(() => {});

      res.json(updated);
    } catch (err) {
      logger.error({ err }, "Update blueprint initiative failed");
      res.status(500).json({ error: "Failed to update blueprint initiative." });
    }
  },
);

// ─── POST /api/growth-blueprints/:id/initiatives/reorder ─────────
// Batch-update sequenceOrder for multiple initiatives.
// Body: { order: [{ id: string, sequenceOrder: number }] }

router.post(
  "/growth-blueprints/:id/initiatives/reorder",
  requireAuth,
  async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const blueprintId = String(req.params.id);

      const [blueprint] = await db
        .select()
        .from(growthBlueprintsTable)
        .where(eq(growthBlueprintsTable.id, blueprintId))
        .limit(1);

      if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
      if (blueprint.status === "approved" || blueprint.status === "archived" || blueprint.archivedAt) {
        return void res.status(409).json({ error: "Cannot reorder initiatives of an approved or archived blueprint." });
      }

      const { order } = req.body;
      if (!Array.isArray(order) || order.length === 0) {
        return void res.status(400).json({ error: "order must be a non-empty array of { id, sequenceOrder } objects." });
      }

      // Validate and apply each update
      for (const item of order) {
        if (!item.id || typeof item.sequenceOrder !== "number") {
          return void res.status(400).json({ error: "Each item must have id (string) and sequenceOrder (number)." });
        }
        await db
          .update(growthBlueprintInitiativesTable)
          .set({ sequenceOrder: item.sequenceOrder, updatedAt: new Date() })
          .where(
            and(
              eq(growthBlueprintInitiativesTable.id, String(item.id)),
              eq(growthBlueprintInitiativesTable.blueprintId, blueprintId),
            ),
          );
      }

      await logActivity({
        activityType: "GROWTH_BLUEPRINT.INITIATIVES_REORDERED",
        description: `${order.length} initiative${order.length !== 1 ? "s" : ""} reordered`,
        actorUserId: userId,
        entityType: "growth_blueprint",
        entityId: blueprintId,
        metadata: { count: order.length },
      }).catch(() => {});

      // Return updated list
      const updated = await db
        .select()
        .from(growthBlueprintInitiativesTable)
        .where(eq(growthBlueprintInitiativesTable.blueprintId, blueprintId))
        .orderBy(
          asc(growthBlueprintInitiativesTable.roadmapPeriod),
          asc(growthBlueprintInitiativesTable.sequenceOrder),
        );

      res.json({ data: updated });
    } catch (err) {
      logger.error({ err }, "Reorder blueprint initiatives failed");
      res.status(500).json({ error: "Failed to reorder blueprint initiatives." });
    }
  },
);

export default router;
