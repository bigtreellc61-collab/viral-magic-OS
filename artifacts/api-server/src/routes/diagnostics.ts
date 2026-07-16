import { Router, type IRouter } from "express";
import {
  and, asc, desc, eq, ilike, isNotNull, isNull, or, sql, inArray, ne,
} from "drizzle-orm";
import {
  db, diagnosticsTable, diagnosticVersionsTable, diagnosticScoresTable,
  bottleneckRecommendationsTable, diagnosticTemplateCategoriesTable,
  diagnosticTemplatesTable, clientsTable, projectsTable, activityRecordsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";
import {
  calcCategory, calcHealthScore, calcAveragePriorityScore, validateScoreInputs,
} from "../lib/diagnostics-calc";
import { generateDraftRecommendation } from "../lib/recommendation-engine";

const router: IRouter = Router();

// ─── Constants ───────────────────────────────────────────────
const VALID_STATUSES = ["draft", "in_progress", "completed", "awaiting_review", "approved", "superseded", "archived"];
const VALID_RESTORE_STATUSES = VALID_STATUSES.filter((s) => s !== "archived");
const VALID_TYPES = ["business_growth_assessment", "business_bottleneck_assessment", "technology_assessment", "marketing_assessment", "operations_assessment", "custom"];
const VALID_RESOLUTION_STATUSES = ["unresolved", "in_progress", "resolved", "accepted_risk", "deferred"];
const VALID_REC_STATUSES = ["draft", "edited", "approved", "rejected", "implemented"];

async function fetchDiagnosticOr404(diagnosticId: string, res: any) {
  const rows = await db.select().from(diagnosticsTable).where(eq(diagnosticsTable.id, diagnosticId)).limit(1);
  if (!rows[0]) { res.status(404).json({ error: "Diagnostic not found." }); return null; }
  return rows[0];
}

// ─── Dashboard Diagnostics ──────────────────────────────────

router.get("/dashboard/diagnostics", requireAuth, async (req, res) => {
  try {
    const [totalRow, draftRow, awaitingRow, completedRow, approvedRow] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(isNull(diagnosticsTable.archivedAt)),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), inArray(diagnosticsTable.status, ["draft", "in_progress"]))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticsTable.status, "awaiting_review"))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticsTable.status, "completed"))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticsTable.status, "approved"))),
    ]);

    const [criticalRow, highRow] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(diagnosticScoresTable)
        .innerJoin(diagnosticVersionsTable, eq(diagnosticScoresTable.diagnosticVersionId, diagnosticVersionsTable.id))
        .innerJoin(diagnosticsTable, eq(diagnosticVersionsTable.diagnosticId, diagnosticsTable.id))
        .where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticScoresTable.severity, "critical"), eq(diagnosticScoresTable.resolutionStatus, "unresolved"))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticScoresTable)
        .innerJoin(diagnosticVersionsTable, eq(diagnosticScoresTable.diagnosticVersionId, diagnosticVersionsTable.id))
        .innerJoin(diagnosticsTable, eq(diagnosticVersionsTable.diagnosticId, diagnosticsTable.id))
        .where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticScoresTable.severity, "high"), eq(diagnosticScoresTable.resolutionStatus, "unresolved"))),
    ]);

    // Top unresolved bottlenecks
    const topBottlenecks = await db.select({
      scoreId: diagnosticScoresTable.id,
      categoryLabel: diagnosticScoresTable.categoryLabel,
      priorityScore: diagnosticScoresTable.priorityScore,
      severity: diagnosticScoresTable.severity,
      resolutionStatus: diagnosticScoresTable.resolutionStatus,
      diagnosticId: diagnosticsTable.id,
      diagnosticName: diagnosticsTable.diagnosticName,
      clientId: diagnosticsTable.clientId,
      clientName: clientsTable.companyName,
      recommendedFirstAction: diagnosticVersionsTable.recommendedFirstAction,
    })
      .from(diagnosticScoresTable)
      .innerJoin(diagnosticVersionsTable, eq(diagnosticScoresTable.diagnosticVersionId, diagnosticVersionsTable.id))
      .innerJoin(diagnosticsTable, eq(diagnosticVersionsTable.diagnosticId, diagnosticsTable.id))
      .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
      .where(and(
        isNull(diagnosticsTable.archivedAt),
        inArray(diagnosticScoresTable.severity, ["critical", "high"]),
        eq(diagnosticScoresTable.resolutionStatus, "unresolved"),
      ))
      .orderBy(desc(diagnosticScoresTable.priorityScore))
      .limit(10);

    // Awaiting review diagnostics
    const awaitingReview = await db.select({
      id: diagnosticsTable.id,
      diagnosticName: diagnosticsTable.diagnosticName,
      diagnosticType: diagnosticsTable.diagnosticType,
      status: diagnosticsTable.status,
      overallHealthScore: diagnosticsTable.overallHealthScore,
      completedAt: diagnosticsTable.completedAt,
      currentVersionNumber: diagnosticsTable.currentVersionNumber,
      clientId: diagnosticsTable.clientId,
      clientName: clientsTable.companyName,
    })
      .from(diagnosticsTable)
      .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
      .where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticsTable.status, "awaiting_review")))
      .orderBy(asc(diagnosticsTable.completedAt))
      .limit(10);

    // Recent diagnostics
    const recentDiagnostics = await db.select({
      id: diagnosticsTable.id,
      diagnosticName: diagnosticsTable.diagnosticName,
      diagnosticType: diagnosticsTable.diagnosticType,
      status: diagnosticsTable.status,
      overallHealthScore: diagnosticsTable.overallHealthScore,
      currentVersionNumber: diagnosticsTable.currentVersionNumber,
      updatedAt: diagnosticsTable.updatedAt,
      completedAt: diagnosticsTable.completedAt,
      clientId: diagnosticsTable.clientId,
      clientName: clientsTable.companyName,
    })
      .from(diagnosticsTable)
      .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
      .where(isNull(diagnosticsTable.archivedAt))
      .orderBy(desc(diagnosticsTable.updatedAt))
      .limit(5);

    // Recent activity for diagnostics
    const recentActivity = await db.select().from(activityRecordsTable)
      .where(ilike(activityRecordsTable.activityType, "DIAGNOSTIC.%"))
      .orderBy(desc(activityRecordsTable.createdAt))
      .limit(10);

    res.json({
      total: Number(totalRow[0]?.count ?? 0),
      draftInProgress: Number(draftRow[0]?.count ?? 0),
      awaitingReview: Number(awaitingRow[0]?.count ?? 0),
      completed: Number(completedRow[0]?.count ?? 0),
      approved: Number(approvedRow[0]?.count ?? 0),
      criticalBottlenecks: Number(criticalRow[0]?.count ?? 0),
      highBottlenecks: Number(highRow[0]?.count ?? 0),
      topBottlenecks,
      awaitingReviewList: awaitingReview,
      recentDiagnostics,
      recentActivity,
    });
  } catch (err) {
    logger.error({ err }, "Dashboard diagnostics failed");
    res.status(500).json({ error: "Failed to load diagnostic dashboard." });
  }
});

