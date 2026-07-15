import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  sql,
  inArray,
  lt,
} from "drizzle-orm";
import {
  db,
  projectsTable,
  tasksTable,
  clientsTable,
  activityRecordsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────

const VALID_STATUSES = [
  "discovery", "diagnostic", "planning", "approved", "building",
  "testing", "client_review", "completed", "on_hold", "cancelled", "archived",
];
const VALID_RESTORE_STATUSES = VALID_STATUSES.filter((s) => s !== "archived");
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

async function fetchProjectOr404(projectId: string, res: any) {
  const rows = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Project not found." });
    return null;
  }
  return rows[0];
}

// ─── Dashboard metrics ──────────────────────────────────────

router.get("/dashboard/projects", requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Project counts
    const [
      totalProjectsRow,
      activeProjectsRow,
      completedProjectsRow,
      onHoldProjectsRow,
      overdueProjectsRow,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(isNull(projectsTable.archivedAt)),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(
          isNull(projectsTable.archivedAt),
          inArray(projectsTable.projectStatus, ["discovery", "diagnostic", "planning", "approved", "building", "testing", "client_review"]),
        )),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(isNull(projectsTable.archivedAt), eq(projectsTable.projectStatus, "completed"))),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(isNull(projectsTable.archivedAt), eq(projectsTable.projectStatus, "on_hold"))),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(
          isNull(projectsTable.archivedAt),
          isNotNull(projectsTable.targetCompletionDate),
          lt(projectsTable.targetCompletionDate, now),
          inArray(projectsTable.projectStatus, ["discovery", "diagnostic", "planning", "approved", "building", "testing", "client_review"]),
        )),
    ]);

    // Task counts
    const [openTasksRow, inProgressTasksRow, overdueTasksRow, blockedTasksRow] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(isNull(tasksTable.archivedAt), eq(tasksTable.status, "not_started"))),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(isNull(tasksTable.archivedAt), eq(tasksTable.status, "in_progress"))),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(
          isNull(tasksTable.archivedAt),
          isNotNull(tasksTable.dueDate),
          lt(tasksTable.dueDate, now),
          inArray(tasksTable.status, ["not_started", "in_progress", "waiting", "blocked"]),
        )),
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(isNull(tasksTable.archivedAt), eq(tasksTable.status, "blocked"))),
    ]);

    // Projects due in 7 days
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    const sevenDaysStr = inSevenDays.toISOString().slice(0, 10);
    const [dueSoonRow] = await db.select({ count: sql<number>`count(*)` }).from(projectsTable)
      .where(and(
        isNull(projectsTable.archivedAt),
        isNotNull(projectsTable.targetCompletionDate),
        sql`${projectsTable.targetCompletionDate} >= ${now}`,
        sql`${projectsTable.targetCompletionDate} <= ${sevenDaysStr}`,
        inArray(projectsTable.projectStatus, ["discovery", "diagnostic", "planning", "approved", "building", "testing", "client_review"]),
      ));

    // Pipeline: project count by status
    const pipeline = await db
      .select({ status: projectsTable.projectStatus, count: sql<number>`count(*)` })
      .from(projectsTable)
      .where(isNull(projectsTable.archivedAt))
      .groupBy(projectsTable.projectStatus);

    // Recent projects (5)
    const recentProjects = await db
      .select({
        id: projectsTable.id,
        projectName: projectsTable.projectName,
        projectStatus: projectsTable.projectStatus,
        priority: projectsTable.priority,
        projectType: projectsTable.projectType,
        targetCompletionDate: projectsTable.targetCompletionDate,
        updatedAt: projectsTable.updatedAt,
        clientId: projectsTable.clientId,
        clientName: clientsTable.companyName,
      })
      .from(projectsTable)
      .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
      .where(isNull(projectsTable.archivedAt))
      .orderBy(desc(projectsTable.updatedAt))
      .limit(5);

    // Tasks due this week
    const tasksDueThisWeek = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        projectId: tasksTable.projectId,
        projectName: projectsTable.projectName,
        clientId: tasksTable.clientId,
        clientName: clientsTable.companyName,
      })
      .from(tasksTable)
      .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(and(
        isNull(tasksTable.archivedAt),
        isNotNull(tasksTable.dueDate),
        sql`${tasksTable.dueDate} >= ${now}`,
        sql`${tasksTable.dueDate} <= ${sevenDaysStr}`,
        inArray(tasksTable.status, ["not_started", "in_progress", "waiting", "blocked"]),
      ))
      .orderBy(asc(tasksTable.dueDate))
      .limit(10);

    // Overdue tasks
    const overdueTasks = await db
      .select({
        id: tasksTable.id,
        title: tasksTable.title,
        status: tasksTable.status,
        priority: tasksTable.priority,
        dueDate: tasksTable.dueDate,
        projectId: tasksTable.projectId,
        projectName: projectsTable.projectName,
        clientId: tasksTable.clientId,
        clientName: clientsTable.companyName,
      })
      .from(tasksTable)
      .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(and(
        isNull(tasksTable.archivedAt),
        isNotNull(tasksTable.dueDate),
        lt(tasksTable.dueDate, now),
        inArray(tasksTable.status, ["not_started", "in_progress", "waiting", "blocked"]),
      ))
      .orderBy(asc(tasksTable.dueDate))
      .limit(10);

    // Completed this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);
    const [completedThisMonthRow] = await db.select({ count: sql<number>`count(*)` }).from(tasksTable)
      .where(and(
        isNull(tasksTable.archivedAt),
        eq(tasksTable.status, "completed"),
        sql`${tasksTable.completionDate} >= ${startOfMonthStr}`,
      ));

    // Recent activity (combined project + task)
    const recentActivity = await db
      .select()
      .from(activityRecordsTable)
      .where(inArray(activityRecordsTable.activityType, [
        "PROJECT.CREATED", "PROJECT.UPDATED", "PROJECT.STATUS_CHANGED",
        "PROJECT.ARCHIVED", "PROJECT.RESTORED", "PROJECT.DELETED",
        "TASK.CREATED", "TASK.UPDATED", "TASK.STATUS_CHANGED",
        "TASK.COMPLETED", "TASK.REOPENED", "TASK.ARCHIVED",
        "TASK.RESTORED", "TASK.DELETED",
        "CLIENT.CREATED", "CLIENT.UPDATED", "CLIENT.ARCHIVED", "CLIENT.RESTORED",
      ]))
      .orderBy(desc(activityRecordsTable.createdAt))
      .limit(15);

    res.json({
      projects: {
        total: Number(totalProjectsRow[0]?.count ?? 0),
        active: Number(activeProjectsRow[0]?.count ?? 0),
        completed: Number(completedProjectsRow[0]?.count ?? 0),
        onHold: Number(onHoldProjectsRow[0]?.count ?? 0),
        overdue: Number(overdueProjectsRow[0]?.count ?? 0),
        dueSoon: Number(dueSoonRow?.count ?? 0),
        pipeline: pipeline.map((r) => ({ status: r.status, count: Number(r.count) })),
        recentProjects,
      },
      tasks: {
        open: Number(openTasksRow[0]?.count ?? 0),
        inProgress: Number(inProgressTasksRow[0]?.count ?? 0),
        overdue: Number(overdueTasksRow[0]?.count ?? 0),
        blocked: Number(blockedTasksRow[0]?.count ?? 0),
        completedThisMonth: Number(completedThisMonthRow?.count ?? 0),
        tasksDueThisWeek,
        overdueTasks,
      },
      recentActivity,
    });
  } catch (err) {
    logger.error({ err }, "Dashboard projects metrics failed");
    res.status(500).json({ error: "Failed to load dashboard metrics." });
  }
});

