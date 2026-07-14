import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, usersTable, rolesTable } from "@workspace/db";
import {
  GetSetupStatusResponse,
  CompleteSetupBody,
  CompleteSetupResponse,
  LoginBody,
  LoginResponse,
  GetCurrentUserResponse,
  UpdateAccountBody,
  UpdateAccountResponse,
  ChangePasswordBody,
} from "@workspace/api-zod";
import {
  applyRememberMe,
  hashPassword,
  loginRateLimiter,
  setupRateLimiter,
  verifyPassword,
} from "../lib/auth";
import { requireAuth } from "../middlewares/authMiddleware";
import { logActivity } from "../lib/activity";

const router: IRouter = Router();

const ADMINISTRATOR_ROLE_ID = "administrator";

async function ensureAdministratorRole(): Promise<void> {
  await db
    .insert(rolesTable)
    .values({
      id: ADMINISTRATOR_ROLE_ID,
      name: "Administrator",
      description: "Full access to the Software Factory Command Center.",
      isSystemRole: true,
    })
    .onConflictDoNothing({ target: rolesTable.id });
}

router.get("/auth/setup-status", async (req, res) => {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable);

  const data = GetSetupStatusResponse.parse({ needsSetup: Number(count) === 0 });
  res.json(data);
});

router.post("/auth/setup", setupRateLimiter, async (req, res) => {
  const body = CompleteSetupBody.parse(req.body);

  // Atomic zero-user gate: only succeeds while no users exist yet. Once the
  // first Administrator is created this endpoint is permanently closed --
  // there is no public registration in Phase 1A.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable);

  if (Number(count) > 0) {
    res.status(409).json({ error: "Setup has already been completed." });
    return;
  }

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, body.email))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  await ensureAdministratorRole();
  const passwordHash = await hashPassword(body.password);

  const [user] = await db
    .insert(usersTable)
    .values({
      email: body.email,
      passwordHash,
      fullName: body.fullName,
      roleId: ADMINISTRATOR_ROLE_ID,
    })
    .returning();

  if (!user) {
    throw new Error("Failed to create administrator account.");
  }

  req.session.userId = user.id;
  req.session.passwordChangedAt = user.passwordChangedAt.toISOString();

  await logActivity({
    activityType: "setup.completed",
    actorUserId: user.id,
    description: `${user.fullName} completed initial setup and became the Administrator.`,
    entityType: "user",
    entityId: user.id,
  });

  const data = CompleteSetupResponse.parse({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roleName: "Administrator",
    createdAt: user.createdAt,
  });
  res.status(201).json(data);
});

router.post("/auth/login", loginRateLimiter, async (req, res) => {
  const body = LoginBody.parse(req.body);

  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      fullName: usersTable.fullName,
      passwordHash: usersTable.passwordHash,
      isActive: usersTable.isActive,
      passwordChangedAt: usersTable.passwordChangedAt,
      createdAt: usersTable.createdAt,
      roleName: rolesTable.name,
    })
    .from(usersTable)
    .innerJoin(rolesTable, eq(usersTable.roleId, rolesTable.id))
    .where(eq(usersTable.email, body.email))
    .limit(1);

  const user = rows[0];

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  req.session.userId = user.id;
  req.session.passwordChangedAt = user.passwordChangedAt.toISOString();
  req.session.cookie.maxAge = applyRememberMe(
    req.session.cookie.maxAge,
    body.rememberMe ?? false,
  );

  await logActivity({
    activityType: "auth.login",
    actorUserId: user.id,
    description: `${user.fullName} logged in.`,
    entityType: "user",
    entityId: user.id,
  });

  const data = LoginResponse.parse({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    roleName: user.roleName,
    createdAt: user.createdAt,
  });
  res.json(data);
});

router.post("/auth/logout", (req, res) => {
  const userId = req.session.userId;
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to log out." });
      return;
    }
    res.clearCookie("vmos.sid");
    if (userId) {
      void logActivity({
        activityType: "auth.logout",
        actorUserId: userId,
        description: "Administrator logged out.",
        entityType: "user",
        entityId: userId,
      });
    }
    res.status(204).send();
  });
});

router.get("/auth/me", requireAuth, (req, res) => {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  const data = GetCurrentUserResponse.parse(user);
  res.json(data);
});

router.patch("/auth/account", requireAuth, async (req, res) => {
  const body = UpdateAccountBody.parse(req.body);
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ fullName: body.fullName, updatedAt: new Date() })
    .where(eq(usersTable.id, user.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Account not found." });
    return;
  }

  await logActivity({
    activityType: "account.updated",
    actorUserId: user.id,
    description: `Administrator display name updated to "${updated.fullName}".`,
    entityType: "user",
    entityId: user.id,
  });

  const data = UpdateAccountResponse.parse({
    id: updated.id,
    email: updated.email,
    fullName: updated.fullName,
    roleName: user.roleName,
    createdAt: updated.createdAt,
  });
  res.json(data);
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const body = ChangePasswordBody.parse(req.body);
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }

  const rows = await db
    .select({ passwordHash: usersTable.passwordHash })
    .from(usersTable)
    .where(eq(usersTable.id, user.id))
    .limit(1);
  const current = rows[0];

  if (!current || !(await verifyPassword(body.currentPassword, current.passwordHash))) {
    res.status(401).json({ error: "Current password is incorrect." });
    return;
  }

  const passwordHash = await hashPassword(body.newPassword);
  const changedAt = new Date();

  await db
    .update(usersTable)
    .set({ passwordHash, passwordChangedAt: changedAt, updatedAt: changedAt })
    .where(eq(usersTable.id, user.id));

  // Rotate this session's record so it stays valid after the change.
  req.session.passwordChangedAt = changedAt.toISOString();

  await logActivity({
    activityType: "account.password_changed",
    actorUserId: user.id,
    description: "Administrator changed their password.",
    entityType: "user",
    entityId: user.id,
  });

  res.status(204).send();
});

export default router;