// ─── Metrics summary ────────────────────────────────────────

router.get("/diagnostics/metrics/summary", requireAuth, async (_req, res) => {
  try {
    const [totalRow, draftRow, awaitingRow, completedRow, approvedRow, criticalRow, highRow] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(isNull(diagnosticsTable.archivedAt)),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), inArray(diagnosticsTable.status, ["draft", "in_progress"]))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticsTable.status, "awaiting_review"))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticsTable.status, "completed"))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticsTable).where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticsTable.status, "approved"))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticScoresTable)
        .innerJoin(diagnosticVersionsTable, eq(diagnosticScoresTable.diagnosticVersionId, diagnosticVersionsTable.id))
        .innerJoin(diagnosticsTable, eq(diagnosticVersionsTable.diagnosticId, diagnosticsTable.id))
        .where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticScoresTable.severity, "critical"), eq(diagnosticScoresTable.resolutionStatus, "unresolved"))),
      db.select({ count: sql<number>`count(*)` }).from(diagnosticScoresTable)
        .innerJoin(diagnosticVersionsTable, eq(diagnosticScoresTable.diagnosticVersionId, diagnosticVersionsTable.id))
        .innerJoin(diagnosticsTable, eq(diagnosticVersionsTable.diagnosticId, diagnosticsTable.id))
        .where(and(isNull(diagnosticsTable.archivedAt), eq(diagnosticScoresTable.severity, "high"), eq(diagnosticScoresTable.resolutionStatus, "unresolved"))),
    ]);
    res.json({
      total: Number(totalRow[0]?.count ?? 0),
      draftInProgress: Number(draftRow[0]?.count ?? 0),
      awaitingReview: Number(awaitingRow[0]?.count ?? 0),
      completed: Number(completedRow[0]?.count ?? 0),
      approved: Number(approvedRow[0]?.count ?? 0),
      criticalBottlenecks: Number(criticalRow[0]?.count ?? 0),
      highBottlenecks: Number(highRow[0]?.count ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "Diagnostic metrics failed");
    res.status(500).json({ error: "Failed to load metrics." });
  }
});

// ─── Get default template categories ────────────────────────

router.get("/diagnostic-templates/default/categories", requireAuth, async (_req, res) => {
  try {
    const [template] = await db.select().from(diagnosticTemplatesTable)
      .where(and(eq(diagnosticTemplatesTable.isDefault, true), eq(diagnosticTemplatesTable.isActive, true)))
      .limit(1);
    if (!template) return void res.status(404).json({ error: "Default template not found." });
    const categories = await db.select().from(diagnosticTemplateCategoriesTable)
      .where(and(eq(diagnosticTemplateCategoriesTable.templateId, template.id), eq(diagnosticTemplateCategoriesTable.isActive, true)))
      .orderBy(asc(diagnosticTemplateCategoriesTable.displayOrder));
    res.json({ template, categories });
  } catch (err) {
    logger.error({ err }, "Get default template failed");
    res.status(500).json({ error: "Failed to load template." });
  }
});

// ─── List diagnostics ────────────────────────────────────────

router.get("/diagnostics", requireAuth, async (req, res) => {
  try {
    const {
      search = "", clientId, projectId, diagnosticType, status,
      showArchived = "false", sort = "newest",
      page = "1", pageSize = "25",
    } = req.query as Record<string, string>;

    const conditions: any[] = [];
    if (showArchived === "true") {
      conditions.push(isNotNull(diagnosticsTable.archivedAt));
    } else {
      conditions.push(isNull(diagnosticsTable.archivedAt));
    }
    if (search) {
      conditions.push(or(
        ilike(diagnosticsTable.diagnosticName, `%${search}%`),
        ilike(diagnosticsTable.diagnosticType, `%${search}%`),
        ilike(clientsTable.companyName, `%${search}%`),
      ));
    }
    if (clientId) conditions.push(eq(diagnosticsTable.clientId, clientId));
    if (projectId) conditions.push(eq(diagnosticsTable.projectId, projectId));
    if (diagnosticType) conditions.push(eq(diagnosticsTable.diagnosticType, diagnosticType));
    if (status) conditions.push(eq(diagnosticsTable.status, status));

    const sortMap: Record<string, any> = {
      newest: desc(diagnosticsTable.createdAt),
      oldest: asc(diagnosticsTable.createdAt),
      recently_updated: desc(diagnosticsTable.updatedAt),
      lowest_health: asc(diagnosticsTable.overallHealthScore),
      highest_health: desc(diagnosticsTable.overallHealthScore),
      highest_priority: desc(diagnosticsTable.overallPriorityScore),
      client_az: asc(clientsTable.companyName),
    };
    const orderBy = sortMap[sort] ?? desc(diagnosticsTable.createdAt);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
    const offset = (pageNum - 1) * pageSizeNum;
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db.select({
        id: diagnosticsTable.id,
        clientId: diagnosticsTable.clientId,
        projectId: diagnosticsTable.projectId,
        diagnosticName: diagnosticsTable.diagnosticName,
        diagnosticType: diagnosticsTable.diagnosticType,
        status: diagnosticsTable.status,
        currentVersionNumber: diagnosticsTable.currentVersionNumber,
        overallHealthScore: diagnosticsTable.overallHealthScore,
        overallPriorityScore: diagnosticsTable.overallPriorityScore,
        startedAt: diagnosticsTable.startedAt,
        completedAt: diagnosticsTable.completedAt,
        archivedAt: diagnosticsTable.archivedAt,
        createdAt: diagnosticsTable.createdAt,
        updatedAt: diagnosticsTable.updatedAt,
        clientName: clientsTable.companyName,
        projectName: projectsTable.projectName,
      })
        .from(diagnosticsTable)
        .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
        .leftJoin(projectsTable, eq(diagnosticsTable.projectId, projectsTable.id))
        .where(where)
        .orderBy(orderBy)
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(diagnosticsTable)
        .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
        .where(where),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data: rows, total, page: pageNum, pageSize: pageSizeNum, totalPages: Math.ceil(total / pageSizeNum) });
  } catch (err) {
    logger.error({ err }, "List diagnostics failed");
    res.status(500).json({ error: "Failed to list diagnostics." });
  }
});