// ─── List projects ──────────────────────────────────────────

router.get("/projects", requireAuth, async (req, res) => {
  try {
    const {
      search = "",
      clientId,
      status,
      priority,
      projectType,
      selectedPlatform,
      showArchived = "false",
      sort = "newest",
      page = "1",
      pageSize = "25",
    } = req.query as Record<string, string>;

    const conditions: any[] = [];

    if (showArchived === "true") {
      conditions.push(isNotNull(projectsTable.archivedAt));
    } else {
      conditions.push(isNull(projectsTable.archivedAt));
    }

    if (search) {
      conditions.push(
        or(
          ilike(projectsTable.projectName, `%${search}%`),
          ilike(projectsTable.projectType, `%${search}%`),
          ilike(projectsTable.selectedPlatform, `%${search}%`),
          ilike(projectsTable.businessProblem, `%${search}%`),
          ilike(projectsTable.desiredBusinessOutcome, `%${search}%`),
          ilike(clientsTable.companyName, `%${search}%`),
        ),
      );
    }
    if (clientId) conditions.push(eq(projectsTable.clientId, clientId));
    if (status) conditions.push(eq(projectsTable.projectStatus, status));
    if (priority) conditions.push(eq(projectsTable.priority, priority));
    if (projectType) conditions.push(eq(projectsTable.projectType, projectType));
    if (selectedPlatform) conditions.push(eq(projectsTable.selectedPlatform, selectedPlatform));

    const sortMap: Record<string, any> = {
      newest: desc(projectsTable.createdAt),
      oldest: asc(projectsTable.createdAt),
      name_asc: asc(projectsTable.projectName),
      name_desc: desc(projectsTable.projectName),
      recently_updated: desc(projectsTable.updatedAt),
      target_date: asc(projectsTable.targetCompletionDate),
      highest_value: desc(projectsTable.estimatedProjectValue),
      highest_priority: sql`CASE ${projectsTable.priority} WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END ASC`,
    };
    const orderBy = sortMap[sort] ?? desc(projectsTable.createdAt);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
    const offset = (pageNum - 1) * pageSizeNum;

    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: projectsTable.id,
          clientId: projectsTable.clientId,
          projectName: projectsTable.projectName,
          projectType: projectsTable.projectType,
          projectDescription: projectsTable.projectDescription,
          businessProblem: projectsTable.businessProblem,
          desiredBusinessOutcome: projectsTable.desiredBusinessOutcome,
          recommendedSolution: projectsTable.recommendedSolution,
          selectedPlatform: projectsTable.selectedPlatform,
          projectStatus: projectsTable.projectStatus,
          priority: projectsTable.priority,
          estimatedProjectValue: projectsTable.estimatedProjectValue,
          estimatedMonthlyRecurringRevenue: projectsTable.estimatedMonthlyRecurringRevenue,
          startDate: projectsTable.startDate,
          targetCompletionDate: projectsTable.targetCompletionDate,
          actualCompletionDate: projectsTable.actualCompletionDate,
          projectOwner: projectsTable.projectOwner,
          internalNotes: projectsTable.internalNotes,
          archivedAt: projectsTable.archivedAt,
          createdBy: projectsTable.createdBy,
          updatedBy: projectsTable.updatedBy,
          createdAt: projectsTable.createdAt,
          updatedAt: projectsTable.updatedAt,
          clientName: clientsTable.companyName,
          clientContactFirst: clientsTable.contactFirstName,
          clientContactLast: clientsTable.contactLastName,
        })
        .from(projectsTable)
        .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
        .where(where)
        .orderBy(orderBy)
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(projectsTable)
        .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
        .where(where),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data: rows, total, page: pageNum, pageSize: pageSizeNum, totalPages: Math.ceil(total / pageSizeNum) });
  } catch (err) {
    logger.error({ err }, "List projects failed");
    res.status(500).json({ error: "Failed to list projects." });
  }
});

