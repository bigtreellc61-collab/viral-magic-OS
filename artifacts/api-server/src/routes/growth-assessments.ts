import { Router, type IRouter } from "express";
import { and, desc, eq, isNull, inArray, sql } from "drizzle-orm";
import {
  db, growthAssessmentsTable, diagnosticsTable, diagnosticVersionsTable,
  diagnosticScoresTable, clientsTable, projectsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";
import {
  generateAssessmentSections,
  buildStrengthSummary, buildVulnerabilitySummary, buildRiskSummary,
  buildGrowthOpportunitySummary, buildQuickWinSummary, buildStrategicFocusSummary,
  type ScoreInput,
} from "../lib/growth-assessment-engine";
import { getHealthRating } from "../lib/diagnostics-calc";

const router: IRouter = Router();

const VALID_STATUSES = ["draft", "awaiting_review", "approved", "superseded", "archived"];
const VALID_ACTIONS = ["submit", "approve", "reopen", "archive", "restore"];

// ─── Dashboard: growth assessment summary ───────────────────

router.get("/dashboard/growth-assessments", requireAuth, async (_req, res) => {
  try {
    const [awaitingRow, approvedRow] = await Promise.all([
      db.select({ count: sql<number>`count(*)` })
        .from(growthAssessmentsTable)
        .where(and(isNull(growthAssessmentsTable.archivedAt), eq(growthAssessmentsTable.status, "awaiting_review"))),
      db.select({ count: sql<number>`count(*)` })
        .from(growthAssessmentsTable)
        .where(and(isNull(growthAssessmentsTable.archivedAt), eq(growthAssessmentsTable.status, "approved"))),
    ]);

    // At-risk and critical clients based on latest diagnostic health rating
    const atRiskClients = await db
      .select({ clientId: diagnosticsTable.clientId, clientName: clientsTable.companyName, overallHealthScore: diagnosticsTable.overallHealthScore, updatedAt: diagnosticsTable.updatedAt })
      .from(diagnosticsTable)
      .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
      .where(and(isNull(diagnosticsTable.archivedAt), inArray(diagnosticsTable.status, ["completed", "approved", "awaiting_review"])))
      .orderBy(desc(diagnosticsTable.updatedAt))
      .limit(50);

    const atRisk: typeof atRiskClients = [];
    const critical: typeof atRiskClients = [];
    const seen = new Set<string>();
    for (const row of atRiskClients) {
      if (seen.has(row.clientId)) continue;
      seen.add(row.clientId);
      const score = row.overallHealthScore ? Number(row.overallHealthScore) : null;
      if (score == null) continue;
      const rating = getHealthRating(score);
      if (rating === "critical") critical.push(row);
      else if (rating === "at_risk") atRisk.push(row);
    }

    // Recent growth assessments
    const recentAssessments = await db
      .select({
        id: growthAssessmentsTable.id,
        status: growthAssessmentsTable.status,
        healthScore: growthAssessmentsTable.healthScore,
        healthRating: growthAssessmentsTable.healthRating,
        clientId: growthAssessmentsTable.clientId,
        clientName: clientsTable.companyName,
        diagnosticId: growthAssessmentsTable.diagnosticId,
        diagnosticName: diagnosticsTable.diagnosticName,
        createdAt: growthAssessmentsTable.createdAt,
        updatedAt: growthAssessmentsTable.updatedAt,
        approvedAt: growthAssessmentsTable.approvedAt,
      })
      .from(growthAssessmentsTable)
      .leftJoin(clientsTable, eq(growthAssessmentsTable.clientId, clientsTable.id))
      .leftJoin(diagnosticsTable, eq(growthAssessmentsTable.diagnosticId, diagnosticsTable.id))
      .where(isNull(growthAssessmentsTable.archivedAt))
      .orderBy(desc(growthAssessmentsTable.updatedAt))
      .limit(10);

    res.json({
      awaitingReview: Number(awaitingRow[0]?.count ?? 0),
      approved: Number(approvedRow[0]?.count ?? 0),
      atRiskClients: atRisk.slice(0, 10),
      criticalClients: critical.slice(0, 10),
      recentAssessments,
    });
  } catch (err) {
    logger.error({ err }, "Dashboard growth assessments failed");
    res.status(500).json({ error: "Failed to load growth assessment dashboard." });
  }
});

// ─── List growth assessments ────────────────────────────────

router.get("/growth-assessments", requireAuth, async (req, res) => {
  try {
    const { diagnosticId, clientId, status, showArchived = "false" } = req.query as Record<string, string>;
    const conditions: any[] = [];
    if (showArchived === "true") {
      // include archived — no archivedAt filter
    } else {
      conditions.push(isNull(growthAssessmentsTable.archivedAt));
    }
    if (diagnosticId) conditions.push(eq(growthAssessmentsTable.diagnosticId, diagnosticId));
    if (clientId) conditions.push(eq(growthAssessmentsTable.clientId, clientId));
    if (status) conditions.push(eq(growthAssessmentsTable.status, status));

    const rows = await db
      .select({
        id: growthAssessmentsTable.id,
        diagnosticId: growthAssessmentsTable.diagnosticId,
        diagnosticVersionId: growthAssessmentsTable.diagnosticVersionId,
        clientId: growthAssessmentsTable.clientId,
        projectId: growthAssessmentsTable.projectId,
        status: growthAssessmentsTable.status,
        healthScore: growthAssessmentsTable.healthScore,
        healthRating: growthAssessmentsTable.healthRating,
        consultantNotes: growthAssessmentsTable.consultantNotes,
        reviewedAt: growthAssessmentsTable.reviewedAt,
        approvedAt: growthAssessmentsTable.approvedAt,
        archivedAt: growthAssessmentsTable.archivedAt,
        createdAt: growthAssessmentsTable.createdAt,
        updatedAt: growthAssessmentsTable.updatedAt,
        clientName: clientsTable.companyName,
        diagnosticName: diagnosticsTable.diagnosticName,
        versionNumber: diagnosticVersionsTable.versionNumber,
      })
      .from(growthAssessmentsTable)
      .leftJoin(clientsTable, eq(growthAssessmentsTable.clientId, clientsTable.id))
      .leftJoin(diagnosticsTable, eq(growthAssessmentsTable.diagnosticId, diagnosticsTable.id))
      .leftJoin(diagnosticVersionsTable, eq(growthAssessmentsTable.diagnosticVersionId, diagnosticVersionsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(growthAssessmentsTable.updatedAt))
      .limit(100);

    res.json({ data: rows });
  } catch (err) {
    logger.error({ err }, "List growth assessments failed");
    res.status(500).json({ error: "Failed to list growth assessments." });
  }
});

// ─── Generate / create assessment ───────────────────────────

router.post("/growth-assessments/generate", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { diagnosticId, diagnosticVersionId } = req.body;

    if (!diagnosticId || !diagnosticVersionId) {
      return void res.status(400).json({ error: "diagnosticId and diagnosticVersionId are required." });
    }

    // Validate diagnostic exists and is completed
    const [diagnostic] = await db.select().from(diagnosticsTable).where(eq(diagnosticsTable.id, diagnosticId)).limit(1);
    if (!diagnostic) return void res.status(404).json({ error: "Diagnostic not found." });
    if (!["completed", "awaiting_review", "approved"].includes(diagnostic.status)) {
      return void res.status(400).json({ error: "Assessment can only be generated from a completed diagnostic." });
    }

    // Validate version
    const [version] = await db.select().from(diagnosticVersionsTable)
      .where(and(eq(diagnosticVersionsTable.id, diagnosticVersionId), eq(diagnosticVersionsTable.diagnosticId, diagnosticId)))
      .limit(1);
    if (!version) return void res.status(404).json({ error: "Diagnostic version not found." });

    // Check if a non-archived assessment already exists for this version
    const existing = await db.select().from(growthAssessmentsTable)
      .where(and(
        eq(growthAssessmentsTable.diagnosticVersionId, diagnosticVersionId),
        isNull(growthAssessmentsTable.archivedAt),
      ))
      .limit(1);
    if (existing[0]) {
      return void res.json({ assessment: existing[0], generated: false });
    }

    // Load scores for this version
    const scoreRows = await db.select().from(diagnosticScoresTable)
      .where(eq(diagnosticScoresTable.diagnosticVersionId, diagnosticVersionId));

    if (scoreRows.length === 0) {
      return void res.status(400).json({ error: "No scores found for this diagnostic version." });
    }

    const scores: ScoreInput[] = scoreRows.map((s) => ({
      categoryKey: s.categoryKey,
      categoryLabel: s.categoryLabel,
      categoryDescription: s.categoryDescription,
      currentPerformance: Number(s.currentPerformance ?? 0),
      businessImpact: Number(s.businessImpact ?? 1),
      urgency: Number(s.urgency ?? 1),
      priorityScore: Number(s.priorityScore ?? 0),
      severity: (s.severity ?? "monitor") as any,
      evidence: s.evidence,
      observations: s.observations,
      recommendedAction: s.recommendedAction,
      resolutionStatus: s.resolutionStatus,
    }));

    const healthScore = Number(version.overallHealthScore ?? diagnostic.overallHealthScore ?? 0);
    const healthRating = getHealthRating(healthScore);

    // Generate interpretation
    const sections = generateAssessmentSections(scores, healthScore, healthRating);

    // Build summary texts
    const systemStrengthSummary = buildStrengthSummary(sections.strengths);
    const systemVulnerabilitySummary = buildVulnerabilitySummary(sections.vulnerabilities);
    const systemRiskSummary = buildRiskSummary(sections.risks);
    const systemGrowthOpportunitySummary = buildGrowthOpportunitySummary(sections.growthOpportunities);
    const systemQuickWinSummary = buildQuickWinSummary(sections.quickWins);
    const systemStrategicFocusSummary = buildStrategicFocusSummary(sections.strategicPriorities, healthRating);

    // Insert
    const [assessment] = await db.insert(growthAssessmentsTable).values({
      diagnosticId,
      diagnosticVersionId,
      clientId: diagnostic.clientId,
      projectId: diagnostic.projectId,
      status: "draft",
      healthScore: String(healthScore),
      healthRating,
      systemStrengthSummary,
      systemVulnerabilitySummary,
      systemRiskSummary,
      systemGrowthOpportunitySummary,
      systemQuickWinSummary,
      systemStrategicFocusSummary,
      strengthSummary: systemStrengthSummary,
      vulnerabilitySummary: systemVulnerabilitySummary,
      riskSummary: systemRiskSummary,
      growthOpportunitySummary: systemGrowthOpportunitySummary,
      quickWinSummary: systemQuickWinSummary,
      strategicFocusSummary: systemStrategicFocusSummary,
      generatedSections: sections as any,
      createdBy: userId,
      updatedBy: userId,
    }).returning();

    await logActivity({
      activityType: "GROWTH_ASSESSMENT.CREATED",
      description: `Growth Assessment generated for "${diagnostic.diagnosticName}"`,
      actorUserId: userId,
      entityType: "growth_assessment",
      entityId: assessment.id,
      metadata: { diagnosticId, diagnosticVersionId, healthScore, healthRating },
    }).catch(() => {});

    res.status(201).json({ assessment, generated: true });
  } catch (err) {
    logger.error({ err }, "Generate growth assessment failed");
    res.status(500).json({ error: "Failed to generate assessment." });
  }
});

