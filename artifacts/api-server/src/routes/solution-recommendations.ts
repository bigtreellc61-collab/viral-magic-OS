import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  db,
  growthAssessmentsTable,
  diagnosticsTable,
  diagnosticVersionsTable,
  diagnosticScoresTable,
  clientsTable,
  projectsTable,
  solutionRecommendationPlansTable,
  solutionRecommendationsTable,
  solutionRecommendationActionsTable,
  solutionRecommendationDependenciesTable,
  activityRecordsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";
import {
  generateRecommendationPlan,
  type AssessmentScoreInput,
  type GenerationInput,
} from "../lib/solution-recommendation-engine";
import { getHealthRating } from "../lib/diagnostics-calc";
import type { GeneratedSections } from "../lib/growth-assessment-engine";

const router: IRouter = Router();

const PLAN_VALID_STATUSES = [
  "draft",
  "awaiting_review",
  "approved",
  "reopened",
  "superseded",
  "archived",
];

// ─── Helper: validate plan for approval ─────────────────────────

function validateForApproval(plan: any, recs: any[]): string | null {
  if (!recs.length) return "Plan must have at least one recommendation before approval.";
  if (!plan.executiveRecommendation && !plan.systemExecutiveRecommendation) {
    return "Plan must have an executive recommendation before approval.";
  }
  for (const r of recs) {
    if (!r.successMetric) {
      return `Recommendation "${r.title}" is missing a success metric.`;
    }
    const score = Number(r.priorityScore);
    if (score < 0 || score > 100) {
      return `Recommendation "${r.title}" has a score outside the allowed range (0–100).`;
    }
  }
  return null;
}

// ─── GET /api/solution-recommendations/dashboard ─────────────────
//
// Returns aggregated summary for the dashboard section.

router.get("/solution-recommendations/dashboard", requireAuth, async (req, res) => {
  try {
    // Status counts (exclude archived/superseded)
    const allActivePlans = await db
      .select({
        id: solutionRecommendationPlansTable.id,
        status: solutionRecommendationPlansTable.status,
        overallPriorityScore: solutionRecommendationPlansTable.overallPriorityScore,
        clientId: solutionRecommendationPlansTable.clientId,
        clientName: clientsTable.companyName,
        diagnosticName: diagnosticsTable.diagnosticName,
        createdAt: solutionRecommendationPlansTable.createdAt,
        updatedAt: solutionRecommendationPlansTable.updatedAt,
        approvedAt: solutionRecommendationPlansTable.approvedAt,
      })
      .from(solutionRecommendationPlansTable)
      .leftJoin(clientsTable, eq(solutionRecommendationPlansTable.clientId, clientsTable.id))
      .leftJoin(diagnosticsTable, eq(solutionRecommendationPlansTable.diagnosticId, diagnosticsTable.id))
      .where(isNull(solutionRecommendationPlansTable.archivedAt))
      .orderBy(desc(solutionRecommendationPlansTable.updatedAt));

    const draft = allActivePlans.filter((p) => p.status === "draft").length;
    const awaitingReview = allActivePlans.filter((p) => p.status === "awaiting_review").length;
    const approved = allActivePlans.filter((p) => p.status === "approved").length;

    // Critical-priority plans: overall score >= 80
    const criticalPlans = allActivePlans
      .filter((p) => Number(p.overallPriorityScore ?? 0) >= 80)
      .slice(0, 5);

    // Recent plans: 5 most recently updated
    const recentPlans = allActivePlans.slice(0, 5);

    res.json({ draft, awaitingReview, approved, criticalPlans, recentPlans });
  } catch (err) {
    logger.error({ err }, "Get solution recommendation dashboard failed");
    res.status(500).json({ error: "Failed to get solution recommendation dashboard." });
  }
});

// ─── POST /api/solution-recommendations/generate ─────────────────

