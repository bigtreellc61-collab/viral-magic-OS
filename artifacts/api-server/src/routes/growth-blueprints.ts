import { Router, type IRouter } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  growthBlueprintsTable,
  clientsTable,
  projectsTable,
  growthAssessmentsTable,
  solutionRecommendationPlansTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── GET /api/growth-blueprints/dashboard ────────────────────────
//
// Returns aggregated summary for dashboard display.

router.get("/growth-blueprints/dashboard", requireAuth, async (req, res) => {
  try {
    const allActive = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        clientId: growthBlueprintsTable.clientId,
        clientName: clientsTable.companyName,
        createdAt: growthBlueprintsTable.createdAt,
        updatedAt: growthBlueprintsTable.updatedAt,
        approvedAt: growthBlueprintsTable.approvedAt,
      })
      .from(growthBlueprintsTable)
      .leftJoin(clientsTable, eq(growthBlueprintsTable.clientId, clientsTable.id))
      .where(isNull(growthBlueprintsTable.archivedAt))
      .orderBy(desc(growthBlueprintsTable.updatedAt));

    const draft = allActive.filter((b) => b.status === "draft").length;
    const inProgress = allActive.filter((b) => b.status === "in_progress").length;
    const readyForReview = allActive.filter((b) => b.status === "ready_for_review").length;
    const approved = allActive.filter((b) => b.status === "approved").length;
    const recentBlueprints = allActive.slice(0, 5);

    res.json({ draft, inProgress, readyForReview, approved, recentBlueprints });
  } catch (err) {
    logger.error({ err }, "Get growth blueprint dashboard failed");
    res.status(500).json({ error: "Failed to get growth blueprint dashboard." });
  }
});

// ─── GET /api/growth-blueprints ───────────────────────────────────

router.get("/growth-blueprints", requireAuth, async (req, res) => {
  try {
    const blueprints = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        clientId: growthBlueprintsTable.clientId,
        projectId: growthBlueprintsTable.projectId,
        growthAssessmentId: growthBlueprintsTable.growthAssessmentId,
        solutionRecommendationPlanId: growthBlueprintsTable.solutionRecommendationPlanId,
        clientName: clientsTable.companyName,
        projectName: projectsTable.projectName,
        createdAt: growthBlueprintsTable.createdAt,
        updatedAt: growthBlueprintsTable.updatedAt,
        approvedAt: growthBlueprintsTable.approvedAt,
        archivedAt: growthBlueprintsTable.archivedAt,
      })
      .from(growthBlueprintsTable)
      .leftJoin(clientsTable, eq(growthBlueprintsTable.clientId, clientsTable.id))
      .leftJoin(projectsTable, eq(growthBlueprintsTable.projectId, projectsTable.id))
      .orderBy(desc(growthBlueprintsTable.updatedAt));

    res.json({ data: blueprints });
  } catch (err) {
    logger.error({ err }, "List growth blueprints failed");
    res.status(500).json({ error: "Failed to list growth blueprints." });
  }
});

// ─── POST /api/growth-blueprints ─────────────────────────────────
//
// Creates a blueprint linked to an approved Solution Recommendation Plan.

