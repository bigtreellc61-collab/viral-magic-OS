import { db, activityRecordsTable } from "@workspace/db";
import { logger } from "./logger";

export interface LogActivityInput {
  activityType: string;
  description: string;
  actorUserId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Records an activity entry for the dashboard's recent activity feed.
 * Failures are swallowed so that activity logging never breaks the primary
 * request flow, but they are always surfaced via logger.warn for observability.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await db.insert(activityRecordsTable).values({
      activityType: input.activityType,
      description: input.description,
      actorUserId: input.actorUserId ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    logger.warn({ err, activityType: input.activityType }, "Activity logging failed — primary operation unaffected");
  }
}