// ─── Create project ─────────────────────────────────────────

router.post("/projects", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const {
      clientId, projectName, projectType, projectDescription,
      businessProblem, desiredBusinessOutcome, recommendedSolution,
      selectedPlatform, projectStatus = "discovery", priority = "normal",
      estimatedProjectValue, estimatedMonthlyRecurringRevenue,
      startDate, targetCompletionDate, projectOwner, internalNotes,
    } = req.body;

    if (!clientId || !projectName?.trim() || !projectType || !projectStatus || !priority) {
      return res.status(400).json({ error: "Client, project name, type, status, and priority are required." });
    }
    if (!VALID_STATUSES.includes(projectStatus)) {
      return res.status(400).json({ error: "Invalid project status." });
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority." });
    }
    if (startDate && targetCompletionDate && targetCompletionDate < startDate) {
      return res.status(400).json({ error: "Target completion date cannot be before start date." });
    }

    // Verify client exists
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client) return res.status(400).json({ error: "Client not found." });

    const [project] = await db.insert(projectsTable).values({
      clientId, projectName: projectName.trim(), projectType,
      projectDescription, businessProblem, desiredBusinessOutcome,
      recommendedSolution, selectedPlatform, projectStatus, priority,
      estimatedProjectValue: estimatedProjectValue?.toString() ?? null,
      estimatedMonthlyRecurringRevenue: estimatedMonthlyRecurringRevenue?.toString() ?? null,
      startDate, targetCompletionDate, projectOwner, internalNotes,
      createdBy: userId, updatedBy: userId,
    }).returning();

    await logActivity({
      activityType: "PROJECT.CREATED",
      description: `Project "${project.projectName}" created`,
      actorUserId: userId,
      entityType: "project",
      entityId: project.id,
      metadata: { projectName: project.projectName, clientId, clientName: client.companyName },
    });

    res.status(201).json(project);
  } catch (err) {
    logger.error({ err }, "Create project failed");
    res.status(500).json({ error: "Failed to create project." });
  }
});