router.post("/growth-blueprints", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const { solutionRecommendationPlanId, title } = req.body;

    if (!solutionRecommendationPlanId) {
      return void res.status(400).json({ error: "solutionRecommendationPlanId is required." });
    }
    if (!title || !String(title).trim()) {
      return void res.status(400).json({ error: "title is required." });
    }

    // Load the plan
    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, String(solutionRecommendationPlanId)))
      .limit(1);

    if (!plan) {
      return void res.status(404).json({ error: "Solution Recommendation Plan not found." });
    }
    if (plan.status !== "approved") {
      return void res.status(400).json({
        error: `Growth Blueprints can only be created from approved Solution Recommendation Plans. Current status: ${plan.status}.`,
      });
    }

    // Check for an existing active (non-archived) blueprint for this plan
    const [existing] = await db
      .select({ id: growthBlueprintsTable.id, status: growthBlueprintsTable.status })
      .from(growthBlueprintsTable)
      .where(
        and(
          eq(
            growthBlueprintsTable.solutionRecommendationPlanId,
            String(solutionRecommendationPlanId),
          ),
          isNull(growthBlueprintsTable.archivedAt),
        ),
      )
      .limit(1);

    if (existing) {
      return void res.status(409).json({
        error: `An active blueprint already exists for this plan (status: ${existing.status}). Archive it before creating a new one.`,
        blueprintId: existing.id,
      });
    }

    const [blueprint] = await db
      .insert(growthBlueprintsTable)
      .values({
        clientId: plan.clientId,
        projectId: plan.projectId,
        growthAssessmentId: plan.growthAssessmentId,
        solutionRecommendationPlanId: String(solutionRecommendationPlanId),
        title: String(title).trim(),
        status: "draft",
        version: 1,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.CREATED",
      description: `Growth Blueprint "${blueprint.title}" created`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: blueprint.id,
      metadata: { solutionRecommendationPlanId: String(solutionRecommendationPlanId) },
    }).catch(() => {});

    res.status(201).json(blueprint);
  } catch (err) {
    logger.error({ err }, "Create growth blueprint failed");
    res.status(500).json({ error: "Failed to create growth blueprint." });
  }
});

// ─── GET /api/growth-blueprints/:id ──────────────────────────────
//
// Returns the blueprint with joined client/project names, plus
// assessment and plan summary fetched in separate queries to avoid
// Drizzle overload-resolution issues with 4+ leftJoins.

router.get("/growth-blueprints/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);

    // ── Main blueprint + client + project ────────────────────────
    const [row] = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        consultantNotes: growthBlueprintsTable.consultantNotes,
        clientId: growthBlueprintsTable.clientId,
        projectId: growthBlueprintsTable.projectId,
        growthAssessmentId: growthBlueprintsTable.growthAssessmentId,
        solutionRecommendationPlanId: growthBlueprintsTable.solutionRecommendationPlanId,
        approvedBy: growthBlueprintsTable.approvedBy,
        approvedAt: growthBlueprintsTable.approvedAt,
        archivedAt: growthBlueprintsTable.archivedAt,
        createdBy: growthBlueprintsTable.createdBy,
        updatedBy: growthBlueprintsTable.updatedBy,
        createdAt: growthBlueprintsTable.createdAt,
        updatedAt: growthBlueprintsTable.updatedAt,
        clientName: clientsTable.companyName,
        projectName: projectsTable.projectName,
      })
      .from(growthBlueprintsTable)
      .leftJoin(clientsTable, eq(growthBlueprintsTable.clientId, clientsTable.id))
      .leftJoin(projectsTable, eq(growthBlueprintsTable.projectId, projectsTable.id))
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!row) {
      return void res.status(404).json({ error: "Growth Blueprint not found." });
    }

    // ── Assessment summary ─────────────────────────────────────
    const [assessment] = await db
      .select({
        healthScore: growthAssessmentsTable.healthScore,
        healthRating: growthAssessmentsTable.healthRating,
        status: growthAssessmentsTable.status,
      })
      .from(growthAssessmentsTable)
      .where(eq(growthAssessmentsTable.id, row.growthAssessmentId))
      .limit(1);

    // ── Plan summary ───────────────────────────────────────────
    const [plan] = await db
      .select({
        status: solutionRecommendationPlansTable.status,
        executiveRecommendation: solutionRecommendationPlansTable.executiveRecommendation,
        overallPriorityScore: solutionRecommendationPlansTable.overallPriorityScore,
      })
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, row.solutionRecommendationPlanId))
      .limit(1);

    res.json({
      ...row,
      assessmentHealthScore: assessment?.healthScore ?? null,
      assessmentHealthRating: assessment?.healthRating ?? null,
      assessmentStatus: assessment?.status ?? null,
      planStatus: plan?.status ?? null,
      planExecutiveRecommendation: plan?.executiveRecommendation ?? null,
      planOverallPriorityScore: plan?.overallPriorityScore ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Get growth blueprint failed");
    res.status(500).json({ error: "Failed to get growth blueprint." });
  }
});

