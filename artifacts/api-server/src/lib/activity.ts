import { db, activityRecordsTable } from "@workspace/db";

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
 * Failures are swallowed (logged by the caller if needed) so that activity
 * logging never breaks the primary request flow.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  await db.insert(activityRecordsTable).values({
    activityType: input.activityType,
    description: input.description,
    actorUserId: input.actorUserId ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? null,
  });
}