// ─── Get project ────────────────────────────────────────────

router.get("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const rows = await db
      .select({
        id: projectsTable.id,
        clientId: projectsTable.clientId,
        projectName: projectsTable.projectName,
        projectType: projectsTable.projectType,
        projectDescription: projectsTable.projectDescription,
        businessProblem: projectsTable.businessProblem,
        desiredBusinessOutcome: projectsTable.desiredBusinessOutcome,
        recommendedSolution: projectsTable.recommendedSolution,
        selectedPlatform: projectsTable.selectedPlatform,
        projectStatus: projectsTable.projectStatus,
        priority: projectsTable.priority,
        estimatedProjectValue: projectsTable.estimatedProjectValue,
        estimatedMonthlyRecurringRevenue: projectsTable.estimatedMonthlyRecurringRevenue,
        startDate: projectsTable.startDate,
        targetCompletionDate: projectsTable.targetCompletionDate,
        actualCompletionDate: projectsTable.actualCompletionDate,
        projectOwner: projectsTable.projectOwner,
        internalNotes: projectsTable.internalNotes,
        archivedAt: projectsTable.archivedAt,
        createdBy: projectsTable.createdBy,
        updatedBy: projectsTable.updatedBy,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
        clientName: clientsTable.companyName,
        clientContactFirst: clientsTable.contactFirstName,
        clientContactLast: clientsTable.contactLastName,
      })
      .from(projectsTable)
      .leftJoin(clientsTable, eq(projectsTable.clientId, clientsTable.id))
      .where(eq(projectsTable.id, projectId))
      .limit(1);

    if (!rows[0]) return res.status(404).json({ error: "Project not found." });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "Get project failed");
    res.status(500).json({ error: "Failed to get project." });
  }
});

// ─── Update project ─────────────────────────────────────────