router.post("/solution-recommendations/generate", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { growthAssessmentId } = req.body;

    if (!growthAssessmentId) {
      return void res.status(400).json({ error: "growthAssessmentId is required." });
    }

    // Load the growth assessment
    const [assessment] = await db
      .select()
      .from(growthAssessmentsTable)
      .where(eq(growthAssessmentsTable.id, growthAssessmentId))
      .limit(1);

    if (!assessment) {
      return void res.status(404).json({ error: "Growth assessment not found." });
    }

    if (assessment.status !== "approved") {
      return void res.status(400).json({
        error: `Solution Recommendation Plans can only be generated from approved Growth Assessments. Current status: ${assessment.status}.`,
      });
    }

    // Check for an existing active (non-archived) plan — reject if any exists
    const [existingPlan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(
        and(
          eq(solutionRecommendationPlansTable.growthAssessmentId, growthAssessmentId),
          isNull(solutionRecommendationPlansTable.archivedAt),
        ),
      )
      .limit(1);

    if (existingPlan) {
      return void res.status(409).json({
        error: `An active plan already exists for this assessment (status: ${existingPlan.status}). Use the regenerate endpoint to replace a Draft or Reopened plan.`,
        planId: existingPlan.id,
      });
    }

    // Load diagnostic scores
    const scoreRows = await db
      .select()
      .from(diagnosticScoresTable)
      .where(eq(diagnosticScoresTable.diagnosticVersionId, assessment.diagnosticVersionId));

    if (!scoreRows.length) {
      return void res.status(400).json({ error: "No diagnostic scores found for this assessment's version." });
    }

    const healthScore = Number(assessment.healthScore ?? 0);
    const healthRating = assessment.healthRating ?? getHealthRating(healthScore);

    const scores: AssessmentScoreInput[] = scoreRows.map((s) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      currentPerformance: Number(s.currentPerformance ?? 0),
      businessImpact: Number(s.businessImpact ?? 1),
      urgency: Number(s.urgency ?? 1),
      performanceGap: Number(s.performanceGap ?? 0),
      priorityScore: Number(s.priorityScore ?? 0),
      severity: (s.severity ?? "monitor") as string,
      evidence: s.evidence,
      observations: s.observations,
      recommendedAction: s.recommendedAction,
    }));

    const genInput: GenerationInput = {
      growthAssessmentId,
      diagnosticId: assessment.diagnosticId,
      diagnosticVersionId: assessment.diagnosticVersionId,
      clientId: assessment.clientId,
      projectId: assessment.projectId,
      healthScore,
      healthRating,
      generatedSections: (assessment.generatedSections as GeneratedSections | null),
      scores,
      createdByUserId: userId,
    };

    const result = generateRecommendationPlan(genInput);

    if (!result.recommendations.length) {
      return void res.status(400).json({
        error: "No recommendations could be generated from the assessment data. Ensure the assessment has scored categories.",
      });
    }

    // Transactional insert
    const plan = await db.transaction(async (tx) => {
      const [newPlan] = await tx
        .insert(solutionRecommendationPlansTable)
        .values({
          growthAssessmentId,
          diagnosticId: assessment.diagnosticId,
          diagnosticVersionId: assessment.diagnosticVersionId,
          clientId: assessment.clientId,
          projectId: assessment.projectId,
          status: "draft",
          overallPriorityScore: String(result.overallPriorityScore),
          systemExecutiveRecommendation: result.executiveRecommendation,
          executiveRecommendation: result.executiveRecommendation,
          systemBusinessImpactSummary: JSON.stringify(result.businessImpactSummary),
          businessImpactSummary: JSON.stringify(result.businessImpactSummary),
          systemDependencySummary: result.dependencySummary,
          dependencySummary: result.dependencySummary,
          generatedMetadata: result as any,
          recommendationEngineVersion: result.engineVersion,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // Insert recommendations + actions
      const insertedRecs: Array<{ id: string; categoryKey: string }> = [];
      for (const rec of result.recommendations) {
        const [newRec] = await tx
          .insert(solutionRecommendationsTable)
          .values({
            planId: newPlan.id,
            sourceCategoryKey: rec.sourceCategoryKey,
            sourceAssessmentData: rec.sourceAssessmentData as any,
            rank: rec.rank,
            title: rec.title,
            domain: rec.domain,
            problemStatement: rec.problemStatement,
            whyItMatters: rec.whyItMatters,
            recommendedOutcome: rec.recommendedOutcome,
            priorityScore: String(rec.priorityScore),
            priorityClassification: rec.priorityClassification,
            severityScore: String(rec.severityScore),
            businessImpactScore: String(rec.businessImpactScore),
            urgencyScore: String(rec.urgencyScore),
            performanceGapScore: String(rec.performanceGapScore),
            quickWinBonus: String(rec.quickWinBonus),
            dependencyBonus: String(rec.dependencyBonus),
            effortPenalty: String(rec.effortPenalty),
            quickWinFlag: rec.quickWinFlag,
            effort: rec.effort,
            confidence: String(rec.confidence),
            timeframe: rec.timeframe,
            suggestedOwner: rec.suggestedOwner,
            successMetric: rec.successMetric,
            dependencyNotes: rec.dependencyNotes,
            scoringExplanation: rec.scoringExplanation as any,
            sortOrder: rec.rank,
          })
          .returning();

        insertedRecs.push({ id: newRec.id, categoryKey: rec.sourceCategoryKey });

        // Insert actions
        for (const action of rec.actions) {
          await tx.insert(solutionRecommendationActionsTable).values({
            recommendationId: newRec.id,
            title: action.title,
            description: action.description,
            timeHorizon: action.timeHorizon,
            suggestedOwner: action.suggestedOwner,
            expectedOutcome: action.expectedOutcome,
            successMetric: action.successMetric,
            sortOrder: action.sortOrder,
          });
        }
      }

      // Insert dependency records (skipping if category not in top recs)
      for (const rec of result.recommendations) {
        const fromRec = insertedRecs.find((r) => r.categoryKey === rec.sourceCategoryKey);
        if (!fromRec) continue;

        for (const depKey of rec.dependencyRules) {
          const toRec = insertedRecs.find((r) => r.categoryKey === depKey);
          if (!toRec) continue;
          if (toRec.id === fromRec.id) continue; // self-dep safety

          await tx.insert(solutionRecommendationDependenciesTable).values({
            planId: newPlan.id,
            recommendationId: fromRec.id,
            dependsOnRecommendationId: toRec.id,
            dependencyType: "recommended",
            notes: `${rec.title} should be implemented after ${result.recommendations.find((r) => r.sourceCategoryKey === depKey)?.title ?? depKey}.`,
          });
        }
      }

      return newPlan;
    });

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.GENERATED",
      description: `Solution Recommendation Plan generated from Growth Assessment`,
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: plan.id,
      metadata: {
        growthAssessmentId,
        overallPriorityScore: result.overallPriorityScore,
        recommendationCount: result.recommendations.length,
      },
    }).catch(() => {});

    res.status(201).json({ plan, generated: true });
  } catch (err) {
    logger.error({ err }, "Generate solution recommendation plan failed");
    res.status(500).json({ error: "Failed to generate solution recommendation plan." });
  }
});