// ─── Create diagnostic ───────────────────────────────────────

router.post("/diagnostics", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { clientId, projectId, diagnosticName, diagnosticType, summaryNotes } = req.body;

    if (!clientId || !diagnosticName?.trim() || !diagnosticType) {
      return void res.status(400).json({ error: "Client, name, and type are required." });
    }
    if (!VALID_TYPES.includes(diagnosticType)) {
      return void res.status(400).json({ error: "Invalid diagnostic type." });
    }
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client) return void res.status(400).json({ error: "Client not found." });
    if (projectId) {
      const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      if (!project) return void res.status(400).json({ error: "Project not found." });
    }

    const [diagnostic] = await db.insert(diagnosticsTable).values({
      clientId, projectId: projectId ?? null,
      diagnosticName: diagnosticName.trim(),
      diagnosticType, status: "draft",
      startedAt: new Date(),
      summaryNotes: summaryNotes ?? null,
      createdBy: userId, updatedBy: userId,
    }).returning();

    await logActivity({
      activityType: "DIAGNOSTIC.CREATED",
      description: `Diagnostic "${diagnostic.diagnosticName}" created`,
      actorUserId: userId, entityType: "diagnostic", entityId: diagnostic.id,
      metadata: { diagnosticName: diagnostic.diagnosticName, clientId, clientName: client.companyName },
    });

    res.status(201).json(diagnostic);
  } catch (err) {
    logger.error({ err }, "Create diagnostic failed");
    res.status(500).json({ error: "Failed to create diagnostic." });
  }
});

// ─── Get diagnostic ──────────────────────────────────────────

router.get("/diagnostics/:diagnosticId", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const rows = await db.select({
      id: diagnosticsTable.id,
      clientId: diagnosticsTable.clientId,
      projectId: diagnosticsTable.projectId,
      diagnosticName: diagnosticsTable.diagnosticName,
      diagnosticType: diagnosticsTable.diagnosticType,
      status: diagnosticsTable.status,
      currentVersionNumber: diagnosticsTable.currentVersionNumber,
      startedAt: diagnosticsTable.startedAt,
      completedAt: diagnosticsTable.completedAt,
      reviewedAt: diagnosticsTable.reviewedAt,
      reviewedBy: diagnosticsTable.reviewedBy,
      summaryNotes: diagnosticsTable.summaryNotes,
      overallHealthScore: diagnosticsTable.overallHealthScore,
      overallPriorityScore: diagnosticsTable.overallPriorityScore,
      archivedAt: diagnosticsTable.archivedAt,
      createdBy: diagnosticsTable.createdBy,
      updatedBy: diagnosticsTable.updatedBy,
      createdAt: diagnosticsTable.createdAt,
      updatedAt: diagnosticsTable.updatedAt,
      clientName: clientsTable.companyName,
      projectName: projectsTable.projectName,
    })
      .from(diagnosticsTable)
      .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
      .leftJoin(projectsTable, eq(diagnosticsTable.projectId, projectsTable.id))
      .where(eq(diagnosticsTable.id, diagnosticId))
      .limit(1);
    if (!rows[0]) return void res.status(404).json({ error: "Diagnostic not found." });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "Get diagnostic failed");
    res.status(500).json({ error: "Failed to get diagnostic." });
  }
});

// ─── Update diagnostic ───────────────────────────────────────

router.put("/diagnostics/:diagnosticId", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;

    const { diagnosticName, diagnosticType, summaryNotes, status } = req.body;
    if (status && !VALID_STATUSES.includes(status)) {
      return void res.status(400).json({ error: "Invalid status." });
    }
    if (diagnosticType && !VALID_TYPES.includes(diagnosticType)) {
      return void res.status(400).json({ error: "Invalid diagnostic type." });
    }

    const updates: any = { updatedAt: new Date(), updatedBy: userId };
    if (diagnosticName !== undefined) updates.diagnosticName = diagnosticName.trim();
    if (diagnosticType !== undefined) updates.diagnosticType = diagnosticType;
    if (summaryNotes !== undefined) updates.summaryNotes = summaryNotes;
    if (status !== undefined) updates.status = status;

    const [updated] = await db.update(diagnosticsTable).set(updates).where(eq(diagnosticsTable.id, diagnosticId)).returning();
    await logActivity({ activityType: "DIAGNOSTIC.UPDATED", description: `Diagnostic "${updated.diagnosticName}" updated`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: {} });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update diagnostic failed");
    res.status(500).json({ error: "Failed to update diagnostic." });
  }
});