router.put("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    const project = await fetchProjectOr404(projectId, res);
    if (!project) return;

    const {
      projectName, projectType, projectDescription,
      businessProblem, desiredBusinessOutcome, recommendedSolution,
      selectedPlatform, projectStatus, priority,
      estimatedProjectValue, estimatedMonthlyRecurringRevenue,
      startDate, targetCompletionDate, actualCompletionDate,
      projectOwner, internalNotes,
    } = req.body;

    if (projectStatus && !VALID_STATUSES.includes(projectStatus)) {
      return res.status(400).json({ error: "Invalid project status." });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority." });
    }
    const effectiveStart = startDate ?? project.startDate;
    const effectiveTarget = targetCompletionDate ?? project.targetCompletionDate;
    if (effectiveStart && effectiveTarget && effectiveTarget < effectiveStart) {
      return res.status(400).json({ error: "Target completion date cannot be before start date." });
    }

    const prevStatus = project.projectStatus;
    const updates: any = { updatedAt: new Date(), updatedBy: userId };
    if (projectName !== undefined) updates.projectName = projectName?.trim();
    if (projectType !== undefined) updates.projectType = projectType;
    if (projectDescription !== undefined) updates.projectDescription = projectDescription;
    if (businessProblem !== undefined) updates.businessProblem = businessProblem;
    if (desiredBusinessOutcome !== undefined) updates.desiredBusinessOutcome = desiredBusinessOutcome;
    if (recommendedSolution !== undefined) updates.recommendedSolution = recommendedSolution;
    if (selectedPlatform !== undefined) updates.selectedPlatform = selectedPlatform;
    if (projectStatus !== undefined) updates.projectStatus = projectStatus;
    if (priority !== undefined) updates.priority = priority;
    if (estimatedProjectValue !== undefined) updates.estimatedProjectValue = estimatedProjectValue?.toString() ?? null;
    if (estimatedMonthlyRecurringRevenue !== undefined) updates.estimatedMonthlyRecurringRevenue = estimatedMonthlyRecurringRevenue?.toString() ?? null;
    if (startDate !== undefined) updates.startDate = startDate;
    if (targetCompletionDate !== undefined) updates.targetCompletionDate = targetCompletionDate;
    if (actualCompletionDate !== undefined) updates.actualCompletionDate = actualCompletionDate;
    if (projectOwner !== undefined) updates.projectOwner = projectOwner;
    if (internalNotes !== undefined) updates.internalNotes = internalNotes;

    // If completing, set actualCompletionDate if not provided
    if (projectStatus === "completed" && !updates.actualCompletionDate && !project.actualCompletionDate) {
      updates.actualCompletionDate = new Date().toISOString().slice(0, 10);
    }

    const [updated] = await db.update(projectsTable).set(updates).where(eq(projectsTable.id, projectId)).returning();

    const logType = projectStatus && projectStatus !== prevStatus ? "PROJECT.STATUS_CHANGED" : "PROJECT.UPDATED";
    await logActivity({
      activityType: logType,
      description: projectStatus && projectStatus !== prevStatus
        ? `Project "${updated.projectName}" status changed from ${prevStatus} to ${projectStatus}`
        : `Project "${updated.projectName}" updated`,
      actorUserId: userId,
      entityType: "project",
      entityId: projectId,
      metadata: projectStatus && projectStatus !== prevStatus
        ? { previousStatus: prevStatus, newStatus: projectStatus }
        : { projectName: updated.projectName },
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update project failed");
    res.status(500).json({ error: "Failed to update project." });
  }
});

// ─── Archive project ────────────────────────────────────────