// ─── Latest assessment for a client ─────────────────────────
// Returns the most-recently-updated non-archived assessment for a client,
// with extracted top-section highlights for overview panels.

router.get("/growth-assessments/client/:clientId/latest", requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const [row] = await db
      .select({
        id: growthAssessmentsTable.id,
        diagnosticId: growthAssessmentsTable.diagnosticId,
        clientId: growthAssessmentsTable.clientId,
        projectId: growthAssessmentsTable.projectId,
        status: growthAssessmentsTable.status,
        healthScore: growthAssessmentsTable.healthScore,
        healthRating: growthAssessmentsTable.healthRating,
        riskSummary: growthAssessmentsTable.riskSummary,
        growthOpportunitySummary: growthAssessmentsTable.growthOpportunitySummary,
        quickWinSummary: growthAssessmentsTable.quickWinSummary,
        generatedSections: growthAssessmentsTable.generatedSections,
        approvedAt: growthAssessmentsTable.approvedAt,
        updatedAt: growthAssessmentsTable.updatedAt,
        diagnosticName: diagnosticsTable.diagnosticName,
      })
      .from(growthAssessmentsTable)
      .leftJoin(diagnosticsTable, eq(growthAssessmentsTable.diagnosticId, diagnosticsTable.id))
      .where(and(
        eq(growthAssessmentsTable.clientId, clientId),
        isNull(growthAssessmentsTable.archivedAt),
      ))
      .orderBy(desc(growthAssessmentsTable.updatedAt))
      .limit(1);

    if (!row) return void res.json(null);

    const sections = row.generatedSections as any;
    const topRisks: any[] = (sections?.risks ?? []).slice(0, 3);
    const topOpportunities: any[] = (sections?.growthOpportunities ?? []).slice(0, 3);
    const topQuickWin: any = (sections?.quickWins ?? [])[0] ?? null;

    res.json({ ...row, generatedSections: undefined, topRisks, topOpportunities, topQuickWin });
  } catch (err) {
    logger.error({ err }, "Get latest client assessment failed");
    res.status(500).json({ error: "Failed to get latest client assessment." });
  }
});