// ─── Save draft scores ───────────────────────────────────────

router.post("/diagnostics/:diagnosticId/save-draft", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;
    if (diagnostic.archivedAt) return void res.status(400).json({ error: "Cannot edit archived diagnostic." });

    const { scores = [], versionId } = req.body;

    // Find or create the current draft version
    let version: any;
    if (versionId) {
      const rows = await db.select().from(diagnosticVersionsTable)
        .where(and(eq(diagnosticVersionsTable.id, versionId), eq(diagnosticVersionsTable.diagnosticId, diagnosticId)))
        .limit(1);
      if (rows[0]) {
        // Enforce immutability: only draft versions may be edited
        if (rows[0].status !== "draft" && rows[0].status !== "in_progress") {
          return void res.status(400).json({ error: "Cannot edit a completed or approved version. Create a new version first." });
        }
        version = rows[0];
      }
    }
    if (!version) {
      // Get draft version or create new one
      const rows = await db.select().from(diagnosticVersionsTable)
        .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), eq(diagnosticVersionsTable.status, "draft")))
        .orderBy(desc(diagnosticVersionsTable.versionNumber))
        .limit(1);
      if (rows[0]) {
        version = rows[0];
      } else {
        const nextVersion = (diagnostic.currentVersionNumber ?? 0) + 1;
        const [newVersion] = await db.insert(diagnosticVersionsTable).values({
          diagnosticId, versionNumber: nextVersion, status: "draft", createdBy: userId,
        }).returning();
        version = newVersion;
        await db.update(diagnosticsTable).set({ currentVersionNumber: nextVersion, updatedAt: new Date(), updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId));
      }
    }

    // Upsert scores
    for (const score of scores) {
      const existing = await db.select().from(diagnosticScoresTable)
        .where(and(eq(diagnosticScoresTable.diagnosticVersionId, version.id), eq(diagnosticScoresTable.categoryKey, score.categoryKey)))
        .limit(1);

      const cp = score.currentPerformance != null ? Number(score.currentPerformance) : null;
      const bi = score.businessImpact != null ? Number(score.businessImpact) : null;
      const ur = score.urgency != null ? Number(score.urgency) : null;

      let performanceGap: number | null = null;
      let priorityScore: number | null = null;
      let severity: string | null = null;

      if (cp != null && bi != null && ur != null) {
        const calc = calcCategory({ currentPerformance: cp, businessImpact: bi, urgency: ur });
        performanceGap = calc.performanceGap;
        priorityScore = calc.priorityScore;
        severity = calc.severity;
      }

      const scoreData: any = {
        categoryKey: score.categoryKey,
        categoryLabel: score.categoryLabel ?? score.categoryKey,
        categoryDescription: score.categoryDescription ?? null,
        displayOrder: score.displayOrder ?? 0,
        currentPerformance: cp?.toString() ?? null,
        businessImpact: bi?.toString() ?? null,
        urgency: ur?.toString() ?? null,
        performanceGap: performanceGap?.toString() ?? null,
        priorityScore: priorityScore?.toString() ?? null,
        severity,
        evidence: score.evidence ?? null,
        observations: score.observations ?? null,
        notes: score.notes ?? null,
        recommendedAction: score.recommendedAction ?? null,
        updatedAt: new Date(),
      };

      if (existing[0]) {
        await db.update(diagnosticScoresTable).set(scoreData).where(eq(diagnosticScoresTable.id, existing[0].id));
      } else {
        await db.insert(diagnosticScoresTable).values({ diagnosticVersionId: version.id, ...scoreData });
      }
    }

    // Update status to in_progress if draft
    if (diagnostic.status === "draft") {
      await db.update(diagnosticsTable).set({ status: "in_progress", updatedAt: new Date(), updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId));
    }

    await logActivity({ activityType: "DIAGNOSTIC.DRAFT_SAVED", description: `Draft saved for "${diagnostic.diagnosticName}"`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: { versionId: version.id } });

    res.json({ versionId: version.id, versionNumber: version.versionNumber, message: "Draft saved." });
  } catch (err) {
    logger.error({ err }, "Save draft failed");
    res.status(500).json({ error: "Failed to save draft." });
  }
});

// ─── Complete diagnostic ─────────────────────────────────────

