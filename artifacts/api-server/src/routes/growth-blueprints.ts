import { Router, type IRouter } from "express";
import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import {
  db,
  growthBlueprintsTable,
  growthBlueprintSectionsTable,
  growthBlueprintInitiativesTable,
  clientsTable,
  projectsTable,
  growthAssessmentsTable,
  solutionRecommendationPlansTable,
  solutionRecommendationsTable,
  solutionRecommendationActionsTable,
  solutionRecommendationDependenciesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";
import { assembleBlueprint } from "../lib/blueprint-assembly-engine";

const router: IRouter = Router();

// ─── GET /api/growth-blueprints/dashboard ────────────────────────

router.get("/growth-blueprints/dashboard", requireAuth, async (_req, res) => {
  try {
    const allActive = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        revisionNumber: growthBlueprintsTable.revisionNumber,
        isCurrent: growthBlueprintsTable.isCurrent,
        generationStatus: growthBlueprintsTable.generationStatus,
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

router.get("/growth-blueprints", requireAuth, async (_req, res) => {
  try {
    const blueprints = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        revisionNumber: growthBlueprintsTable.revisionNumber,
        isCurrent: growthBlueprintsTable.isCurrent,
        generationStatus: growthBlueprintsTable.generationStatus,
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

    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, String(solutionRecommendationPlanId)))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Solution Recommendation Plan not found." });
    if (plan.status !== "approved") {
      return void res.status(400).json({
        error: `Growth Blueprints can only be created from approved plans. Current status: ${plan.status}.`,
      });
    }

    // Block if an active non-approved, non-archived blueprint already exists for this plan
    const [existing] = await db
      .select({ id: growthBlueprintsTable.id, status: growthBlueprintsTable.status })
      .from(growthBlueprintsTable)
      .where(
        and(
          eq(growthBlueprintsTable.solutionRecommendationPlanId, String(solutionRecommendationPlanId)),
          isNull(growthBlueprintsTable.archivedAt),
          ne(growthBlueprintsTable.status, "approved"),
        ),
      )
      .limit(1);

    if (existing) {
      return void res.status(409).json({
        error: `An active blueprint already exists for this plan (status: ${existing.status}). Archive it or use the revise endpoint after approval.`,
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
        revisionNumber: 0,
        isCurrent: true,
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

router.get("/growth-blueprints/:id", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);

    const [row] = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        revisionNumber: growthBlueprintsTable.revisionNumber,
        isCurrent: growthBlueprintsTable.isCurrent,
        previousVersionId: growthBlueprintsTable.previousVersionId,
        generationStatus: growthBlueprintsTable.generationStatus,
        generationError: growthBlueprintsTable.generationError,
        generatedAt: growthBlueprintsTable.generatedAt,
        sourceAssessmentStatus: growthBlueprintsTable.sourceAssessmentStatus,
        sourcePlanStatus: growthBlueprintsTable.sourcePlanStatus,
        consultantNotes: growthBlueprintsTable.consultantNotes,
        clientId: growthBlueprintsTable.clientId,
        projectId: growthBlueprintsTable.projectId,
        growthAssessmentId: growthBlueprintsTable.growthAssessmentId,
        solutionRecommendationPlanId: growthBlueprintsTable.solutionRecommendationPlanId,
        approvedBy: growthBlueprintsTable.approvedBy,
        approvedAt: growthBlueprintsTable.approvedAt,
        supersededAt: growthBlueprintsTable.supersededAt,
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

    if (!row) return void res.status(404).json({ error: "Growth Blueprint not found." });

    const [assessment] = await db
      .select({
        healthScore: growthAssessmentsTable.healthScore,
        healthRating: growthAssessmentsTable.healthRating,
        status: growthAssessmentsTable.status,
      })
      .from(growthAssessmentsTable)
      .where(eq(growthAssessmentsTable.id, row.growthAssessmentId))
      .limit(1);

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
      versionLabel: `Version ${row.version}.${row.revisionNumber}`,
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
    if (existing.archivedAt) return void res.status(409).json({ error: "Cannot edit an archived blueprint." });
    if (existing.status === "approved") {
      return void res.status(409).json({ error: "Cannot edit an approved blueprint. Create a revision to make changes." });
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

// ─── POST /api/growth-blueprints/:id/generate ────────────────────
// Assemble all sections and initiatives from source data.
// Allowed only for draft or in_progress blueprints.

router.post("/growth-blueprints/:id/generate", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);

  try {
    const [blueprint] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
    if (blueprint.status !== "draft" && blueprint.status !== "in_progress") {
      return void res.status(409).json({
        error: `Blueprint can only be generated in draft or in_progress status. Current: ${blueprint.status}.`,
      });
    }
    if (blueprint.archivedAt) return void res.status(409).json({ error: "Cannot generate for an archived blueprint." });

    // Validate source data exists
    const [assessment] = await db
      .select()
      .from(growthAssessmentsTable)
      .where(eq(growthAssessmentsTable.id, blueprint.growthAssessmentId))
      .limit(1);

    if (!assessment) return void res.status(400).json({ error: "Linked Growth Assessment not found." });

    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, blueprint.solutionRecommendationPlanId))
      .limit(1);

    if (!plan) return void res.status(400).json({ error: "Linked Solution Recommendation Plan not found." });
    if (plan.status !== "approved") {
      return void res.status(400).json({
        error: `Blueprint can only be generated from an approved plan. Plan status: ${plan.status}.`,
      });
    }

    const recommendations = await db
      .select()
      .from(solutionRecommendationsTable)
      .where(eq(solutionRecommendationsTable.planId, plan.id))
      .orderBy(asc(solutionRecommendationsTable.rank));

    if (recommendations.length === 0) {
      return void res.status(400).json({ error: "The linked plan has no recommendations. At least one recommendation is required to generate the blueprint." });
    }

    const [actions, dependencies] = await Promise.all([
      db
        .select()
        .from(solutionRecommendationActionsTable)
        .where(
          eq(
            solutionRecommendationActionsTable.recommendationId,
            // fetch actions for all recs in this plan
            // use a subquery via inArray approach — simplest: fetch all and filter in JS
            recommendations[0].id,
          ),
        )
        .limit(0), // placeholder — we fetch all below
      db
        .select()
        .from(solutionRecommendationDependenciesTable)
        .where(eq(solutionRecommendationDependenciesTable.planId, plan.id)),
    ]);

    // Fetch all actions for all recommendations in this plan
    const allActions = await db
      .select()
      .from(solutionRecommendationActionsTable)
      .where(
        eq(
          solutionRecommendationActionsTable.recommendationId,
          // We need all actions; drizzle inArray requires the list
          // Workaround: fetch via a join approach or collect IDs
          recommendations[0].id, // placeholder
        ),
      )
      .limit(0);

    // Direct query using raw IN list
    const recIds = recommendations.map((r) => r.id);
    let allActionsReal: typeof allActions = [];
    if (recIds.length > 0) {
      // Use separate queries per rec (max 5 recs per the engine)
      const actionResults = await Promise.all(
        recIds.map((rid) =>
          db
            .select()
            .from(solutionRecommendationActionsTable)
            .where(eq(solutionRecommendationActionsTable.recommendationId, rid))
            .orderBy(asc(solutionRecommendationActionsTable.sortOrder)),
        ),
      );
      allActionsReal = actionResults.flat();
    }

    // Mark generation pending
    await db
      .update(growthBlueprintsTable)
      .set({ generationStatus: "pending", generationError: null, updatedBy: userId, updatedAt: new Date() })
      .where(eq(growthBlueprintsTable.id, id));

    // Run assembly engine
    let result;
    try {
      result = assembleBlueprint({
        blueprint: {
          id: blueprint.id,
          title: blueprint.title,
          consultantNotes: blueprint.consultantNotes,
        },
        assessment,
        plan,
        recommendations,
        actions: allActionsReal,
        dependencies,
      });
    } catch (engineErr) {
      await db
        .update(growthBlueprintsTable)
        .set({ generationStatus: "failed", generationError: String(engineErr), updatedBy: userId, updatedAt: new Date() })
        .where(eq(growthBlueprintsTable.id, id));
      return void res.status(500).json({ error: "Blueprint assembly failed.", detail: String(engineErr) });
    }

    // Upsert sections — delete existing and re-insert
    await db
      .delete(growthBlueprintSectionsTable)
      .where(eq(growthBlueprintSectionsTable.blueprintId, id));

    const now = new Date();
    for (const section of result.sections) {
      await db.insert(growthBlueprintSectionsTable).values({
        blueprintId: id,
        sectionKey: section.sectionKey,
        title: section.title,
        sectionOrder: section.sectionOrder,
        generatedContent: section.generatedContent,
        consultantContent: null, // fresh generate always clears overrides on first run
        sourceReferences: section.sourceReferences,
        generationStatus: "complete",
        isLocked: false,
        generatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });
    }

    // Upsert initiatives — delete existing and re-insert
    await db
      .delete(growthBlueprintInitiativesTable)
      .where(eq(growthBlueprintInitiativesTable.blueprintId, id));

    for (let i = 0; i < result.initiatives.length; i++) {
      const init = result.initiatives[i];
      await db.insert(growthBlueprintInitiativesTable).values({
        blueprintId: id,
        sourceRecommendationId: init.sourceRecommendationId,
        title: init.title,
        summary: init.summary,
        domain: init.domain,
        priorityClassification: init.priorityClassification,
        effortLevel: init.effortLevel,
        roadmapPeriod: init.roadmapPeriod,
        roadmapReason: init.roadmapReason,
        sequenceOrder: init.sequenceOrder,
        ownerPlaceholder: init.ownerPlaceholder,
        expectedBusinessImpact: init.expectedBusinessImpact,
        overrideRoadmapPeriod: false,
        status: "active",
      });
    }

    // Mark complete and store source snapshots
    const [updatedBlueprint] = await db
      .update(growthBlueprintsTable)
      .set({
        generationStatus: "complete",
        generationError: null,
        generatedAt: now,
        sourceAssessmentStatus: assessment.status,
        sourcePlanStatus: plan.status,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(growthBlueprintsTable.id, id))
      .returning();

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.GENERATED",
      description: `Growth Blueprint "${blueprint.title}" generated with ${result.summary.initiativeCount} initiative(s)`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: id,
      metadata: result.summary,
    }).catch(() => {});

    res.json({
      blueprint: updatedBlueprint,
      summary: result.summary,
    });
  } catch (err) {
    logger.error({ err }, "Generate growth blueprint failed");
    res.status(500).json({ error: "Failed to generate growth blueprint." });
  }
});

// ─── POST /api/growth-blueprints/:id/regenerate ──────────────────
// Re-runs the assembly engine but preserves consultant overrides on sections.

router.post("/growth-blueprints/:id/regenerate", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);

  try {
    const [blueprint] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
    if (blueprint.status !== "draft" && blueprint.status !== "in_progress") {
      return void res.status(409).json({
        error: `Blueprint can only be regenerated in draft or in_progress status. Current: ${blueprint.status}.`,
      });
    }
    if (blueprint.archivedAt) return void res.status(409).json({ error: "Cannot regenerate an archived blueprint." });
    if (blueprint.generationStatus !== "complete") {
      return void res.status(409).json({ error: "Generate the blueprint first before regenerating." });
    }

    // Capture existing consultant overrides before rebuild
    const existingSections = await db
      .select({
        sectionKey: growthBlueprintSectionsTable.sectionKey,
        consultantContent: growthBlueprintSectionsTable.consultantContent,
      })
      .from(growthBlueprintSectionsTable)
      .where(eq(growthBlueprintSectionsTable.blueprintId, id));

    const overrideMap = new Map(
      existingSections
        .filter((s) => s.consultantContent !== null)
        .map((s) => [s.sectionKey, s.consultantContent]),
    );

    // Capture existing initiative consultant fields (roadmap overrides, guidance, owners)
    const existingInitiatives = await db
      .select()
      .from(growthBlueprintInitiativesTable)
      .where(eq(growthBlueprintInitiativesTable.blueprintId, id));

    const initiativeOverrideMap = new Map(
      existingInitiatives
        .filter((i) => i.overrideRoadmapPeriod || i.consultantGuidance || i.ownerPlaceholder || i.targetPeriodLabel)
        .map((i) => [i.sourceRecommendationId, i]),
    );

    // Load source data
    const [assessment] = await db
      .select()
      .from(growthAssessmentsTable)
      .where(eq(growthAssessmentsTable.id, blueprint.growthAssessmentId))
      .limit(1);

    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, blueprint.solutionRecommendationPlanId))
      .limit(1);

    if (!assessment || !plan) {
      return void res.status(400).json({ error: "Source assessment or plan no longer available." });
    }
    if (plan.status !== "approved") {
      return void res.status(400).json({ error: `Plan status is no longer 'approved' (current: ${plan.status}). Cannot regenerate.` });
    }

    const recommendations = await db
      .select()
      .from(solutionRecommendationsTable)
      .where(eq(solutionRecommendationsTable.planId, plan.id))
      .orderBy(asc(solutionRecommendationsTable.rank));

    if (recommendations.length === 0) {
      return void res.status(400).json({ error: "Plan has no recommendations." });
    }

    const recIds = recommendations.map((r) => r.id);
    const [allActionsResult, dependencies] = await Promise.all([
      Promise.all(
        recIds.map((rid) =>
          db
            .select()
            .from(solutionRecommendationActionsTable)
            .where(eq(solutionRecommendationActionsTable.recommendationId, rid))
            .orderBy(asc(solutionRecommendationActionsTable.sortOrder)),
        ),
      ),
      db
        .select()
        .from(solutionRecommendationDependenciesTable)
        .where(eq(solutionRecommendationDependenciesTable.planId, plan.id)),
    ]);
    const allActions = allActionsResult.flat();

    let result;
    try {
      result = assembleBlueprint({
        blueprint: {
          id: blueprint.id,
          title: blueprint.title,
          consultantNotes: blueprint.consultantNotes,
        },
        assessment,
        plan,
        recommendations,
        actions: allActions,
        dependencies,
      });
    } catch (engineErr) {
      await db
        .update(growthBlueprintsTable)
        .set({ generationStatus: "failed", generationError: String(engineErr), updatedBy: userId, updatedAt: new Date() })
        .where(eq(growthBlueprintsTable.id, id));
      return void res.status(500).json({ error: "Blueprint assembly failed.", detail: String(engineErr) });
    }

    // Delete and re-insert sections, preserving overrides
    await db
      .delete(growthBlueprintSectionsTable)
      .where(eq(growthBlueprintSectionsTable.blueprintId, id));

    const now = new Date();
    for (const section of result.sections) {
      await db.insert(growthBlueprintSectionsTable).values({
        blueprintId: id,
        sectionKey: section.sectionKey,
        title: section.title,
        sectionOrder: section.sectionOrder,
        generatedContent: section.generatedContent,
        consultantContent: overrideMap.get(section.sectionKey) ?? null, // preserve override
        sourceReferences: section.sourceReferences,
        generationStatus: "complete",
        isLocked: false,
        generatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      });
    }

    // Delete and re-insert initiatives, preserving consultant fields for unchanged recs
    await db
      .delete(growthBlueprintInitiativesTable)
      .where(eq(growthBlueprintInitiativesTable.blueprintId, id));

    for (const init of result.initiatives) {
      const prior = initiativeOverrideMap.get(init.sourceRecommendationId);
      await db.insert(growthBlueprintInitiativesTable).values({
        blueprintId: id,
        sourceRecommendationId: init.sourceRecommendationId,
        title: init.title,
        summary: init.summary,
        domain: init.domain,
        priorityClassification: init.priorityClassification,
        effortLevel: init.effortLevel,
        // Preserve consultant roadmap override if set
        roadmapPeriod: prior?.overrideRoadmapPeriod ? (prior.roadmapPeriod ?? init.roadmapPeriod) : init.roadmapPeriod,
        roadmapReason: prior?.overrideRoadmapPeriod ? (prior.roadmapReason ?? init.roadmapReason) : init.roadmapReason,
        overrideRoadmapPeriod: prior?.overrideRoadmapPeriod ?? false,
        sequenceOrder: init.sequenceOrder,
        ownerPlaceholder: prior?.ownerPlaceholder ?? init.ownerPlaceholder,
        targetPeriodLabel: prior?.targetPeriodLabel ?? null,
        expectedBusinessImpact: init.expectedBusinessImpact,
        consultantGuidance: prior?.consultantGuidance ?? null,
        status: "active",
      });
    }

    const [updatedBlueprint] = await db
      .update(growthBlueprintsTable)
      .set({
        generationStatus: "complete",
        generationError: null,
        generatedAt: now,
        revisionNumber: (blueprint.revisionNumber ?? 0) + 1,
        sourceAssessmentStatus: assessment.status,
        sourcePlanStatus: plan.status,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(growthBlueprintsTable.id, id))
      .returning();

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.REGENERATED",
      description: `Growth Blueprint "${blueprint.title}" regenerated (overrides preserved: ${overrideMap.size} section(s))`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: id,
      metadata: { ...result.summary, preservedOverrides: overrideMap.size },
    }).catch(() => {});

    res.json({
      blueprint: updatedBlueprint,
      summary: result.summary,
    });
  } catch (err) {
    logger.error({ err }, "Regenerate growth blueprint failed");
    res.status(500).json({ error: "Failed to regenerate growth blueprint." });
  }
});