// ─── Slim summary for a specific diagnostic ──────────────────
// Used by project-detail diagnostics tab to show per-diagnostic highlights.

router.get("/growth-assessments/diagnostic/:diagnosticId/summary", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params;
    const [row] = await db
      .select({
        id: growthAssessmentsTable.id,
        diagnosticId: growthAssessmentsTable.diagnosticId,
        status: growthAssessmentsTable.status,
        healthScore: growthAssessmentsTable.healthScore,
        healthRating: growthAssessmentsTable.healthRating,
        generatedSections: growthAssessmentsTable.generatedSections,
        updatedAt: growthAssessmentsTable.updatedAt,
      })
      .from(growthAssessmentsTable)
      .where(and(
        eq(growthAssessmentsTable.diagnosticId, diagnosticId),
        isNull(growthAssessmentsTable.archivedAt),
      ))
      .orderBy(desc(growthAssessmentsTable.updatedAt))
      .limit(1);

    if (!row) return void res.json(null);

    const sections = row.generatedSections as any;
    const primaryRisk: any = (sections?.risks ?? [])[0] ?? null;
    const topQuickWin: any = (sections?.quickWins ?? [])[0] ?? null;

    res.json({ ...row, generatedSections: undefined, primaryRisk, topQuickWin });
  } catch (err) {
    logger.error({ err }, "Get diagnostic assessment summary failed");
    res.status(500).json({ error: "Failed to get diagnostic assessment summary." });
  }
});