router.post("/diagnostics/:diagnosticId/complete", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;
    if (diagnostic.archivedAt) return void res.status(400).json({ error: "Cannot complete archived diagnostic." });

    const { versionId } = req.body;

    // Find the current draft version
    let version: any;
    if (versionId) {
      const rows = await db.select().from(diagnosticVersionsTable)
        .where(and(eq(diagnosticVersionsTable.id, versionId), eq(diagnosticVersionsTable.diagnosticId, diagnosticId)))
        .limit(1);
      version = rows[0];
    }
    if (!version) {
      const rows = await db.select().from(diagnosticVersionsTable)
        .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), eq(diagnosticVersionsTable.status, "draft")))
        .orderBy(desc(diagnosticVersionsTable.versionNumber))
        .limit(1);
      version = rows[0];
    }
    if (!version) return void res.status(400).json({ error: "No draft version found to complete." });

    // Fetch all scores for this version
    const scores = await db.select().from(diagnosticScoresTable)
      .where(eq(diagnosticScoresTable.diagnosticVersionId, version.id))
      .orderBy(asc(diagnosticScoresTable.displayOrder));

    if (scores.length === 0) return void res.status(400).json({ error: "No categories scored. Add scores before completing." });

    // Validate all scores have numeric values
    const missingScores = scores.filter((s) =>
      s.currentPerformance == null || s.businessImpact == null || s.urgency == null,
    );
    if (missingScores.length > 0) {
      return void res.status(400).json({
        error: `${missingScores.length} categories have missing required scores.`,
        missingCategories: missingScores.map((s) => s.categoryLabel),
      });
    }

    // Server-side recalculation
    const categoryInputs = scores.map((s) => ({
      currentPerformance: Number(s.currentPerformance),
      businessImpact: Number(s.businessImpact),
      urgency: Number(s.urgency),
    }));

    const healthScore = calcHealthScore(categoryInputs);
    const priorityScores = categoryInputs.map((c) => {
      const gap = 10 - c.currentPerformance;
      return gap * c.businessImpact * c.urgency;
    });
    const avgPriority = calcAveragePriorityScore(priorityScores);

    // Update each score with recalculated values
    for (let i = 0; i < scores.length; i++) {
      const s = scores[i];
      const { performanceGap, priorityScore, severity } = calcCategory({
        currentPerformance: Number(s.currentPerformance),
        businessImpact: Number(s.businessImpact),
        urgency: Number(s.urgency),
      });
      await db.update(diagnosticScoresTable).set({
        performanceGap: performanceGap.toString(),
        priorityScore: priorityScore.toString(),
        severity,
        updatedAt: new Date(),
      }).where(eq(diagnosticScoresTable.id, s.id));
    }

    // Fetch updated scores for recommendation generation
    const updatedScores = await db.select().from(diagnosticScoresTable)
      .where(eq(diagnosticScoresTable.diagnosticVersionId, version.id))
      .orderBy(asc(diagnosticScoresTable.displayOrder));

    // Generate bottleneck recommendations
    for (const score of updatedScores) {
      const draft = generateDraftRecommendation({
        categoryKey: score.categoryKey,
        categoryLabel: score.categoryLabel,
        currentPerformance: Number(score.currentPerformance),
        businessImpact: Number(score.businessImpact),
        urgency: Number(score.urgency),
        severity: (score.severity as any) ?? "monitor",
        evidence: score.evidence,
        observations: score.observations,
      });

      // Upsert recommendation
      const existing = await db.select().from(bottleneckRecommendationsTable)
        .where(eq(bottleneckRecommendationsTable.diagnosticScoreId, score.id))
        .limit(1);

      if (existing[0]) {
        if (existing[0].recommendationStatus === "draft") {
          await db.update(bottleneckRecommendationsTable).set({
            systemGeneratedDraft: draft,
            updatedAt: new Date(),
          }).where(eq(bottleneckRecommendationsTable.id, existing[0].id));
        }
      } else {
        await db.insert(bottleneckRecommendationsTable).values({
          diagnosticScoreId: score.id,
          systemGeneratedDraft: draft,
          priorityOrder: score.displayOrder,
          recommendationStatus: "draft",
        });
      }
    }

    const now = new Date();
    // Mark version completed
    await db.update(diagnosticVersionsTable).set({
      status: "completed",
      overallHealthScore: healthScore.toString(),
      overallPriorityScore: avgPriority.toString(),
      completedAt: now,
    }).where(eq(diagnosticVersionsTable.id, version.id));

    // Update diagnostic
    const [updated] = await db.update(diagnosticsTable).set({
      status: "completed",
      overallHealthScore: healthScore.toString(),
      overallPriorityScore: avgPriority.toString(),
      completedAt: now,
      updatedAt: now,
      updatedBy: userId,
    }).where(eq(diagnosticsTable.id, diagnosticId)).returning();

    await logActivity({ activityType: "DIAGNOSTIC.COMPLETED", description: `Diagnostic "${diagnostic.diagnosticName}" completed (v${version.versionNumber})`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: { versionId: version.id, healthScore, avgPriority } });

    res.json({ ...updated, versionId: version.id, healthScore, avgPriority });
  } catch (err) {
    logger.error({ err }, "Complete diagnostic failed");
    res.status(500).json({ error: "Failed to complete diagnostic." });
  }
});

// ─── Archive / Restore / Delete ──────────────────────────────

router.post("/diagnostics/:diagnosticId/archive", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;
    if (diagnostic.archivedAt) return void res.status(400).json({ error: "Already archived." });
    const [updated] = await db.update(diagnosticsTable).set({ archivedAt: new Date(), status: "archived", updatedAt: new Date(), updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId)).returning();
    await logActivity({ activityType: "DIAGNOSTIC.ARCHIVED", description: `Diagnostic "${diagnostic.diagnosticName}" archived`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: {} });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Archive diagnostic failed");
    res.status(500).json({ error: "Failed to archive." });
  }
});

router.post("/diagnostics/:diagnosticId/restore", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;
    if (!diagnostic.archivedAt) return void res.status(400).json({ error: "Not archived." });
    const { status = "draft" } = req.body;
    if (!VALID_RESTORE_STATUSES.includes(status)) return void res.status(400).json({ error: "Invalid restore status." });
    const [updated] = await db.update(diagnosticsTable).set({ archivedAt: null, status, updatedAt: new Date(), updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId)).returning();
    await logActivity({ activityType: "DIAGNOSTIC.RESTORED", description: `Diagnostic "${diagnostic.diagnosticName}" restored`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: { status } });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Restore diagnostic failed");
    res.status(500).json({ error: "Failed to restore." });
  }
});

router.delete("/diagnostics/:diagnosticId", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;
    if (!diagnostic.archivedAt) return void res.status(400).json({ error: "Diagnostic must be archived before permanent deletion." });
    await logActivity({ activityType: "DIAGNOSTIC.DELETED", description: `Diagnostic "${diagnostic.diagnosticName}" permanently deleted`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: {} }).catch(() => {});
    await db.delete(diagnosticsTable).where(eq(diagnosticsTable.id, diagnosticId));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Delete diagnostic failed");
    res.status(500).json({ error: "Failed to delete." });
  }
});

// ─── Versions ────────────────────────────────────────────────

router.get("/diagnostics/:diagnosticId/versions", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const versions = await db.select().from(diagnosticVersionsTable)
      .where(eq(diagnosticVersionsTable.diagnosticId, diagnosticId))
      .orderBy(desc(diagnosticVersionsTable.versionNumber));
    res.json(versions);
  } catch (err) {
    logger.error({ err }, "List versions failed");
    res.status(500).json({ error: "Failed to list versions." });
  }
});