// ─── POST /api/growth-blueprints/:id/revise ──────────────────────
// Creates a new draft version from an approved blueprint.

router.post("/growth-blueprints/:id/revise", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id as string;
    const id = String(req.params.id);
    const { title } = req.body;

    const [blueprint] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
    if (blueprint.status !== "approved") {
      return void res.status(409).json({
        error: `Only approved blueprints can be revised. Current status: ${blueprint.status}.`,
      });
    }

    // Check for an existing in-progress revision (non-approved, non-archived) for this plan
    const [existingRevision] = await db
      .select({ id: growthBlueprintsTable.id, status: growthBlueprintsTable.status })
      .from(growthBlueprintsTable)
      .where(
        and(
          eq(growthBlueprintsTable.solutionRecommendationPlanId, blueprint.solutionRecommendationPlanId),
          isNull(growthBlueprintsTable.archivedAt),
          ne(growthBlueprintsTable.status, "approved"),
        ),
      )
      .limit(1);

    if (existingRevision) {
      return void res.status(409).json({
        error: `A draft revision already exists for this blueprint (status: ${existingRevision.status}). Complete or archive it before creating another revision.`,
        blueprintId: existingRevision.id,
      });
    }

    const newTitle = title ? String(title).trim() : `${blueprint.title} (Revision ${blueprint.version + 1})`;

    const [revision] = await db
      .insert(growthBlueprintsTable)
      .values({
        clientId: blueprint.clientId,
        projectId: blueprint.projectId,
        growthAssessmentId: blueprint.growthAssessmentId,
        solutionRecommendationPlanId: blueprint.solutionRecommendationPlanId,
        title: newTitle,
        status: "draft",
        version: blueprint.version + 1,
        revisionNumber: 0,
        previousVersionId: blueprint.id,
        isCurrent: false, // becomes current only when approved (superseding the prior approved version)
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.REVISION_CREATED",
      description: `Revision v${revision.version}.0 created from approved v${blueprint.version}.${blueprint.revisionNumber}`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: revision.id,
      metadata: { previousBlueprintId: blueprint.id, newVersion: revision.version },
    }).catch(() => {});

    res.status(201).json(revision);
  } catch (err) {
    logger.error({ err }, "Revise growth blueprint failed");
    res.status(500).json({ error: "Failed to create blueprint revision." });
  }
});

