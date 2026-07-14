import type { NextFunction, Request, Response } from "express";
import { db, usersTable, rolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  roleName: string;
  createdAt: Date;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

/**
 * Loads the session's user, verifying the account is still active and that
 * the session predates the user's most recent password change (so changing
 * a password invalidates any older sessions). Responds 401 when the
 * session is missing, stale, or the account no longer exists/is inactive.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.session.userId;

  if (!userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      isActive: usersTable.isActive,
      passwordChangedAt: usersTable.passwordChangedAt,
      createdAt: usersTable.createdAt,
      roleName: rolesTable.name,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.id, userId))
    .limit(1);

  const user = rows[0];

  if (!user || !user.isActive) {
    req.session.destroy(() => undefined);
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const sessionPasswordChangedAt = req.session.passwordChangedAt;
  if (
    sessionPasswordChangedAt &&
    new Date(sessionPasswordChangedAt).getTime() !==
      user.passwordChangedAt.getTime()
  ) {
    req.session.destroy(() => undefined);
    res.status(401).json({ error: "Session expired. Please log in again." });
    return;
  }

  req.authUser = {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roleName: user.roleName,
    createdAt: user.createdAt,
  };

  next();
}