router.post("/diagnostics/:diagnosticId/versions", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;
    const { copyScores = true } = req.body;

    const nextVersionNum = (diagnostic.currentVersionNumber ?? 0) + 1;
    const [newVersion] = await db.insert(diagnosticVersionsTable).values({
      diagnosticId, versionNumber: nextVersionNum, status: "draft", createdBy: userId,
    }).returning();

    if (copyScores) {
      // Find the latest completed version to copy scores from
      const latestCompleted = await db.select().from(diagnosticVersionsTable)
        .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), ne(diagnosticVersionsTable.id, newVersion.id), ne(diagnosticVersionsTable.status, "draft")))
        .orderBy(desc(diagnosticVersionsTable.versionNumber))
        .limit(1);

      if (latestCompleted[0]) {
        const existingScores = await db.select().from(diagnosticScoresTable)
          .where(eq(diagnosticScoresTable.diagnosticVersionId, latestCompleted[0].id));
        for (const s of existingScores) {
          await db.insert(diagnosticScoresTable).values({
            diagnosticVersionId: newVersion.id,
            categoryKey: s.categoryKey, categoryLabel: s.categoryLabel,
            categoryDescription: s.categoryDescription,
            displayOrder: s.displayOrder,
            currentPerformance: s.currentPerformance,
            businessImpact: s.businessImpact,
            urgency: s.urgency,
            performanceGap: s.performanceGap,
            priorityScore: s.priorityScore,
            severity: s.severity,
            evidence: null, observations: null, notes: null, recommendedAction: null,
            resolutionStatus: "unresolved",
          });
        }
      }
    }

    await db.update(diagnosticsTable).set({
      currentVersionNumber: nextVersionNum, status: "in_progress",
      updatedAt: new Date(), updatedBy: userId,
    }).where(eq(diagnosticsTable.id, diagnosticId));

    await logActivity({ activityType: "DIAGNOSTIC.VERSION_CREATED", description: `New version v${nextVersionNum} created for "${diagnostic.diagnosticName}"`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: { versionId: newVersion.id, versionNumber: nextVersionNum } });
    res.status(201).json(newVersion);
  } catch (err) {
    logger.error({ err }, "Create version failed");
    res.status(500).json({ error: "Failed to create version." });
  }
});

router.get("/diagnostics/:diagnosticId/versions/:versionNumber", requireAuth, async (req, res) => {
  try {
    const { diagnosticId, versionNumber } = req.params as Record<string, string>;
    const vn = parseInt(versionNumber, 10);
    const [version] = await db.select().from(diagnosticVersionsTable)
      .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), eq(diagnosticVersionsTable.versionNumber, vn)))
      .limit(1);
    if (!version) return void res.status(404).json({ error: "Version not found." });

    const scores = await db.select({
      score: diagnosticScoresTable,
      recommendation: bottleneckRecommendationsTable,
    })
      .from(diagnosticScoresTable)
      .leftJoin(bottleneckRecommendationsTable, eq(bottleneckRecommendationsTable.diagnosticScoreId, diagnosticScoresTable.id))
      .where(eq(diagnosticScoresTable.diagnosticVersionId, version.id))
      .orderBy(asc(diagnosticScoresTable.displayOrder));

    res.json({ version, scores });
  } catch (err) {
    logger.error({ err }, "Get version failed");
    res.status(500).json({ error: "Failed to get version." });
  }
});

// ─── Update executive summary ─────────────────────────────────

router.put("/diagnostics/:diagnosticId/versions/:versionNumber/summary", requireAuth, async (req, res) => {
  try {
    const { diagnosticId, versionNumber } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const vn = parseInt(versionNumber, 10);
    const { executiveSummary, recommendedFirstAction, recommendedSoftwareOpportunity } = req.body;

    const [version] = await db.select().from(diagnosticVersionsTable)
      .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), eq(diagnosticVersionsTable.versionNumber, vn)))
      .limit(1);
    if (!version) return void res.status(404).json({ error: "Version not found." });

    const updates: any = { };
    if (executiveSummary !== undefined) updates.executiveSummary = executiveSummary;
    if (recommendedFirstAction !== undefined) updates.recommendedFirstAction = recommendedFirstAction;
    if (recommendedSoftwareOpportunity !== undefined) updates.recommendedSoftwareOpportunity = recommendedSoftwareOpportunity;

    const [updated] = await db.update(diagnosticVersionsTable).set(updates).where(eq(diagnosticVersionsTable.id, version.id)).returning();
    await db.update(diagnosticsTable).set({ updatedAt: new Date(), updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId));
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update summary failed");
    res.status(500).json({ error: "Failed to update summary." });
  }
});

// ─── Approve diagnostic ──────────────────────────────────────

