import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE, clearAdminCookie, hashToken } from "@/lib/admin-auth";
import { isSameOrigin, jsonError } from "@/lib/security";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: hashToken(token) } });
  return clearAdminCookie(new NextResponse(null, { status: 204 }));
}