// ─── GET /api/growth-blueprints/:id/versions ─────────────────────

router.get("/growth-blueprints/:id/versions", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);

    const [blueprint] = await db
      .select({ planId: growthBlueprintsTable.solutionRecommendationPlanId })
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });

    const versions = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        revisionNumber: growthBlueprintsTable.revisionNumber,
        isCurrent: growthBlueprintsTable.isCurrent,
        previousVersionId: growthBlueprintsTable.previousVersionId,
        generationStatus: growthBlueprintsTable.generationStatus,
        approvedAt: growthBlueprintsTable.approvedAt,
        supersededAt: growthBlueprintsTable.supersededAt,
        archivedAt: growthBlueprintsTable.archivedAt,
        createdAt: growthBlueprintsTable.createdAt,
        updatedAt: growthBlueprintsTable.updatedAt,
      })
      .from(growthBlueprintsTable)
      .where(
        eq(
          growthBlueprintsTable.solutionRecommendationPlanId,
          blueprint.planId,
        ),
      )
      .orderBy(desc(growthBlueprintsTable.version), desc(growthBlueprintsTable.revisionNumber));

    const enriched = versions.map((v) => ({
      ...v,
      versionLabel: `Version ${v.version}.${v.revisionNumber}`,
    }));

    res.json({ data: enriched });
  } catch (err) {
    logger.error({ err }, "Get blueprint versions failed");
    res.status(500).json({ error: "Failed to get blueprint versions." });
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
  extraUpdates?: { approvedBy?: string; approvedAt?: Date; isCurrent?: boolean },
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
    return { ok: false, status: 409, body: { error: "Cannot transition an archived blueprint." } };
  }

  const [updated] = await db
    .update(growthBlueprintsTable)
    .set({
      status: toStatus,
      updatedBy: userId,
      updatedAt: new Date(),
      ...(extraUpdates ?? {}),
    })
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