router.post("/diagnostics/:diagnosticId/versions/:versionNumber/approve", requireAuth, async (req, res) => {
  try {
    const { diagnosticId, versionNumber } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const vn = parseInt(versionNumber, 10);
    const { action = "approve" } = req.body; // approve | return_to_review | mark_awaiting_review

    const diagnostic = await fetchDiagnosticOr404(diagnosticId, res);
    if (!diagnostic) return;

    const [version] = await db.select().from(diagnosticVersionsTable)
      .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), eq(diagnosticVersionsTable.versionNumber, vn)))
      .limit(1);
    if (!version) return void res.status(404).json({ error: "Version not found." });

    const now = new Date();
    if (action === "approve") {
      await db.update(diagnosticVersionsTable).set({ status: "approved", approvedAt: now, approvedBy: userId }).where(eq(diagnosticVersionsTable.id, version.id));
      await db.update(diagnosticsTable).set({ status: "approved", reviewedAt: now, reviewedBy: userId, updatedAt: now, updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId));
      await logActivity({ activityType: "DIAGNOSTIC.APPROVED", description: `Diagnostic "${diagnostic.diagnosticName}" v${vn} approved`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: { versionId: version.id } });
    } else if (action === "mark_awaiting_review") {
      await db.update(diagnosticsTable).set({ status: "awaiting_review", updatedAt: now, updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId));
    } else if (action === "return_to_review") {
      await db.update(diagnosticsTable).set({ status: "completed", updatedAt: now, updatedBy: userId }).where(eq(diagnosticsTable.id, diagnosticId));
      await logActivity({ activityType: "DIAGNOSTIC.REOPENED", description: `Diagnostic "${diagnostic.diagnosticName}" returned to review`, actorUserId: userId, entityType: "diagnostic", entityId: diagnosticId, metadata: {} });
    }

    const [updatedDiag] = await db.select().from(diagnosticsTable).where(eq(diagnosticsTable.id, diagnosticId)).limit(1);
    res.json(updatedDiag);
  } catch (err) {
    logger.error({ err }, "Approve diagnostic failed");
    res.status(500).json({ error: "Failed to update approval status." });
  }
});

// ─── Version comparison ──────────────────────────────────────

router.get("/diagnostics/:diagnosticId/compare", requireAuth, async (req, res) => {
  try {
    const { diagnosticId } = req.params as Record<string, string>;
    const { v1, v2 } = req.query as { v1: string; v2: string };
    if (!v1 || !v2) return void res.status(400).json({ error: "v1 and v2 version numbers required." });

    const [versionA] = await db.select().from(diagnosticVersionsTable)
      .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), eq(diagnosticVersionsTable.versionNumber, parseInt(v1, 10)))).limit(1);
    const [versionB] = await db.select().from(diagnosticVersionsTable)
      .where(and(eq(diagnosticVersionsTable.diagnosticId, diagnosticId), eq(diagnosticVersionsTable.versionNumber, parseInt(v2, 10)))).limit(1);
    if (!versionA || !versionB) return void res.status(404).json({ error: "One or both versions not found." });

    const scoresA = await db.select().from(diagnosticScoresTable).where(eq(diagnosticScoresTable.diagnosticVersionId, versionA.id)).orderBy(asc(diagnosticScoresTable.displayOrder));
    const scoresB = await db.select().from(diagnosticScoresTable).where(eq(diagnosticScoresTable.diagnosticVersionId, versionB.id)).orderBy(asc(diagnosticScoresTable.displayOrder));

    const scoresAMap = new Map(scoresA.map((s) => [s.categoryKey, s]));
    const scoresBMap = new Map(scoresB.map((s) => [s.categoryKey, s]));
    const allKeys = new Set([...scoresA.map((s) => s.categoryKey), ...scoresB.map((s) => s.categoryKey)]);

    const categoryComparisons = Array.from(allKeys).map((key) => {
      const a = scoresAMap.get(key);
      const b = scoresBMap.get(key);
      const cpA = a ? Number(a.currentPerformance) : null;
      const cpB = b ? Number(b.currentPerformance) : null;
      let trend: "improved" | "declined" | "unchanged" | "new" | "removed" = "unchanged";
      if (cpA == null && cpB != null) trend = "new";
      else if (cpA != null && cpB == null) trend = "removed";
      else if (cpA != null && cpB != null) {
        if (cpB > cpA) trend = "improved";
        else if (cpB < cpA) trend = "declined";
        else trend = "unchanged";
      }
      return {
        categoryKey: key,
        categoryLabel: b?.categoryLabel ?? a?.categoryLabel ?? key,
        displayOrder: b?.displayOrder ?? a?.displayOrder ?? 0,
        v1: a ? { currentPerformance: cpA, priorityScore: Number(a.priorityScore), severity: a.severity } : null,
        v2: b ? { currentPerformance: cpB, priorityScore: Number(b.priorityScore), severity: b.severity } : null,
        trend,
        performanceDelta: cpA != null && cpB != null ? Math.round((cpB - cpA) * 10) / 10 : null,
      };
    }).sort((a, b) => a.displayOrder - b.displayOrder);

    res.json({
      versionA: { versionNumber: versionA.versionNumber, overallHealthScore: versionA.overallHealthScore, overallPriorityScore: versionA.overallPriorityScore, completedAt: versionA.completedAt },
      versionB: { versionNumber: versionB.versionNumber, overallHealthScore: versionB.overallHealthScore, overallPriorityScore: versionB.overallPriorityScore, completedAt: versionB.completedAt },
      healthScoreDelta: versionA.overallHealthScore != null && versionB.overallHealthScore != null ? Math.round((Number(versionB.overallHealthScore) - Number(versionA.overallHealthScore)) * 10) / 10 : null,
      categoryComparisons,
    });
  } catch (err) {
    logger.error({ err }, "Compare versions failed");
    res.status(500).json({ error: "Failed to compare versions." });
  }
});

// ─── Score resolution ────────────────────────────────────────

