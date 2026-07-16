/**
 * Administrator Password Recovery Script
 *
 * PURPOSE: One-time recovery when the administrator password has been changed
 *          outside the normal application workflow (e.g., by an automated test)
 *          and the admin cannot log in.
 *
 * USAGE:
 *   1. In Replit Secrets, set ADMIN_RECOVERY_TOKEN to any secret value (acts as
 *      an authorization gate so this script cannot be run accidentally).
 *   2. In Replit Secrets, set ADMIN_NEW_PASSWORD to the desired new password
 *      (minimum 10 characters).
 *   3. Run from the project root:
 *        node scripts/admin-recovery.mjs
 *   4. After recovery, remove or clear ADMIN_RECOVERY_TOKEN and ADMIN_NEW_PASSWORD
 *      from Replit Secrets.
 *
 * SECURITY:
 *   - Requires ADMIN_RECOVERY_TOKEN to prevent accidental execution.
 *   - The new password is read from a Replit Secret — never hard-coded.
 *   - Password is hashed with bcrypt (cost=12) before storage.
 *   - All existing sessions for the administrator are deleted so stale
 *     sessions cannot be used after recovery.
 *   - No password values are printed to stdout or logs.
 */

import pg from "pg";
import bcrypt from "bcryptjs";

const { Pool } = pg;

// ── Authorization gate ──────────────────────────────────────────────────────
const recoveryToken = process.env["ADMIN_RECOVERY_TOKEN"];
if (!recoveryToken) {
  console.error(
    "ERROR: ADMIN_RECOVERY_TOKEN secret is not set.\n" +
      "Set it in Replit Secrets before running this script.",
  );
  process.exit(1);
}

const newPassword = process.env["ADMIN_NEW_PASSWORD"];
if (!newPassword) {
  console.error(
    "ERROR: ADMIN_NEW_PASSWORD secret is not set.\n" +
      "Set it in Replit Secrets before running this script.",
  );
  process.exit(1);
}

if (newPassword.length < 10) {
  console.error(
    "ERROR: ADMIN_NEW_PASSWORD must be at least 10 characters long.",
  );
  process.exit(1);
}

const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  console.error(
    "ERROR: DATABASE_URL is not set. Ensure the database is provisioned.",
  );
  process.exit(1);
}

// ── Recovery ────────────────────────────────────────────────────────────────
const pool = new Pool({ connectionString: databaseUrl });

try {
  // Find the administrator account.
  const userResult = await pool.query(
    `SELECT users.id, users.email, users.full_name FROM users
     INNER JOIN roles ON users.role_id = roles.id
     WHERE roles.id = 'administrator'
     LIMIT 1`,
  );

  if (userResult.rows.length === 0) {
    console.error("ERROR: No administrator account found in the database.");
    process.exit(1);
  }

  const user = userResult.rows[0];
  console.log(`Found administrator: ${user.full_name} <${user.email}>`);

  // Hash the new password.
  const now = new Date();
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update the password hash and reset passwordChangedAt.
  await pool.query(
    `UPDATE users
     SET password_hash = $1,
         password_changed_at = $2,
         updated_at = $2
     WHERE id = $3`,
    [passwordHash, now, user.id],
  );

  // Invalidate ALL existing sessions for this user.
  const deleteResult = await pool.query(
    `DELETE FROM session WHERE sess->>'userId' = $1`,
    [user.id],
  );

  console.log(`Password updated successfully.`);
  console.log(`Sessions invalidated: ${deleteResult.rowCount}`);
  console.log(
    `\nYou may now log in with the email "${user.email}" and the new password you set in ADMIN_NEW_PASSWORD.`,
  );
  console.log(
    `\nIMPORTANT: Remove ADMIN_RECOVERY_TOKEN and ADMIN_NEW_PASSWORD from Replit Secrets after logging in.`,
  );
} catch (err) {
  console.error("ERROR during recovery:", err.message);
  process.exit(1);
} finally {
  await pool.end();
}