// ─── Get growth assessment ───────────────────────────────────

router.get("/growth-assessments/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const [row] = await db
      .select({
        id: growthAssessmentsTable.id,
        diagnosticId: growthAssessmentsTable.diagnosticId,
        diagnosticVersionId: growthAssessmentsTable.diagnosticVersionId,
        clientId: growthAssessmentsTable.clientId,
        projectId: growthAssessmentsTable.projectId,
        status: growthAssessmentsTable.status,
        healthScore: growthAssessmentsTable.healthScore,
        healthRating: growthAssessmentsTable.healthRating,
        // System-generated
        systemStrengthSummary: growthAssessmentsTable.systemStrengthSummary,
        systemVulnerabilitySummary: growthAssessmentsTable.systemVulnerabilitySummary,
        systemRiskSummary: growthAssessmentsTable.systemRiskSummary,
        systemGrowthOpportunitySummary: growthAssessmentsTable.systemGrowthOpportunitySummary,
        systemQuickWinSummary: growthAssessmentsTable.systemQuickWinSummary,
        systemStrategicFocusSummary: growthAssessmentsTable.systemStrategicFocusSummary,
        // Admin-editable
        strengthSummary: growthAssessmentsTable.strengthSummary,
        vulnerabilitySummary: growthAssessmentsTable.vulnerabilitySummary,
        riskSummary: growthAssessmentsTable.riskSummary,
        growthOpportunitySummary: growthAssessmentsTable.growthOpportunitySummary,
        quickWinSummary: growthAssessmentsTable.quickWinSummary,
        strategicFocusSummary: growthAssessmentsTable.strategicFocusSummary,
        consultantNotes: growthAssessmentsTable.consultantNotes,
        generatedSections: growthAssessmentsTable.generatedSections,
        // Workflow
        reviewedBy: growthAssessmentsTable.reviewedBy,
        reviewedAt: growthAssessmentsTable.reviewedAt,
        approvedBy: growthAssessmentsTable.approvedBy,
        approvedAt: growthAssessmentsTable.approvedAt,
        archivedAt: growthAssessmentsTable.archivedAt,
        createdBy: growthAssessmentsTable.createdBy,
        updatedBy: growthAssessmentsTable.updatedBy,
        createdAt: growthAssessmentsTable.createdAt,
        updatedAt: growthAssessmentsTable.updatedAt,
        // Joins
        clientName: clientsTable.companyName,
        diagnosticName: diagnosticsTable.diagnosticName,
        versionNumber: diagnosticVersionsTable.versionNumber,
        projectName: projectsTable.projectName,
      })
      .from(growthAssessmentsTable)
      .leftJoin(clientsTable, eq(growthAssessmentsTable.clientId, clientsTable.id))
      .leftJoin(diagnosticsTable, eq(growthAssessmentsTable.diagnosticId, diagnosticsTable.id))
      .leftJoin(diagnosticVersionsTable, eq(growthAssessmentsTable.diagnosticVersionId, diagnosticVersionsTable.id))
      .leftJoin(projectsTable, eq(growthAssessmentsTable.projectId, projectsTable.id))
      .where(eq(growthAssessmentsTable.id, id))
      .limit(1);

    if (!row) return void res.status(404).json({ error: "Growth assessment not found." });
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Get growth assessment failed");
    res.status(500).json({ error: "Failed to get assessment." });
  }
});