// ─── PATCH /api/growth-blueprints/:id ────────────────────────────
//
// Updates editable fields: title and consultantNotes.

router.patch("/growth-blueprints/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const id = String(req.params.id);
    const { title, consultantNotes } = req.body;

    const [existing] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!existing) return void res.status(404).json({ error: "Growth Blueprint not found." });
    if (existing.archivedAt) {
      return void res.status(409).json({ error: "Cannot edit an archived blueprint." });
    }
    if (existing.status === "approved") {
      return void res
        .status(409)
        .json({ error: "Cannot edit an approved blueprint. Reopen it first." });
    }

    const [updated] = await db
      .update(growthBlueprintsTable)
      .set({
        title: title !== undefined ? String(title).trim() : existing.title,
        consultantNotes: consultantNotes !== undefined ? consultantNotes : existing.consultantNotes,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(growthBlueprintsTable.id, id))
      .returning();

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.UPDATED",
      description: `Growth Blueprint "${updated.title}" updated`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: id,
      metadata: {},
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update growth blueprint failed");
    res.status(500).json({ error: "Failed to update growth blueprint." });
  }
});

// ─── Lifecycle transition helper ──────────────────────────────────

async function transitionBlueprint(
  id: string,
  userId: string,
  fromStatuses: string[],
  toStatus: string,
  activityType: string,
  activityDescription: string,
  extraUpdates?: { approvedBy?: string; approvedAt?: Date },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const [existing] = await db
    .select()
    .from(growthBlueprintsTable)
    .where(eq(growthBlueprintsTable.id, id))
    .limit(1);

  if (!existing) {
    return { ok: false, status: 404, body: { error: "Growth Blueprint not found." } };
  }

  if (!fromStatuses.includes(existing.status)) {
    return {
      ok: false,
      status: 409,
      body: {
        error: `Blueprint cannot transition to "${toStatus}" from status "${existing.status}". Expected: ${fromStatuses.join(" or ")}.`,
      },
    };
  }

  if (existing.archivedAt) {
    return {
      ok: false,
      status: 409,
      body: { error: "Cannot transition an archived blueprint." },
    };
  }

  const setValues: Parameters<typeof db.update>[0] extends never
    ? never
    : {
        status: string;
        updatedBy: string;
        updatedAt: Date;
        approvedBy?: string;
        approvedAt?: Date;
      } = {
    status: toStatus,
    updatedBy: userId,
    updatedAt: new Date(),
    ...(extraUpdates ?? {}),
  };

  const [updated] = await db
    .update(growthBlueprintsTable)
    .set(setValues)
    .where(eq(growthBlueprintsTable.id, id))
    .returning();

  await logActivity({
    activityType,
    description: activityDescription,
    actorUserId: userId,
    entityType: "growth_blueprint",
    entityId: id,
    metadata: { previousStatus: existing.status, newStatus: toStatus },
  }).catch(() => {});

  return { ok: true, status: 200, body: updated };
}

// ─── POST /api/growth-blueprints/:id/start ───────────────────────
// draft → in_progress

router.post("/growth-blueprints/:id/start", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);
  try {
    const result = await transitionBlueprint(
      id,
      userId,
      ["draft"],
      "in_progress",
      "GROWTH_BLUEPRINT.STARTED",
      "Growth Blueprint moved to In Progress",
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ err }, "Start growth blueprint failed");
    res.status(500).json({ error: "Failed to start growth blueprint." });
  }
});

// ─── POST /api/growth-blueprints/:id/ready ───────────────────────
// in_progress → ready_for_review