// ─── GET /api/solution-recommendations/:id ───────────────────────

router.get("/solution-recommendations/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [plan] = await db
      .select({
        id: solutionRecommendationPlansTable.id,
        growthAssessmentId: solutionRecommendationPlansTable.growthAssessmentId,
        diagnosticId: solutionRecommendationPlansTable.diagnosticId,
        diagnosticVersionId: solutionRecommendationPlansTable.diagnosticVersionId,
        clientId: solutionRecommendationPlansTable.clientId,
        projectId: solutionRecommendationPlansTable.projectId,
        status: solutionRecommendationPlansTable.status,
        overallPriorityScore: solutionRecommendationPlansTable.overallPriorityScore,
        systemExecutiveRecommendation: solutionRecommendationPlansTable.systemExecutiveRecommendation,
        executiveRecommendation: solutionRecommendationPlansTable.executiveRecommendation,
        systemBusinessImpactSummary: solutionRecommendationPlansTable.systemBusinessImpactSummary,
        businessImpactSummary: solutionRecommendationPlansTable.businessImpactSummary,
        systemDependencySummary: solutionRecommendationPlansTable.systemDependencySummary,
        dependencySummary: solutionRecommendationPlansTable.dependencySummary,
        consultantNotes: solutionRecommendationPlansTable.consultantNotes,
        recommendationEngineVersion: solutionRecommendationPlansTable.recommendationEngineVersion,
        reviewedBy: solutionRecommendationPlansTable.reviewedBy,
        reviewedAt: solutionRecommendationPlansTable.reviewedAt,
        approvedBy: solutionRecommendationPlansTable.approvedBy,
        approvedAt: solutionRecommendationPlansTable.approvedAt,
        reopenedBy: solutionRecommendationPlansTable.reopenedBy,
        reopenedAt: solutionRecommendationPlansTable.reopenedAt,
        archivedAt: solutionRecommendationPlansTable.archivedAt,
        createdBy: solutionRecommendationPlansTable.createdBy,
        updatedBy: solutionRecommendationPlansTable.updatedBy,
        createdAt: solutionRecommendationPlansTable.createdAt,
        updatedAt: solutionRecommendationPlansTable.updatedAt,
        clientName: clientsTable.companyName,
        diagnosticName: diagnosticsTable.diagnosticName,
        projectName: projectsTable.projectName,
      })
      .from(solutionRecommendationPlansTable)
      .leftJoin(clientsTable, eq(solutionRecommendationPlansTable.clientId, clientsTable.id))
      .leftJoin(diagnosticsTable, eq(solutionRecommendationPlansTable.diagnosticId, diagnosticsTable.id))
      .leftJoin(projectsTable, eq(solutionRecommendationPlansTable.projectId, projectsTable.id))
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Solution recommendation plan not found." });

    // Load recommendations
    const recommendations = await db
      .select()
      .from(solutionRecommendationsTable)
      .where(eq(solutionRecommendationsTable.planId, id))
      .orderBy(solutionRecommendationsTable.rank);

    // Load actions for each recommendation
    const recIds = recommendations.map((r) => r.id);
    let actions: any[] = [];
    if (recIds.length) {
      const { inArray } = await import("drizzle-orm");
      actions = await db
        .select()
        .from(solutionRecommendationActionsTable)
        .where(inArray(solutionRecommendationActionsTable.recommendationId, recIds))
        .orderBy(solutionRecommendationActionsTable.sortOrder);
    }

    // Load dependencies
    const dependencies = await db
      .select()
      .from(solutionRecommendationDependenciesTable)
      .where(eq(solutionRecommendationDependenciesTable.planId, id));

    // Attach actions to recommendations
    const recsWithActions = recommendations.map((r) => ({
      ...r,
      actions: actions.filter((a) => a.recommendationId === r.id),
    }));

    res.json({ ...plan, recommendations: recsWithActions, dependencies });
  } catch (err) {
    logger.error({ err }, "Get solution recommendation plan failed");
    res.status(500).json({ error: "Failed to get plan." });
  }
});