// ─── Update growth assessment ────────────────────────────────

router.put("/growth-assessments/:id", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const {
      strengthSummary, vulnerabilitySummary, riskSummary,
      growthOpportunitySummary, quickWinSummary, strategicFocusSummary,
      consultantNotes,
    } = req.body;

    const [existing] = await db.select().from(growthAssessmentsTable).where(eq(growthAssessmentsTable.id, id)).limit(1);
    if (!existing) return void res.status(404).json({ error: "Growth assessment not found." });
    if (existing.status === "approved") {
      return void res.status(409).json({ error: "Cannot edit an approved assessment. Reopen it first." });
    }
    if (existing.archivedAt) {
      return void res.status(409).json({ error: "Cannot edit an archived assessment." });
    }

    const [updated] = await db.update(growthAssessmentsTable)
      .set({
        strengthSummary: strengthSummary ?? existing.strengthSummary,
        vulnerabilitySummary: vulnerabilitySummary ?? existing.vulnerabilitySummary,
        riskSummary: riskSummary ?? existing.riskSummary,
        growthOpportunitySummary: growthOpportunitySummary ?? existing.growthOpportunitySummary,
        quickWinSummary: quickWinSummary ?? existing.quickWinSummary,
        strategicFocusSummary: strategicFocusSummary ?? existing.strategicFocusSummary,
        consultantNotes: consultantNotes ?? existing.consultantNotes,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(growthAssessmentsTable.id, id))
      .returning();

    await logActivity({
      activityType: "GROWTH_ASSESSMENT.UPDATED",
      description: "Growth Assessment text updated",
      actorUserId: userId,
      entityType: "growth_assessment",
      entityId: id,
      metadata: { diagnosticId: existing.diagnosticId },
    }).catch(() => {});

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update growth assessment failed");
    res.status(500).json({ error: "Failed to update assessment." });
  }
});

