import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, activityRecordsTable, usersTable } from "@workspace/db";
import { ListActivityQueryParams, ListActivityResponse } from "@workspace/api-zod";
import { requireAuth } from "../middlewares/authMiddleware";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

export async function fetchRecentActivity(limit: number) {
  const rows = await db
    .select({
      id: activityRecordsTable.id,
      activityType: activityRecordsTable.activityType,
      description: activityRecordsTable.description,
      entityType: activityRecordsTable.entityType,
      entityId: activityRecordsTable.entityId,
      createdAt: activityRecordsTable.createdAt,
      actorName: usersTable.fullName,
    })
    .from(activityRecordsTable)
    .leftJoin(usersTable, eq(activityRecordsTable.actorUserId, usersTable.id))
    .orderBy(desc(activityRecordsTable.createdAt))
    .limit(limit);

  return rows;
}

router.get("/activity", requireAuth, async (req, res) => {
  const query = ListActivityQueryParams.parse(req.query);
  const rows = await fetchRecentActivity(query.limit);
  const data = ListActivityResponse.parse(rows);
  res.json(data);
});

export default router;