// ─── PATCH /api/solution-recommendations/:id ─────────────────────

router.patch("/solution-recommendations/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { executiveRecommendation, businessImpactSummary, dependencySummary, consultantNotes } = req.body;

    const [existing] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!existing) return void res.status(404).json({ error: "Plan not found." });
    if (!["draft", "reopened"].includes(existing.status)) {
      return void res.status(409).json({ error: `Cannot edit a plan with status "${existing.status}". Only Draft or Reopened plans are editable.` });
    }
    if (existing.archivedAt) {
      return void res.status(409).json({ error: "Cannot edit an archived plan." });
    }

    const [updated] = await db
      .update(solutionRecommendationPlansTable)
      .set({
        executiveRecommendation: executiveRecommendation ?? existing.executiveRecommendation,
        businessImpactSummary: businessImpactSummary ?? existing.businessImpactSummary,
        dependencySummary: dependencySummary ?? existing.dependencySummary,
        consultantNotes: consultantNotes ?? existing.consultantNotes,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(solutionRecommendationPlansTable.id, id))
      .returning();

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.DRAFT_SAVED",
      description: "Solution Recommendation Plan draft saved",
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: id,
      metadata: { growthAssessmentId: existing.growthAssessmentId },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update solution recommendation plan failed");
    res.status(500).json({ error: "Failed to update plan." });
  }
});

// ─── PATCH /api/solution-recommendations/:id/recommendations/:recId ──
//
// Updates administrator-editable fields on a single recommendation.
// Only permitted when the parent plan is Draft or Reopened.

