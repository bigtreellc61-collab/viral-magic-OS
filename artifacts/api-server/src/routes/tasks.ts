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
  tasksTable,
  projectsTable,
  clientsTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const VALID_STATUSES = ["not_started", "in_progress", "waiting", "blocked", "completed", "cancelled", "archived"];
const VALID_RESTORE_STATUSES = VALID_STATUSES.filter((s) => s !== "archived");
const VALID_PRIORITIES = ["low", "normal", "high", "urgent"];

async function fetchTaskOr404(taskId: string, res: any) {
  const rows = await db
    .select()
    .from(tasksTable)
    .where(eq(tasksTable.id, taskId))
    .limit(1);
  if (!rows[0]) {
    res.status(404).json({ error: "Task not found." });
    return null;
  }
  return rows[0];
}

// ─── List tasks ─────────────────────────────────────────────

router.get("/tasks", requireAuth, async (req, res) => {
  try {
    const {
      search = "",
      clientId,
      projectId,
      status,
      priority,
      category,
      dueDate,
      showArchived = "false",
      sort = "due_date_asc",
      page = "1",
      pageSize = "25",
    } = req.query as Record<string, string>;

    const conditions: any[] = [];

    if (showArchived === "true") {
      conditions.push(isNotNull(tasksTable.archivedAt));
    } else {
      conditions.push(isNull(tasksTable.archivedAt));
    }

    if (search) {
      conditions.push(
        or(
          ilike(tasksTable.title, `%${search}%`),
          ilike(tasksTable.description, `%${search}%`),
          ilike(tasksTable.category, `%${search}%`),
          ilike(clientsTable.companyName, `%${search}%`),
          ilike(projectsTable.projectName, `%${search}%`),
        ),
      );
    }

    if (clientId) conditions.push(eq(tasksTable.clientId, clientId));
    if (projectId) conditions.push(eq(tasksTable.projectId, projectId));
    if (status) conditions.push(eq(tasksTable.status, status));
    if (priority) conditions.push(eq(tasksTable.priority, priority));
    if (category) conditions.push(eq(tasksTable.category, category));

    const now = new Date().toISOString().slice(0, 10);
    if (dueDate) {
      const inSevenDays = new Date();
      inSevenDays.setDate(inSevenDays.getDate() + 7);
      const sevenDaysStr = inSevenDays.toISOString().slice(0, 10);
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      const endOfMonthStr = endOfMonth.toISOString().slice(0, 10);

      switch (dueDate) {
        case "overdue":
          conditions.push(isNotNull(tasksTable.dueDate));
          conditions.push(lt(tasksTable.dueDate, now));
          break;
        case "today":
          conditions.push(eq(tasksTable.dueDate, now));
          break;
        case "this_week":
          conditions.push(isNotNull(tasksTable.dueDate));
          conditions.push(sql`${tasksTable.dueDate} >= ${now} AND ${tasksTable.dueDate} <= ${sevenDaysStr}`);
          break;
        case "this_month":
          conditions.push(isNotNull(tasksTable.dueDate));
          conditions.push(sql`${tasksTable.dueDate} >= ${startOfMonthStr} AND ${tasksTable.dueDate} <= ${endOfMonthStr}`);
          break;
        case "no_due_date":
          conditions.push(isNull(tasksTable.dueDate));
          break;
      }
    }

    const sortMap: Record<string, any> = {
      due_date_asc: asc(tasksTable.dueDate),
      due_date_desc: desc(tasksTable.dueDate),
      highest_priority: sql`CASE ${tasksTable.priority} WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END ASC`,
      newest: desc(tasksTable.createdAt),
      oldest: asc(tasksTable.createdAt),
      recently_updated: desc(tasksTable.updatedAt),
    };
    const orderBy = sortMap[sort] ?? asc(tasksTable.dueDate);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));
    const offset = (pageNum - 1) * pageSizeNum;
    const where = conditions.length ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db
        .select({
          id: tasksTable.id,
          clientId: tasksTable.clientId,
          projectId: tasksTable.projectId,
          title: tasksTable.title,
          description: tasksTable.description,
          category: tasksTable.category,
          assignedUserId: tasksTable.assignedUserId,
          priority: tasksTable.priority,
          status: tasksTable.status,
          startDate: tasksTable.startDate,
          dueDate: tasksTable.dueDate,
          completionDate: tasksTable.completionDate,
          estimatedEffort: tasksTable.estimatedEffort,
          notes: tasksTable.notes,
          archivedAt: tasksTable.archivedAt,
          createdBy: tasksTable.createdBy,
          updatedBy: tasksTable.updatedBy,
          createdAt: tasksTable.createdAt,
          updatedAt: tasksTable.updatedAt,
          projectName: projectsTable.projectName,
          clientName: clientsTable.companyName,
        })
        .from(tasksTable)
        .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
        .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
        .where(where)
        .orderBy(orderBy)
        .limit(pageSizeNum)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(tasksTable)
        .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
        .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
        .where(where),
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    res.json({ data: rows, total, page: pageNum, pageSize: pageSizeNum, totalPages: Math.ceil(total / pageSizeNum) });
  } catch (err) {
    logger.error({ err }, "List tasks failed");
    res.status(500).json({ error: "Failed to list tasks." });
  }
});

