import { prisma } from "@/lib/prisma";
import { REPORT_THRESHOLD } from "@/lib/constants";
import { hashSessionId, isSameOrigin, jsonError, readJson } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("DESTINATION_INVALID", "That destination has a crooked address.");
  let body;
  try { body = await readJson(request); } catch { return jsonError("JSON_BODY_INVALID", "The report card was unreadable."); }
  if (!["DEAD", "INAPPROPRIATE"].includes(body?.reason)) return jsonError("REPORT_INVALID", "Pick a real reason so we can investigate.");
  let sessionHash;
  try { sessionHash = hashSessionId(body?.sessionId); } catch { return jsonError("SESSION_INVALID", "Your anonymous travel pass is invalid."); }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({ where: { id }, select: { reportCount: true, moderationStatus: true, healthStatus: true } });
      if (!destination) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      const existing = await tx.destinationReport.findUnique({ where: { destinationId_sessionHash: { destinationId: id, sessionHash } } });
      if (existing) return { accepted: true, duplicate: true };
      const report = await tx.destinationReport.create({ data: { destinationId: id, sessionHash, reason: body.reason } });
      const reportCount = destination.reportCount + 1;
      const sameReasonCount = await tx.destinationReport.count({ where: { destinationId: id, reason: body.reason } });
      const updateData = { reportCount: { increment: 1 } };
      if (body.reason === "INAPPROPRIATE" && sameReasonCount >= REPORT_THRESHOLD) updateData.moderationStatus = "FLAGGED";
      if (body.reason === "DEAD" && sameReasonCount >= REPORT_THRESHOLD) updateData.healthStatus = "SUSPECT";
      await tx.destination.update({ where: { id }, data: updateData });
      return { accepted: true, reportId: report.id };
    });
    return Response.json(result);
  } catch (error) {
    if (error.code === "NOT_FOUND") return jsonError("DESTINATION_NOT_FOUND", "That portal has drifted out of orbit.", 404);
    if (error.code === "P2002") return Response.json({ accepted: true, duplicate: true });
    console.error("report failed", error);
    return jsonError("REPORT_FAILED", "The moderation pigeon got lost.", 500);
  }
}