router.post("/projects/:projectId/archive", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    const project = await fetchProjectOr404(projectId, res);
    if (!project) return;
    if (project.archivedAt) return res.status(409).json({ error: "Project is already archived." });

    const [updated] = await db.update(projectsTable)
      .set({ archivedAt: new Date(), projectStatus: "archived", updatedAt: new Date(), updatedBy: userId })
      .where(eq(projectsTable.id, projectId))
      .returning();

    await logActivity({
      activityType: "PROJECT.ARCHIVED",
      description: `Project "${project.projectName}" archived`,
      actorUserId: userId,
      entityType: "project",
      entityId: projectId,
      metadata: { projectName: project.projectName },
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Archive project failed");
    res.status(500).json({ error: "Failed to archive project." });
  }
});

// ─── Restore project ────────────────────────────────────────

router.post("/projects/:projectId/restore", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    const { status, restoreTasks = false } = req.body;

    const project = await fetchProjectOr404(projectId, res);
    if (!project) return;
    if (!project.archivedAt) return res.status(409).json({ error: "Project is not archived." });
    if (!status || !VALID_RESTORE_STATUSES.includes(status)) {
      return res.status(400).json({ error: "A valid restored status is required." });
    }

    await db.transaction(async (tx) => {
      await tx.update(projectsTable)
        .set({ archivedAt: null, projectStatus: status, updatedAt: new Date(), updatedBy: userId })
        .where(eq(projectsTable.id, projectId));

      if (restoreTasks) {
        await tx.update(tasksTable)
          .set({ archivedAt: null, status: "not_started", updatedAt: new Date(), updatedBy: userId })
          .where(and(eq(tasksTable.projectId, projectId), isNotNull(tasksTable.archivedAt)));
      }
    });

    await logActivity({
      activityType: "PROJECT.RESTORED",
      description: `Project "${project.projectName}" restored to ${status}`,
      actorUserId: userId,
      entityType: "project",
      entityId: projectId,
      metadata: { projectName: project.projectName, restoredStatus: status, restoreTasks },
    });

    const [updated] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Restore project failed");
    res.status(500).json({ error: "Failed to restore project." });
  }
});

// ─── Delete project ─────────────────────────────────────────

router.delete("/projects/:projectId", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = (req as any).user?.id;
    const project = await fetchProjectOr404(projectId, res);
    if (!project) return;
    if (!project.archivedAt) {
      return res.status(409).json({ error: "Only archived projects can be permanently deleted." });
    }

    await logActivity({
      activityType: "PROJECT.DELETED",
      description: `Project "${project.projectName}" permanently deleted`,
      actorUserId: userId,
      entityType: "project",
      entityId: projectId,
      metadata: { projectName: project.projectName },
    });

    await db.transaction(async (tx) => {
      await tx.delete(tasksTable).where(eq(tasksTable.projectId, projectId));
      await tx.delete(projectsTable).where(eq(projectsTable.id, projectId));
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Delete project failed");
    res.status(500).json({ error: "Failed to delete project." });
  }
});

// ─── Project progress ───────────────────────────────────────

router.get("/projects/:projectId/progress", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await fetchProjectOr404(projectId, res);
    if (!project) return;

    const allTasks = await db
      .select({ status: tasksTable.status })
      .from(tasksTable)
      .where(and(
        eq(tasksTable.projectId, projectId),
        isNull(tasksTable.archivedAt),
      ));

    const countable = allTasks.filter((t) => t.status !== "cancelled");
    const completed = countable.filter((t) => t.status === "completed").length;
    const open = countable.filter((t) => ["not_started", "in_progress", "waiting"].includes(t.status)).length;
    const blocked = countable.filter((t) => t.status === "blocked").length;
    const total = countable.length;

    const now = new Date().toISOString().slice(0, 10);
    const overdue = allTasks.length > 0
      ? (await db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(
          eq(tasksTable.projectId, projectId),
          isNull(tasksTable.archivedAt),
          isNotNull(tasksTable.dueDate),
          lt(tasksTable.dueDate, now),
          inArray(tasksTable.status, ["not_started", "in_progress", "waiting", "blocked"]),
        )))[0]?.count ?? 0
      : 0;

    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    res.json({ percentage, completed, open, blocked, total, overdue: Number(overdue) });
  } catch (err) {
    logger.error({ err }, "Project progress failed");
    res.status(500).json({ error: "Failed to calculate progress." });
  }
});