// ─── Create task ────────────────────────────────────────────

router.post("/tasks", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const {
      clientId, projectId, title, description, category,
      assignedUserId, priority = "normal", status = "not_started",
      startDate, dueDate, estimatedEffort, notes,
    } = req.body;

    if (!clientId || !title?.trim() || !category || !priority || !status) {
      return res.status(400).json({ error: "Client, title, category, priority, and status are required." });
    }
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid task status." });
    }
    if (!VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority." });
    }
    if (startDate && dueDate && dueDate < startDate) {
      return res.status(400).json({ error: "Due date cannot be before start date." });
    }

    // Verify client exists
    const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId)).limit(1);
    if (!client) return res.status(400).json({ error: "Client not found." });

    // Verify project belongs to client if provided
    if (projectId) {
      const [project] = await db.select().from(projectsTable)
        .where(and(eq(projectsTable.id, projectId), eq(projectsTable.clientId, clientId))).limit(1);
      if (!project) return res.status(400).json({ error: "Project not found or does not belong to the selected client." });
    }

    const completionDate = status === "completed" ? new Date().toISOString().slice(0, 10) : null;

    const [task] = await db.insert(tasksTable).values({
      clientId, projectId: projectId || null, title: title.trim(), description,
      category, assignedUserId: assignedUserId || null, priority, status,
      startDate, dueDate, completionDate, estimatedEffort, notes,
      createdBy: userId, updatedBy: userId,
    }).returning();

    let projectName: string | null = null;
    if (projectId) {
      const [proj] = await db.select({ projectName: projectsTable.projectName }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      projectName = proj?.projectName ?? null;
    }

    await logActivity({
      activityType: "TASK.CREATED",
      description: `Task "${task.title}" created${projectName ? ` in ${projectName}` : ""}`,
      actorUserId: userId,
      entityType: "task",
      entityId: task.id,
      metadata: { taskTitle: task.title, clientId, projectId, projectName },
    });

    res.status(201).json(task);
  } catch (err) {
    logger.error({ err }, "Create task failed");
    res.status(500).json({ error: "Failed to create task." });
  }
});

// ─── Get task ───────────────────────────────────────────────

router.get("/tasks/:taskId", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const rows = await db
      .select({
        id: tasksTable.id,
        clientId: tasksTable.clientId,
        projectId: tasksTable.projectId,
        title: tasksTable.title,
        description: tasksTable.description,
        category: tasksTable.category,
        assignedUserId: tasksTable.assignedUserId,
        priority: tasksTable.priority,
        status: tasksTable.status,
        startDate: tasksTable.startDate,
        dueDate: tasksTable.dueDate,
        completionDate: tasksTable.completionDate,
        estimatedEffort: tasksTable.estimatedEffort,
        notes: tasksTable.notes,
        archivedAt: tasksTable.archivedAt,
        createdBy: tasksTable.createdBy,
        updatedBy: tasksTable.updatedBy,
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        projectName: projectsTable.projectName,
        clientName: clientsTable.companyName,
      })
      .from(tasksTable)
      .leftJoin(projectsTable, eq(tasksTable.projectId, projectsTable.id))
      .leftJoin(clientsTable, eq(tasksTable.clientId, clientsTable.id))
      .where(eq(tasksTable.id, taskId))
      .limit(1);

    if (!rows[0]) return res.status(404).json({ error: "Task not found." });
    res.json(rows[0]);
  } catch (err) {
    logger.error({ err }, "Get task failed");
    res.status(500).json({ error: "Failed to get task." });
  }
});

// ─── Update task ─────────────────────────────────────────────

router.put("/tasks/:taskId", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = (req as any).user?.id;
    const task = await fetchTaskOr404(taskId, res);
    if (!task) return;

    const {
      title, description, category, assignedUserId, priority, status,
      startDate, dueDate, estimatedEffort, notes, clientId, projectId,
    } = req.body;

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Invalid task status." });
    }
    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({ error: "Invalid priority." });
    }
    const effectiveStart = startDate ?? task.startDate;
    const effectiveDue = dueDate ?? task.dueDate;
    if (effectiveStart && effectiveDue && effectiveDue < effectiveStart) {
      return res.status(400).json({ error: "Due date cannot be before start date." });
    }

    const prevStatus = task.status;
    const updates: any = { updatedAt: new Date(), updatedBy: userId };
    if (title !== undefined) updates.title = title?.trim();
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (assignedUserId !== undefined) updates.assignedUserId = assignedUserId || null;
    if (priority !== undefined) updates.priority = priority;
    if (status !== undefined) updates.status = status;
    if (startDate !== undefined) updates.startDate = startDate;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (estimatedEffort !== undefined) updates.estimatedEffort = estimatedEffort;
    if (notes !== undefined) updates.notes = notes;
    if (clientId !== undefined) updates.clientId = clientId;
    if (projectId !== undefined) updates.projectId = projectId || null;

    // Handle completion/reopening
    if (status === "completed" && prevStatus !== "completed") {
      updates.completionDate = new Date().toISOString().slice(0, 10);
    } else if (status !== "completed" && prevStatus === "completed") {
      updates.completionDate = null;
    }

    const [updated] = await db.update(tasksTable).set(updates).where(eq(tasksTable.id, taskId)).returning();

    let logType = "TASK.UPDATED";
    let desc = `Task "${updated.title}" updated`;
    let metadata: any = { taskTitle: updated.title };

    if (status && status !== prevStatus) {
      if (status === "completed") {
        logType = "TASK.COMPLETED";
        desc = `Task "${updated.title}" completed`;
      } else if (prevStatus === "completed") {
        logType = "TASK.REOPENED";
        desc = `Task "${updated.title}" reopened as ${status}`;
      } else {
        logType = "TASK.STATUS_CHANGED";
        desc = `Task "${updated.title}" status changed from ${prevStatus} to ${status}`;
        metadata = { previousStatus: prevStatus, newStatus: status };
      }
    }

    await logActivity({
      activityType: logType,
      description: desc,
      actorUserId: userId,
      entityType: "task",
      entityId: taskId,
      metadata,
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Update task failed");
    res.status(500).json({ error: "Failed to update task." });
  }
});

