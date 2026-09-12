import crypto from "node:crypto";
import { prisma } from "./prisma";

export const ADMIN_COOKIE = "tms-admin-session";
const SESSION_DAYS = 7;

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const digest = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${digest.toString("hex")}`;
}

export function verifyPassword(password, encoded) {
  try {
    const [scheme, saltHex, digestHex] = String(encoded).split("$");
    if (scheme !== "scrypt" || !saltHex || !digestHex) return false;
    const expected = Buffer.from(digestHex, "hex");
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, { N: 16384, r: 8, p: 1 });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch { return false; }
}

export async function createAdminSession(adminId) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.adminSession.create({ data: { tokenHash: hashToken(token), adminId, expiresAt } });
  return { token, expiresAt };
}

export async function requireAdmin(request) {
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: hashToken(token) }, include: { admin: true } });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  await prisma.adminSession.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { id: session.admin.id, email: session.admin.email, sessionId: session.id };
}

export function withAdminCookie(response, token, expiresAt) {
  response.cookies.set({ name: ADMIN_COOKIE, value: token, httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
  return response;
}

export function clearAdminCookie(response) {
  response.cookies.set({ name: ADMIN_COOKIE, value: "", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return response;
}