// ─── Project activity ───────────────────────────────────────

router.get("/projects/:projectId/activity", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await fetchProjectOr404(projectId, res);
    if (!project) return;

    const rows = await db
      .select()
      .from(activityRecordsTable)
      .where(and(
        eq(activityRecordsTable.entityId, projectId),
        eq(activityRecordsTable.entityType, "project"),
      ))
      .orderBy(desc(activityRecordsTable.createdAt))
      .limit(50);

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Project activity failed");
    res.status(500).json({ error: "Failed to get project activity." });
  }
});

// ─── Client projects ────────────────────────────────────────

router.get("/clients/:clientId/projects", requireAuth, async (req, res) => {
  try {
    const { clientId } = req.params;
    const { showArchived = "false" } = req.query as Record<string, string>;

    const conditions = [eq(projectsTable.clientId, clientId)];
    if (showArchived !== "true") conditions.push(isNull(projectsTable.archivedAt));

    const rows = await db
      .select()
      .from(projectsTable)
      .where(and(...conditions))
      .orderBy(desc(projectsTable.updatedAt));

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Client projects failed");
    res.status(500).json({ error: "Failed to get client projects." });
  }
});

// ─── Project metrics (for projects list page) ───────────────

router.get("/projects/metrics/summary", requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString().slice(0, 10);

    const [total, active, completed, onHold, overdue] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(projectsTable).where(isNull(projectsTable.archivedAt)),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(isNull(projectsTable.archivedAt), inArray(projectsTable.projectStatus, ["discovery", "diagnostic", "planning", "approved", "building", "testing", "client_review"]))),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(isNull(projectsTable.archivedAt), eq(projectsTable.projectStatus, "completed"))),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(isNull(projectsTable.archivedAt), eq(projectsTable.projectStatus, "on_hold"))),
      db.select({ count: sql<number>`count(*)` }).from(projectsTable)
        .where(and(
          isNull(projectsTable.archivedAt),
          isNotNull(projectsTable.targetCompletionDate),
          lt(projectsTable.targetCompletionDate, now),
          inArray(projectsTable.projectStatus, ["discovery", "diagnostic", "planning", "approved", "building", "testing", "client_review"]),
        )),
    ]);

    res.json({
      total: Number(total[0]?.count ?? 0),
      active: Number(active[0]?.count ?? 0),
      completed: Number(completed[0]?.count ?? 0),
      onHold: Number(onHold[0]?.count ?? 0),
      overdue: Number(overdue[0]?.count ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "Project metrics failed");
    res.status(500).json({ error: "Failed to get project metrics." });
  }
});

// ─── Project tasks ──────────────────────────────────────────

router.get("/projects/:projectId/tasks", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { showArchived = "false", status, priority, category } = req.query as Record<string, string>;

    const conditions: any[] = [eq(tasksTable.projectId, projectId)];
    if (showArchived === "true") {
      conditions.push(isNotNull(tasksTable.archivedAt));
    } else {
      conditions.push(isNull(tasksTable.archivedAt));
    }
    if (status) conditions.push(eq(tasksTable.status, status));
    if (priority) conditions.push(eq(tasksTable.priority, priority));
    if (category) conditions.push(eq(tasksTable.category, category));

    const rows = await db
      .select()
      .from(tasksTable)
      .where(and(...conditions))
      .orderBy(
        sql`CASE ${tasksTable.priority} WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END`,
        asc(tasksTable.dueDate),
        desc(tasksTable.createdAt),
      );

    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Project tasks failed");
    res.status(500).json({ error: "Failed to get project tasks." });
  }
});

export default router;
