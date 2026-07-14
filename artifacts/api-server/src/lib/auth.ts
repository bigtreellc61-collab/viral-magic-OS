import bcrypt from "bcryptjs";
import type { RequestHandler } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import pgSession from "connect-pg-simple";
import { pool } from "@workspace/db";

const SESSION_SECRET = process.env["SESSION_SECRET"];

if (!SESSION_SECRET) {
  throw new Error(
    "SESSION_SECRET environment variable is required but was not provided.",
  );
}

const PgStore = pgSession(session);

// connect-pg-simple manages its own "session" table via createTableIfMissing.
// It is intentionally not part of the Drizzle-managed schema.
const store = new PgStore({
  pool,
  tableName: "session",
  createTableIfMissing: true,
});

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const sessionMiddleware: RequestHandler = session({
  store,
  secret: SESSION_SECRET,
  name: "vmos.sid",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    maxAge: EIGHT_HOURS_MS,
  },
});

/** Extends the cookie lifetime for "remember me" logins. */
export function applyRememberMe(maxAge: number | undefined, rememberMe: boolean): number {
  return rememberMe ? THIRTY_DAYS_MS : (maxAge ?? EIGHT_HOURS_MS);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Rate limiter applied to the login endpoint to slow down credential guessing. */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

/** Rate limiter applied to the one-time setup endpoint. */
export const setupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many setup attempts. Please try again later." },
});

declare module "express-session" {
  interface SessionData {
    userId?: string;
    passwordChangedAt?: string;
  }
}