// ─── Archive task ───────────────────────────────────────────

router.post("/tasks/:taskId/archive", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = (req as any).user?.id;
    const task = await fetchTaskOr404(taskId, res);
    if (!task) return;
    if (task.archivedAt) return res.status(409).json({ error: "Task is already archived." });

    const [updated] = await db.update(tasksTable)
      .set({ archivedAt: new Date(), status: "archived", updatedAt: new Date(), updatedBy: userId })
      .where(eq(tasksTable.id, taskId))
      .returning();

    await logActivity({
      activityType: "TASK.ARCHIVED",
      description: `Task "${task.title}" archived`,
      actorUserId: userId,
      entityType: "task",
      entityId: taskId,
      metadata: { taskTitle: task.title, projectId: task.projectId },
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Archive task failed");
    res.status(500).json({ error: "Failed to archive task." });
  }
});

// ─── Restore task ───────────────────────────────────────────

router.post("/tasks/:taskId/restore", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = (req as any).user?.id;
    const { status } = req.body;

    const task = await fetchTaskOr404(taskId, res);
    if (!task) return;
    if (!task.archivedAt) return res.status(409).json({ error: "Task is not archived." });
    if (!status || !VALID_RESTORE_STATUSES.includes(status)) {
      return res.status(400).json({ error: "A valid restored status is required." });
    }

    const [updated] = await db.update(tasksTable)
      .set({ archivedAt: null, status, updatedAt: new Date(), updatedBy: userId })
      .where(eq(tasksTable.id, taskId))
      .returning();

    await logActivity({
      activityType: "TASK.RESTORED",
      description: `Task "${task.title}" restored to ${status}`,
      actorUserId: userId,
      entityType: "task",
      entityId: taskId,
      metadata: { taskTitle: task.title, restoredStatus: status },
    });

    res.json(updated);
  } catch (err) {
    logger.error({ err }, "Restore task failed");
    res.status(500).json({ error: "Failed to restore task." });
  }
});

// ─── Delete task ────────────────────────────────────────────

router.delete("/tasks/:taskId", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = (req as any).user?.id;
    const task = await fetchTaskOr404(taskId, res);
    if (!task) return;
    if (!task.archivedAt) {
      return res.status(409).json({ error: "Only archived tasks can be permanently deleted." });
    }

    await logActivity({
      activityType: "TASK.DELETED",
      description: `Task "${task.title}" permanently deleted`,
      actorUserId: userId,
      entityType: "task",
      entityId: taskId,
      metadata: { taskTitle: task.title },
    });

    await db.delete(tasksTable).where(eq(tasksTable.id, taskId));
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Delete task failed");
    res.status(500).json({ error: "Failed to delete task." });
  }
});

// ─── Task metrics (for tasks list page) ─────────────────────

router.get("/tasks/metrics/summary", requireAuth, async (req, res) => {
  try {
    const now = new Date().toISOString().slice(0, 10);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    const startOfMonthStr = startOfMonth.toISOString().slice(0, 10);

    const [open, inProgress, overdue, blocked, completedThisMonth] = await Promise.all([
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
      db.select({ count: sql<number>`count(*)` }).from(tasksTable)
        .where(and(
          isNull(tasksTable.archivedAt),
          eq(tasksTable.status, "completed"),
          sql`${tasksTable.completionDate} >= ${startOfMonthStr}`,
        )),
    ]);

    res.json({
      open: Number(open[0]?.count ?? 0),
      inProgress: Number(inProgress[0]?.count ?? 0),
      overdue: Number(overdue[0]?.count ?? 0),
      blocked: Number(blocked[0]?.count ?? 0),
      completedThisMonth: Number(completedThisMonth[0]?.count ?? 0),
    });
  } catch (err) {
    logger.error({ err }, "Task metrics failed");
    res.status(500).json({ error: "Failed to get task metrics." });
  }
});

export default router;
