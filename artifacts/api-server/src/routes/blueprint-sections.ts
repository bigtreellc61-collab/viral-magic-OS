import { Router, type IRouter } from "express";
import { and, asc, eq } from "drizzle-orm";
import {
  db,
  growthBlueprintsTable,
  growthBlueprintSectionsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── GET /api/growth-blueprints/:id/sections ─────────────────────

router.get("/growth-blueprints/:id/sections", requireAuth, async (req, res) => {
  try {
    const blueprintId = String(req.params.id);

    // Verify blueprint exists
    const [blueprint] = await db
      .select({ id: growthBlueprintsTable.id, status: growthBlueprintsTable.status })
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, blueprintId))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });

    const sections = await db
      .select()
      .from(growthBlueprintSectionsTable)
      .where(eq(growthBlueprintSectionsTable.blueprintId, blueprintId))
      .orderBy(asc(growthBlueprintSectionsTable.sectionOrder));

    // Compute finalContent for each section
    const enriched = sections.map((s) => ({
      ...s,
      finalContent: s.consultantContent ?? s.generatedContent,
      hasOverride: s.consultantContent !== null,
    }));

    res.json({ data: enriched });
  } catch (err) {
    logger.error({ err }, "Get blueprint sections failed");
    res.status(500).json({ error: "Failed to get blueprint sections." });
  }
});

// ─── PATCH /api/growth-blueprints/:id/sections/:sectionId ────────
// Edit consultant override content for a section.

router.patch("/growth-blueprints/:id/sections/:sectionId", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const blueprintId = String(req.params.id);
    const sectionId = String(req.params.sectionId);

    // Fetch blueprint for lock checks
    const [blueprint] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, blueprintId))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
    if (blueprint.status === "approved" || blueprint.status === "archived" || blueprint.archivedAt) {
      return void res
        .status(409)
        .json({ error: "Sections of an approved or archived blueprint are read-only. Create a revision to make changes." });
    }

    const [section] = await db
      .select()
      .from(growthBlueprintSectionsTable)
      .where(
        and(
          eq(growthBlueprintSectionsTable.id, sectionId),
          eq(growthBlueprintSectionsTable.blueprintId, blueprintId),
        ),
      )
      .limit(1);

    if (!section) return void res.status(404).json({ error: "Section not found." });
    if (section.isLocked) {
      return void res.status(409).json({ error: "This section is locked and cannot be edited." });
    }

    const { consultantContent } = req.body;
    if (consultantContent === undefined) {
      return void res.status(400).json({ error: "consultantContent is required." });
    }

    const [updated] = await db
      .update(growthBlueprintSectionsTable)
      .set({
        consultantContent: consultantContent === null ? null : String(consultantContent),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(growthBlueprintSectionsTable.id, sectionId))
      .returning();

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.SECTION_EDITED",
      description: `Section "${section.title}" edited`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: blueprintId,
      metadata: { sectionKey: section.sectionKey, sectionId },
    }).catch(() => {});

    res.json({
      ...updated,
      finalContent: updated.consultantContent ?? updated.generatedContent,
      hasOverride: updated.consultantContent !== null,
    });
  } catch (err) {
    logger.error({ err }, "Update blueprint section failed");
    res.status(500).json({ error: "Failed to update blueprint section." });
  }
});

// ─── POST /api/growth-blueprints/:id/sections/:sectionId/reset ───
// Remove consultant override and revert to generated content.

router.post(
  "/growth-blueprints/:id/sections/:sectionId/reset",
  requireAuth,
  async (req, res) => {
    try {
      const userId = (req as any).user?.id as string;
      const blueprintId = String(req.params.id);
      const sectionId = String(req.params.sectionId);

      const [blueprint] = await db
        .select()
        .from(growthBlueprintsTable)
        .where(eq(growthBlueprintsTable.id, blueprintId))
        .limit(1);

      if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
      if (blueprint.status === "approved" || blueprint.status === "archived" || blueprint.archivedAt) {
        return void res.status(409).json({ error: "Cannot reset sections of an approved or archived blueprint." });
      }

      const [section] = await db
        .select()
        .from(growthBlueprintSectionsTable)
        .where(
          and(
            eq(growthBlueprintSectionsTable.id, sectionId),
            eq(growthBlueprintSectionsTable.blueprintId, blueprintId),
          ),
        )
        .limit(1);

      if (!section) return void res.status(404).json({ error: "Section not found." });
      if (!section.consultantContent) {
        return void res.status(409).json({ error: "No consultant override to reset." });
      }

      const [updated] = await db
        .update(growthBlueprintSectionsTable)
        .set({ consultantContent: null, updatedBy: userId, updatedAt: new Date() })
        .where(eq(growthBlueprintSectionsTable.id, sectionId))
        .returning();

      await logActivity({
        activityType: "GROWTH_BLUEPRINT.SECTION_OVERRIDE_RESET",
        description: `Section "${section.title}" override reset to generated content`,
        actorUserId: userId,
        entityType: "growth_blueprint",
        entityId: blueprintId,
        metadata: { sectionKey: section.sectionKey, sectionId },
      }).catch(() => {});

      res.json({
        ...updated,
        finalContent: updated.generatedContent,
        hasOverride: false,
      });
    } catch (err) {
      logger.error({ err }, "Reset blueprint section failed");
      res.status(500).json({ error: "Failed to reset blueprint section." });
    }
  },
);

export default router;