router.patch("/diagnostic-scores/:scoreId/resolution", requireAuth, async (req, res) => {
  try {
    const { scoreId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const { resolutionStatus, resolutionNotes } = req.body;
    if (!resolutionStatus || !VALID_RESOLUTION_STATUSES.includes(resolutionStatus)) {
      return void res.status(400).json({ error: "Invalid resolution status." });
    }
    const [score] = await db.select().from(diagnosticScoresTable).where(eq(diagnosticScoresTable.id, scoreId)).limit(1);
    if (!score) return void res.status(404).json({ error: "Score not found." });

    const updates: any = { resolutionStatus, updatedAt: new Date() };
    if (resolutionStatus === "resolved") {
      updates.resolvedAt = new Date();
      updates.resolvedBy = userId;
    } else {
      updates.resolvedAt = null;
      updates.resolvedBy = null;
    }
    const [updated] = await db.update(diagnosticScoresTable).set(updates).where(eq(diagnosticScoresTable.id, scoreId)).returning();

    const actType = resolutionStatus === "resolved" ? "BOTTLENECK.RESOLVED" : "BOTTLENECK.STATUS_CHANGED";
    await logActivity({ activityType: actType, description: `Bottleneck "${score.categoryLabel}" marked ${resolutionStatus}`, actorUserId: userId, entityType: "diagnostic_score", entityId: scoreId, metadata: { resolutionStatus, resolutionNotes, previousStatus: score.resolutionStatus } });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update resolution failed");
    res.status(500).json({ error: "Failed to update resolution." });
  }
});

// ─── Recommendations ─────────────────────────────────────────

router.put("/bottleneck-recommendations/:recId", requireAuth, async (req, res) => {
  try {
    const { recId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const { administratorFinalRecommendation, recommendationStatus } = req.body;
    const [rec] = await db.select().from(bottleneckRecommendationsTable).where(eq(bottleneckRecommendationsTable.id, recId)).limit(1);
    if (!rec) return void res.status(404).json({ error: "Recommendation not found." });
    if (rec.recommendationStatus === "approved") return void res.status(400).json({ error: "Cannot edit an approved recommendation." });

    const updates: any = { updatedAt: new Date() };
    if (administratorFinalRecommendation !== undefined) {
      updates.administratorFinalRecommendation = administratorFinalRecommendation;
      updates.recommendationStatus = "edited";
    }
    if (recommendationStatus !== undefined && VALID_REC_STATUSES.includes(recommendationStatus)) {
      updates.recommendationStatus = recommendationStatus;
    }

    const [updated] = await db.update(bottleneckRecommendationsTable).set(updates).where(eq(bottleneckRecommendationsTable.id, recId)).returning();
    await logActivity({ activityType: "RECOMMENDATION.EDITED", description: "Recommendation edited", actorUserId: userId, entityType: "recommendation", entityId: recId, metadata: {} });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update recommendation failed");
    res.status(500).json({ error: "Failed to update recommendation." });
  }
});

router.post("/bottleneck-recommendations/:recId/approve", requireAuth, async (req, res) => {
  try {
    const { recId } = req.params as Record<string, string>;
    const userId = (req as any).user?.id;
    const { action = "approve" } = req.body; // approve | reject | mark_implemented
    const [rec] = await db.select().from(bottleneckRecommendationsTable).where(eq(bottleneckRecommendationsTable.id, recId)).limit(1);
    if (!rec) return void res.status(404).json({ error: "Recommendation not found." });

    const now = new Date();
    const statusMap: Record<string, string> = { approve: "approved", reject: "rejected", mark_implemented: "implemented" };
    const newStatus = statusMap[action] ?? "approved";
    const updates: any = { recommendationStatus: newStatus, updatedAt: now };
    if (action === "approve") { updates.approvedBy = userId; updates.approvedAt = now; }

    const [updated] = await db.update(bottleneckRecommendationsTable).set(updates).where(eq(bottleneckRecommendationsTable.id, recId)).returning();
    const actType = action === "approve" ? "RECOMMENDATION.APPROVED" : action === "reject" ? "RECOMMENDATION.REJECTED" : "RECOMMENDATION.APPROVED";
    await logActivity({ activityType: actType, description: `Recommendation ${action}d`, actorUserId: userId, entityType: "recommendation", entityId: recId, metadata: {} });
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Approve recommendation failed");
    res.status(500).json({ error: "Failed to approve recommendation." });
  }
});

// ─── Client diagnostics ──────────────────────────────────────

router.get("/clients/:clientId/diagnostics", requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params as Record<string, string>;
    const diagnostics = await db.select({
      id: diagnosticsTable.id,
      diagnosticName: diagnosticsTable.diagnosticName,
      diagnosticType: diagnosticsTable.diagnosticType,
      status: diagnosticsTable.status,
      overallHealthScore: diagnosticsTable.overallHealthScore,
      currentVersionNumber: diagnosticsTable.currentVersionNumber,
      completedAt: diagnosticsTable.completedAt,
      createdAt: diagnosticsTable.createdAt,
      updatedAt: diagnosticsTable.updatedAt,
      projectId: diagnosticsTable.projectId,
      projectName: projectsTable.projectName,
    })
      .from(diagnosticsTable)
      .leftJoin(projectsTable, eq(diagnosticsTable.projectId, projectsTable.id))
      .where(and(eq(diagnosticsTable.clientId, clientId), isNull(diagnosticsTable.archivedAt)))
      .orderBy(desc(diagnosticsTable.updatedAt));
    res.json(diagnostics);
  } catch (err) {
    logger.error({ err }, "List client diagnostics failed");
    res.status(500).json({ error: "Failed to list client diagnostics." });
  }
});

// ─── Project diagnostics ─────────────────────────────────────

router.get("/projects/:projectId/diagnostics", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params as Record<string, string>;
    const diagnostics = await db.select({
      id: diagnosticsTable.id,
      diagnosticName: diagnosticsTable.diagnosticName,
      diagnosticType: diagnosticsTable.diagnosticType,
      status: diagnosticsTable.status,
      overallHealthScore: diagnosticsTable.overallHealthScore,
      currentVersionNumber: diagnosticsTable.currentVersionNumber,
      completedAt: diagnosticsTable.completedAt,
      createdAt: diagnosticsTable.createdAt,
      updatedAt: diagnosticsTable.updatedAt,
      clientId: diagnosticsTable.clientId,
      clientName: clientsTable.companyName,
    })
      .from(diagnosticsTable)
      .leftJoin(clientsTable, eq(diagnosticsTable.clientId, clientsTable.id))
      .where(and(eq(diagnosticsTable.projectId, projectId), isNull(diagnosticsTable.archivedAt)))
      .orderBy(desc(diagnosticsTable.updatedAt));
    res.json(diagnostics);
  } catch (err) {
    logger.error({ err }, "List project diagnostics failed");
    res.status(500).json({ error: "Failed to list project diagnostics." });
  }
});

export default router;
