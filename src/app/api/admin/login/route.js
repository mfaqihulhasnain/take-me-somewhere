import { prisma } from "@/lib/prisma";
import { createAdminSession, verifyPassword, withAdminCookie } from "@/lib/admin-auth";
import { isSameOrigin, jsonError, readJson } from "@/lib/security";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  let body;
  try { body = await readJson(request); } catch { return jsonError("JSON_BODY_INVALID", "The login card was unreadable."); }
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");
  if (!email || !password || email.length > 254 || password.length > 256) return jsonError("ADMIN_LOGIN_INVALID", "Email or password is incorrect.", 401);
  try {
    const admin = await prisma.adminUser.findUnique({ where: { email } });
    if (!admin || !verifyPassword(password, admin.passwordHash)) return jsonError("ADMIN_LOGIN_INVALID", "Email or password is incorrect.", 401);
    const { token, expiresAt } = await createAdminSession(admin.id);
    const response = NextResponse.json({ admin: { email: admin.email } });
    return withAdminCookie(response, token, expiresAt);
  } catch (error) { console.error("admin login failed", error); return jsonError("ADMIN_LOGIN_FAILED", "The admin door is temporarily jammed.", 500); }
}
