import { cookies } from "next/headers";
import { adminDefaults } from "@/config/admin";
import { createHmac, scryptSync, timingSafeEqual, randomBytes } from "crypto";

const COOKIE = "admin_session";
const MAX_AGE = 60 * 60 * 24 * 7;

const secret = () => {
  return process.env.SESSION_SECRET || adminDefaults.sessionSecret;
};
const sign = (v: string) => createHmac("sha256", secret()).update(v).digest("base64url");

export function hashPassword(pw: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(pw, salt, 32).toString("hex")}`;
}

export function checkCredentials(username: string, password: string) {
  const u = process.env.ADMIN_USERNAME || adminDefaults.username;
  const stored = process.env.ADMIN_PASSWORD_HASH || adminDefaults.passwordHash;
  const [, salt, hash] = stored.split(":");
  const userOk = username.length === u.length && timingSafeEqual(Buffer.from(username), Buffer.from(u));
  if (!salt || !hash) return false;
  const a = scryptSync(password, salt, 32);
  const b = Buffer.from(hash, "hex");
  return userOk && a.length === b.length && timingSafeEqual(a, b);
}

export async function startSession() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE,
  });
}

export async function endSession() { (await cookies()).delete(COOKIE); }

export async function isAdmin(): Promise<boolean> {
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [payload, sig] = v.split(".");
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  try { return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now(); } catch { return false; }
}