// ─── Status actions ──────────────────────────────────────────

router.post("/growth-assessments/:id/action", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { action } = req.body;

    if (!VALID_ACTIONS.includes(action)) {
      return void res.status(400).json({ error: "Invalid action." });
    }

    const [existing] = await db.select().from(growthAssessmentsTable).where(eq(growthAssessmentsTable.id, id)).limit(1);
    if (!existing) return void res.status(404).json({ error: "Growth assessment not found." });

    let newStatus: string;
    const updates: Record<string, any> = { updatedBy: userId, updatedAt: new Date() };
    const prevStatus = existing.status;

    if (action === "submit") {
      if (existing.status !== "draft") return void res.status(409).json({ error: "Only draft assessments can be submitted." });
      newStatus = "awaiting_review";
      updates.reviewedAt = new Date();
      updates.reviewedBy = userId;
    } else if (action === "approve") {
      if (existing.status !== "awaiting_review") return void res.status(409).json({ error: "Only assessments awaiting review can be approved." });
      newStatus = "approved";
      updates.approvedAt = new Date();
      updates.approvedBy = userId;
    } else if (action === "reopen") {
      if (existing.status !== "approved") return void res.status(409).json({ error: "Only approved assessments can be reopened." });
      newStatus = "draft";
      await logActivity({
        activityType: "GROWTH_ASSESSMENT.REOPENED",
        description: "Approved Growth Assessment reopened for editing",
        actorUserId: userId,
        entityType: "growth_assessment",
        entityId: id,
        metadata: { diagnosticId: existing.diagnosticId, previousStatus: "approved" },
      }).catch(() => {});
    } else if (action === "archive") {
      if (existing.archivedAt) return void res.status(409).json({ error: "Already archived." });
      newStatus = "archived";
      updates.archivedAt = new Date();
    } else if (action === "restore") {
      if (!existing.archivedAt) return void res.status(409).json({ error: "Not archived." });
      newStatus = "draft";
      updates.archivedAt = null;
    } else {
      return void res.status(400).json({ error: "Unknown action." });
    }

    updates.status = newStatus!;

    const [updated] = await db.update(growthAssessmentsTable)
      .set(updates)
      .where(eq(growthAssessmentsTable.id, id))
      .returning();

    const activityTypeMap: Record<string, string> = {
      submit: "GROWTH_ASSESSMENT.SUBMITTED",
      approve: "GROWTH_ASSESSMENT.APPROVED",
      archive: "GROWTH_ASSESSMENT.ARCHIVED",
      restore: "GROWTH_ASSESSMENT.RESTORED",
    };
    const actType = activityTypeMap[action];
    if (actType) {
      await logActivity({
        activityType: actType,
        description: `Growth Assessment ${action}d`,
        actorUserId: userId,
        entityType: "growth_assessment",
        entityId: id,
        metadata: { diagnosticId: existing.diagnosticId, previousStatus: prevStatus, newStatus: newStatus! },
      }).catch(() => {});
    }

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Growth assessment action failed");
    res.status(500).json({ error: "Failed to perform action." });
  }
});

export default router;