router.patch("/solution-recommendations/:id/recommendations/:recId", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id, recId } = req.params;
    const { adminNotes } = req.body;

    // Verify the parent plan exists and is editable
    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Plan not found." });
    if (!["draft", "reopened"].includes(plan.status)) {
      return void res.status(409).json({
        error: `Cannot edit recommendations on a plan with status "${plan.status}". Only Draft or Reopened plans are editable.`,
      });
    }
    if (plan.archivedAt) {
      return void res.status(409).json({ error: "Cannot edit an archived plan." });
    }

    // Verify the recommendation belongs to this plan
    const [rec] = await db
      .select()
      .from(solutionRecommendationsTable)
      .where(
        and(
          eq(solutionRecommendationsTable.id, recId),
          eq(solutionRecommendationsTable.planId, id),
        ),
      )
      .limit(1);

    if (!rec) return void res.status(404).json({ error: "Recommendation not found in this plan." });

    const [updated] = await db
      .update(solutionRecommendationsTable)
      .set({
        adminNotes: adminNotes !== undefined ? adminNotes : rec.adminNotes,
        updatedAt: new Date(),
      })
      .where(eq(solutionRecommendationsTable.id, recId))
      .returning();

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.RECOMMENDATION_EDITED",
      description: `Administrator notes updated on recommendation "${rec.title}"`,
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: id,
      metadata: { recommendationId: recId, recommendationTitle: rec.title },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update solution recommendation failed");
    res.status(500).json({ error: "Failed to update recommendation." });
  }
});

// ─── GET /api/growth-assessments/:id/solution-recommendation ─────

router.get("/growth-assessments/:id/solution-recommendation", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [plan] = await db
      .select({
        id: solutionRecommendationPlansTable.id,
        status: solutionRecommendationPlansTable.status,
        overallPriorityScore: solutionRecommendationPlansTable.overallPriorityScore,
        executiveRecommendation: solutionRecommendationPlansTable.executiveRecommendation,
        systemExecutiveRecommendation: solutionRecommendationPlansTable.systemExecutiveRecommendation,
        createdAt: solutionRecommendationPlansTable.createdAt,
        updatedAt: solutionRecommendationPlansTable.updatedAt,
        approvedAt: solutionRecommendationPlansTable.approvedAt,
      })
      .from(solutionRecommendationPlansTable)
      .where(
        and(
          eq(solutionRecommendationPlansTable.growthAssessmentId, id),
          isNull(solutionRecommendationPlansTable.archivedAt),
        ),
      )
      .orderBy(desc(solutionRecommendationPlansTable.createdAt))
      .limit(1);

    if (!plan) return void res.json(null);
    res.json(plan);
  } catch (err) {
    logger.error({ err }, "Get solution recommendation for assessment failed");
    res.status(500).json({ error: "Failed to get solution recommendation." });
  }
});

// ─── GET /api/clients/:id/latest-solution-recommendation ─────────

router.get("/clients/:id/latest-solution-recommendation", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [plan] = await db
      .select({
        id: solutionRecommendationPlansTable.id,
        status: solutionRecommendationPlansTable.status,
        overallPriorityScore: solutionRecommendationPlansTable.overallPriorityScore,
        executiveRecommendation: solutionRecommendationPlansTable.executiveRecommendation,
        systemExecutiveRecommendation: solutionRecommendationPlansTable.systemExecutiveRecommendation,
        createdAt: solutionRecommendationPlansTable.createdAt,
        updatedAt: solutionRecommendationPlansTable.updatedAt,
        approvedAt: solutionRecommendationPlansTable.approvedAt,
        growthAssessmentId: solutionRecommendationPlansTable.growthAssessmentId,
      })
      .from(solutionRecommendationPlansTable)
      .where(
        and(
          eq(solutionRecommendationPlansTable.clientId, id),
          isNull(solutionRecommendationPlansTable.archivedAt),
        ),
      )
      .orderBy(desc(solutionRecommendationPlansTable.updatedAt))
      .limit(1);

    if (!plan) return void res.json(null);
    res.json(plan);
  } catch (err) {
    logger.error({ err }, "Get latest solution recommendation for client failed");
    res.status(500).json({ error: "Failed to get latest solution recommendation." });
  }
});

// ─── GET /api/projects/:id/solution-recommendations ──────────────