router.post("/growth-blueprints/:id/start", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);
  try {
    const result = await transitionBlueprint(id, userId, ["draft"], "in_progress",
      "GROWTH_BLUEPRINT.STARTED", "Growth Blueprint moved to In Progress");
    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ err }, "Start growth blueprint failed");
    res.status(500).json({ error: "Failed to start growth blueprint." });
  }
});

// ─── POST /api/growth-blueprints/:id/ready ───────────────────────
// in_progress → ready_for_review
// Validates: generated, executive summary present, at least one strategic priority and initiative.

router.post("/growth-blueprints/:id/ready", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);
  try {
    const [blueprint] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });

    // Readiness validation
    if (blueprint.generationStatus !== "complete") {
      return void res.status(400).json({ error: "Blueprint must be generated successfully before submitting for review." });
    }

    const [execSection] = await db
      .select({ sectionKey: growthBlueprintSectionsTable.sectionKey, generationStatus: growthBlueprintSectionsTable.generationStatus })
      .from(growthBlueprintSectionsTable)
      .where(
        and(
          eq(growthBlueprintSectionsTable.blueprintId, id),
          eq(growthBlueprintSectionsTable.sectionKey, "executive_summary"),
        ),
      )
      .limit(1);

    if (!execSection || execSection.generationStatus !== "complete") {
      return void res.status(400).json({ error: "Executive Summary must be generated before submitting for review." });
    }

    const [strategicSection] = await db
      .select({ generationStatus: growthBlueprintSectionsTable.generationStatus })
      .from(growthBlueprintSectionsTable)
      .where(
        and(
          eq(growthBlueprintSectionsTable.blueprintId, id),
          eq(growthBlueprintSectionsTable.sectionKey, "strategic_priorities"),
        ),
      )
      .limit(1);

    if (!strategicSection || strategicSection.generationStatus !== "complete") {
      return void res.status(400).json({ error: "Strategic Priorities must be generated before submitting for review." });
    }

    const [initiative] = await db
      .select({ id: growthBlueprintInitiativesTable.id })
      .from(growthBlueprintInitiativesTable)
      .where(eq(growthBlueprintInitiativesTable.blueprintId, id))
      .limit(1);

    if (!initiative) {
      return void res.status(400).json({ error: "At least one roadmap initiative is required before submitting for review." });
    }

    const result = await transitionBlueprint(id, userId, ["in_progress"], "ready_for_review",
      "GROWTH_BLUEPRINT.READY_FOR_REVIEW", "Growth Blueprint submitted for review");
    res.status(result.status).json(result.body);
  } catch (err) {
    logger.error({ err }, "Ready growth blueprint failed");
    res.status(500).json({ error: "Failed to mark blueprint ready for review." });
  }
});