router.post("/growth-blueprints/:id/ready", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);
  try {
    const result = await transitionBlueprint(
      id,
      userId,
      ["in_progress"],
      "ready_for_review",
      "GROWTH_BLUEPRINT.READY_FOR_REVIEW",
      "Growth Blueprint submitted for review",
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ err }, "Ready growth blueprint failed");
    res.status(500).json({ error: "Failed to mark blueprint ready for review." });
  }
});

// ─── POST /api/growth-blueprints/:id/approve ─────────────────────
// ready_for_review → approved

router.post("/growth-blueprints/:id/approve", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);
  try {
    const result = await transitionBlueprint(
      id,
      userId,
      ["ready_for_review"],
      "approved",
      "GROWTH_BLUEPRINT.APPROVED",
      "Growth Blueprint approved",
      { approvedBy: userId, approvedAt: new Date() },
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ err }, "Approve growth blueprint failed");
    res.status(500).json({ error: "Failed to approve growth blueprint." });
  }
});

// ─── POST /api/growth-blueprints/:id/archive ─────────────────────
// any non-archived → archived

router.post("/growth-blueprints/:id/archive", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);
  try {
    const [existing] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!existing) return void res.status(404).json({ error: "Growth Blueprint not found." });
    if (existing.archivedAt) {
      return void res.status(409).json({ error: "Blueprint is already archived." });
    }

    const [updated] = await db
      .update(growthBlueprintsTable)
      .set({
        status: "archived",
        archivedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(growthBlueprintsTable.id, id))
      .returning();

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.ARCHIVED",
      description: `Growth Blueprint "${existing.title}" archived`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: id,
      metadata: { previousStatus: existing.status },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Archive growth blueprint failed");
    res.status(500).json({ error: "Failed to archive growth blueprint." });
  }
});

// ─── GET /api/clients/:id/growth-blueprints ───────────────────────

router.get("/clients/:id/growth-blueprints", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const blueprints = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        projectId: growthBlueprintsTable.projectId,
        growthAssessmentId: growthBlueprintsTable.growthAssessmentId,
        solutionRecommendationPlanId: growthBlueprintsTable.solutionRecommendationPlanId,
        projectName: projectsTable.projectName,
        createdAt: growthBlueprintsTable.createdAt,
        updatedAt: growthBlueprintsTable.updatedAt,
        approvedAt: growthBlueprintsTable.approvedAt,
        archivedAt: growthBlueprintsTable.archivedAt,
      })
      .from(growthBlueprintsTable)
      .leftJoin(projectsTable, eq(growthBlueprintsTable.projectId, projectsTable.id))
      .where(eq(growthBlueprintsTable.clientId, id))
      .orderBy(desc(growthBlueprintsTable.updatedAt));

    res.json({ data: blueprints });
  } catch (err) {
    logger.error({ err }, "List client growth blueprints failed");
    res.status(500).json({ error: "Failed to list client growth blueprints." });
  }
});

// ─── GET /api/solution-recommendations/:id/growth-blueprint ──────
// Returns the active (non-archived) blueprint linked to a plan, or null.

router.get("/solution-recommendations/:id/growth-blueprint", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const [blueprint] = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        createdAt: growthBlueprintsTable.createdAt,
        updatedAt: growthBlueprintsTable.updatedAt,
        approvedAt: growthBlueprintsTable.approvedAt,
      })
      .from(growthBlueprintsTable)
      .where(
        and(
          eq(growthBlueprintsTable.solutionRecommendationPlanId, id),
          isNull(growthBlueprintsTable.archivedAt),
        ),
      )
      .orderBy(desc(growthBlueprintsTable.createdAt))
      .limit(1);

    if (!blueprint) return void res.json(null);
    res.json(blueprint);
  } catch (err) {
    logger.error({ err }, "Get blueprint for plan failed");
    res.status(500).json({ error: "Failed to get blueprint for plan." });
  }
});

export default router;