router.get("/projects/:id/solution-recommendations", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const plans = await db
      .select({
        id: solutionRecommendationPlansTable.id,
        status: solutionRecommendationPlansTable.status,
        overallPriorityScore: solutionRecommendationPlansTable.overallPriorityScore,
        executiveRecommendation: solutionRecommendationPlansTable.executiveRecommendation,
        systemExecutiveRecommendation: solutionRecommendationPlansTable.systemExecutiveRecommendation,
        createdAt: solutionRecommendationPlansTable.createdAt,
        updatedAt: solutionRecommendationPlansTable.updatedAt,
        approvedAt: solutionRecommendationPlansTable.approvedAt,
        growthAssessmentId: solutionRecommendationPlansTable.growthAssessmentId,
      })
      .from(solutionRecommendationPlansTable)
      .where(
        and(
          eq(solutionRecommendationPlansTable.projectId, id),
          isNull(solutionRecommendationPlansTable.archivedAt),
        ),
      )
      .orderBy(desc(solutionRecommendationPlansTable.updatedAt));

    res.json({ data: plans });
  } catch (err) {
    logger.error({ err }, "List solution recommendations for project failed");
    res.status(500).json({ error: "Failed to list solution recommendations." });
  }
});

// ─── POST /api/solution-recommendations/:id/submit ───────────────

router.post("/solution-recommendations/:id/submit", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Plan not found." });
    if (!["draft", "reopened"].includes(plan.status)) {
      return void res.status(409).json({ error: `Only Draft or Reopened plans can be submitted. Current status: ${plan.status}.` });
    }

    const [updated] = await db
      .update(solutionRecommendationPlansTable)
      .set({
        status: "awaiting_review",
        reviewedBy: userId,
        reviewedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(solutionRecommendationPlansTable.id, id))
      .returning();

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.SUBMITTED",
      description: "Solution Recommendation Plan submitted for review",
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: id,
      metadata: { growthAssessmentId: plan.growthAssessmentId },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Submit solution recommendation plan failed");
    res.status(500).json({ error: "Failed to submit plan." });
  }
});

// ─── POST /api/solution-recommendations/:id/approve ──────────────

router.post("/solution-recommendations/:id/approve", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Plan not found." });
    if (plan.status !== "awaiting_review") {
      return void res.status(409).json({ error: `Only plans awaiting review can be approved. Current status: ${plan.status}.` });
    }

    // Validate approval requirements
    const recs = await db
      .select()
      .from(solutionRecommendationsTable)
      .where(eq(solutionRecommendationsTable.planId, id));

    const validationError = validateForApproval(plan, recs);
    if (validationError) {
      return void res.status(400).json({ error: validationError });
    }

    const [updated] = await db
      .update(solutionRecommendationPlansTable)
      .set({
        status: "approved",
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(solutionRecommendationPlansTable.id, id))
      .returning();

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.APPROVED",
      description: "Solution Recommendation Plan approved",
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: id,
      metadata: { growthAssessmentId: plan.growthAssessmentId },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Approve solution recommendation plan failed");
    res.status(500).json({ error: "Failed to approve plan." });
  }
});

// ─── POST /api/solution-recommendations/:id/reopen ───────────────

router.post("/solution-recommendations/:id/reopen", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Plan not found." });
    if (!["awaiting_review", "approved"].includes(plan.status)) {
      return void res.status(409).json({ error: `Only plans in awaiting_review or approved status can be reopened. Current status: ${plan.status}.` });
    }

    const [updated] = await db
      .update(solutionRecommendationPlansTable)
      .set({
        status: "reopened",
        reopenedBy: userId,
        reopenedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(solutionRecommendationPlansTable.id, id))
      .returning();

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.REOPENED",
      description: "Solution Recommendation Plan reopened for editing",
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: id,
      metadata: { growthAssessmentId: plan.growthAssessmentId, previousStatus: plan.status },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Reopen solution recommendation plan failed");
    res.status(500).json({ error: "Failed to reopen plan." });
  }
});

// ─── POST /api/solution-recommendations/:id/archive ──────────────

router.post("/solution-recommendations/:id/archive", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Plan not found." });
    if (plan.archivedAt) return void res.status(409).json({ error: "Plan is already archived." });

    const [updated] = await db
      .update(solutionRecommendationPlansTable)
      .set({
        status: "archived",
        archivedAt: new Date(),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(solutionRecommendationPlansTable.id, id))
      .returning();

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.ARCHIVED",
      description: "Solution Recommendation Plan archived",
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: id,
      metadata: { growthAssessmentId: plan.growthAssessmentId, previousStatus: plan.status },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Archive solution recommendation plan failed");
    res.status(500).json({ error: "Failed to archive plan." });
  }
});