// ─── POST /api/growth-blueprints/:id/approve ─────────────────────
// ready_for_review → approved
// Also: locks sections, marks isCurrent=true, supersedes prior approved version.

router.post("/growth-blueprints/:id/approve", requireAuth, async (req, res) => {
  const userId = (req as any).user?.id as string;
  const id = String(req.params.id);
  try {
    const [blueprint] = await db
      .select()
      .from(growthBlueprintsTable)
      .where(eq(growthBlueprintsTable.id, id))
      .limit(1);

    if (!blueprint) return void res.status(404).json({ error: "Growth Blueprint not found." });
    if (blueprint.status !== "ready_for_review") {
      return void res.status(409).json({
        error: `Only ready_for_review blueprints can be approved. Current: ${blueprint.status}.`,
      });
    }
    if (blueprint.archivedAt) return void res.status(409).json({ error: "Cannot approve an archived blueprint." });

    const now = new Date();

    // Approve this blueprint
    const [approved] = await db
      .update(growthBlueprintsTable)
      .set({
        status: "approved",
        isCurrent: true,
        approvedBy: userId,
        approvedAt: now,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(growthBlueprintsTable.id, id))
      .returning();

    // Lock all sections
    await db
      .update(growthBlueprintSectionsTable)
      .set({ isLocked: true, updatedAt: now })
      .where(eq(growthBlueprintSectionsTable.blueprintId, id));

    // If this is a revision, supersede the prior approved version
    if (blueprint.previousVersionId) {
      await db
        .update(growthBlueprintsTable)
        .set({ isCurrent: false, supersededAt: now, updatedAt: now })
        .where(eq(growthBlueprintsTable.id, blueprint.previousVersionId));

      await logActivity({
        activityType: "GROWTH_BLUEPRINT.SUPERSEDED",
        description: `Prior blueprint version superseded by v${blueprint.version}.${blueprint.revisionNumber}`,
        actorUserId: userId,
        entityType: "growth_blueprint",
        entityId: blueprint.previousVersionId,
        metadata: { newBlueprintId: id },
      }).catch(() => {});
    }

    await logActivity({
      activityType: "GROWTH_BLUEPRINT.APPROVED",
      description: `Growth Blueprint "${blueprint.title}" approved`,
      actorUserId: userId,
      entityType: "growth_blueprint",
      entityId: id,
      metadata: { version: blueprint.version, revisionNumber: blueprint.revisionNumber },
    }).catch(() => {});

    res.json(approved);
  } catch (err) {
    logger.error({ err }, "Approve growth blueprint failed");
    res.status(500).json({ error: "Failed to approve growth blueprint." });
  }
});

// ─── POST /api/growth-blueprints/:id/archive ─────────────────────

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
    if (existing.archivedAt) return void res.status(409).json({ error: "Blueprint is already archived." });

    const [updated] = await db
      .update(growthBlueprintsTable)
      .set({
        status: "archived",
        isCurrent: false,
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
        revisionNumber: growthBlueprintsTable.revisionNumber,
        isCurrent: growthBlueprintsTable.isCurrent,
        generationStatus: growthBlueprintsTable.generationStatus,
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

router.get("/solution-recommendations/:id/growth-blueprint", requireAuth, async (req, res) => {
  try {
    const id = String(req.params.id);
    const [blueprint] = await db
      .select({
        id: growthBlueprintsTable.id,
        title: growthBlueprintsTable.title,
        status: growthBlueprintsTable.status,
        version: growthBlueprintsTable.version,
        revisionNumber: growthBlueprintsTable.revisionNumber,
        isCurrent: growthBlueprintsTable.isCurrent,
        generationStatus: growthBlueprintsTable.generationStatus,
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
    res.json({ ...blueprint, versionLabel: `Version ${blueprint.version}.${blueprint.revisionNumber}` });
  } catch (err) {
    logger.error({ err }, "Get blueprint for plan failed");
    res.status(500).json({ error: "Failed to get blueprint for plan." });
  }
});

export default router;