// ─── POST /api/solution-recommendations/:id/regenerate ───────────
//
// Fully atomic: validate everything BEFORE writing to the DB, then
// supersede the old plan + create the new plan in one transaction.
// If any step fails, the old plan remains unchanged.

router.post("/solution-recommendations/:id/regenerate", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    // ── 1. Load and validate the current plan (no DB writes yet) ──
    const [plan] = await db
      .select()
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Plan not found." });
    if (!["draft", "reopened"].includes(plan.status)) {
      return void res.status(409).json({
        error: `Only Draft or Reopened plans can be regenerated. Current status: ${plan.status}.`,
      });
    }

    // ── 2. Validate source data before touching anything ──────────
    const [assessment] = await db
      .select()
      .from(growthAssessmentsTable)
      .where(eq(growthAssessmentsTable.id, plan.growthAssessmentId))
      .limit(1);

    if (!assessment || assessment.status !== "approved") {
      return void res.status(400).json({
        error: "The associated Growth Assessment is no longer approved. Cannot regenerate.",
      });
    }

    const scoreRows = await db
      .select()
      .from(diagnosticScoresTable)
      .where(eq(diagnosticScoresTable.diagnosticVersionId, assessment.diagnosticVersionId));

    if (!scoreRows.length) {
      return void res.status(400).json({
        error: "No diagnostic scores found for this assessment's version. Cannot regenerate.",
      });
    }

    // ── 3. Run the generation engine (pure, no DB writes) ─────────
    const healthScore = Number(assessment.healthScore ?? 0);
    const healthRating = assessment.healthRating ?? getHealthRating(healthScore);

    const scores: AssessmentScoreInput[] = scoreRows.map((s) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      currentPerformance: Number(s.currentPerformance ?? 0),
      businessImpact: Number(s.businessImpact ?? 1),
      urgency: Number(s.urgency ?? 1),
      performanceGap: Number(s.performanceGap ?? 0),
      priorityScore: Number(s.priorityScore ?? 0),
      severity: (s.severity ?? "monitor") as string,
      evidence: s.evidence,
      observations: s.observations,
      recommendedAction: s.recommendedAction,
    }));

    const result = generateRecommendationPlan({
      growthAssessmentId: plan.growthAssessmentId,
      diagnosticId: assessment.diagnosticId,
      diagnosticVersionId: assessment.diagnosticVersionId,
      clientId: assessment.clientId,
      projectId: assessment.projectId,
      healthScore,
      healthRating,
      generatedSections: (assessment.generatedSections as GeneratedSections | null),
      scores,
      createdByUserId: userId,
    });

    if (!result.recommendations.length) {
      return void res.status(400).json({
        error: "No recommendations could be generated from the assessment data.",
      });
    }

    // ── 4. Atomic transaction: supersede old plan + create new ────
    //    If anything inside fails, the old plan is NOT superseded.
    const newPlan = await db.transaction(async (tx) => {
      // Mark old plan as superseded (not archived — supersede is a
      // specific status meaning "replaced by regeneration")
      await tx
        .update(solutionRecommendationPlansTable)
        .set({ status: "superseded", archivedAt: new Date(), updatedAt: new Date(), updatedBy: userId })
        .where(eq(solutionRecommendationPlansTable.id, id));

      // Create the replacement plan
      const [np] = await tx
        .insert(solutionRecommendationPlansTable)
        .values({
          growthAssessmentId: plan.growthAssessmentId,
          diagnosticId: assessment.diagnosticId,
          diagnosticVersionId: assessment.diagnosticVersionId,
          clientId: assessment.clientId,
          projectId: assessment.projectId,
          status: "draft",
          overallPriorityScore: String(result.overallPriorityScore),
          systemExecutiveRecommendation: result.executiveRecommendation,
          executiveRecommendation: result.executiveRecommendation,
          systemBusinessImpactSummary: JSON.stringify(result.businessImpactSummary),
          businessImpactSummary: JSON.stringify(result.businessImpactSummary),
          systemDependencySummary: result.dependencySummary,
          dependencySummary: result.dependencySummary,
          generatedMetadata: result as any,
          recommendationEngineVersion: result.engineVersion,
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      const insertedRecs: Array<{ id: string; categoryKey: string }> = [];
      for (const rec of result.recommendations) {
        const [newRec] = await tx
          .insert(solutionRecommendationsTable)
          .values({
            planId: np.id,
            sourceCategoryKey: rec.sourceCategoryKey,
            sourceAssessmentData: rec.sourceAssessmentData as any,
            rank: rec.rank,
            title: rec.title,
            domain: rec.domain,
            problemStatement: rec.problemStatement,
            whyItMatters: rec.whyItMatters,
            recommendedOutcome: rec.recommendedOutcome,
            priorityScore: String(rec.priorityScore),
            priorityClassification: rec.priorityClassification,
            severityScore: String(rec.severityScore),
            businessImpactScore: String(rec.businessImpactScore),
            urgencyScore: String(rec.urgencyScore),
            performanceGapScore: String(rec.performanceGapScore),
            quickWinBonus: String(rec.quickWinBonus),
            dependencyBonus: String(rec.dependencyBonus),
            effortPenalty: String(rec.effortPenalty),
            quickWinFlag: rec.quickWinFlag,
            effort: rec.effort,
            confidence: String(rec.confidence),
            timeframe: rec.timeframe,
            suggestedOwner: rec.suggestedOwner,
            successMetric: rec.successMetric,
            dependencyNotes: rec.dependencyNotes,
            scoringExplanation: rec.scoringExplanation as any,
            sortOrder: rec.rank,
          })
          .returning();

        insertedRecs.push({ id: newRec.id, categoryKey: rec.sourceCategoryKey });

        for (const action of rec.actions) {
          await tx.insert(solutionRecommendationActionsTable).values({
            recommendationId: newRec.id,
            title: action.title,
            description: action.description,
            timeHorizon: action.timeHorizon,
            suggestedOwner: action.suggestedOwner,
            expectedOutcome: action.expectedOutcome,
            successMetric: action.successMetric,
            sortOrder: action.sortOrder,
          });
        }
      }

      for (const rec of result.recommendations) {
        const fromRec = insertedRecs.find((r) => r.categoryKey === rec.sourceCategoryKey);
        if (!fromRec) continue;
        for (const depKey of rec.dependencyRules) {
          const toRec = insertedRecs.find((r) => r.categoryKey === depKey);
          if (!toRec || toRec.id === fromRec.id) continue;
          await tx.insert(solutionRecommendationDependenciesTable).values({
            planId: np.id,
            recommendationId: fromRec.id,
            dependsOnRecommendationId: toRec.id,
            dependencyType: "recommended",
            notes: `Should be implemented after the prerequisite recommendation.`,
          });
        }
      }

      return np;
    });

    await logActivity({
      activityType: "SOLUTION_RECOMMENDATION_PLAN.REGENERATED",
      description: "Solution Recommendation Plan regenerated (previous plan superseded)",
      actorUserId: userId,
      entityType: "solution_recommendation_plan",
      entityId: newPlan.id,
      metadata: {
        growthAssessmentId: plan.growthAssessmentId,
        supersededPlanId: id,
        overallPriorityScore: result.overallPriorityScore,
        recommendationCount: result.recommendations.length,
      },
    }).catch(() => {});

    res.status(201).json({ plan: newPlan, generated: true });
  } catch (err) {
    logger.error({ err }, "Regenerate solution recommendation plan failed");
    res.status(500).json({ error: "Failed to regenerate plan." });
  }
});

// ─── GET /api/solution-recommendations/:id/activity ──────────────

router.get("/solution-recommendations/:id/activity", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);

    const [plan] = await db
      .select({ id: solutionRecommendationPlansTable.id })
      .from(solutionRecommendationPlansTable)
      .where(eq(solutionRecommendationPlansTable.id, id))
      .limit(1);

    if (!plan) return void res.status(404).json({ error: "Plan not found." });

    const records = await db
      .select()
      .from(activityRecordsTable)
      .where(
        and(
          eq(activityRecordsTable.entityType, "solution_recommendation_plan"),
          eq(activityRecordsTable.entityId, id),
        ),
      )
      .orderBy(desc(activityRecordsTable.createdAt))
      .limit(limit);

    res.json({ data: records });
  } catch (err) {
    logger.error({ err }, "Get plan activity failed");
    res.status(500).json({ error: "Failed to get plan activity." });
  }
});

export default router;
