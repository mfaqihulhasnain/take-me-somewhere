import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { isSameOrigin, jsonError, readJson } from "@/lib/security";
import { cleanText } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  const admin = await requireAdmin(request); if (!admin) return jsonError("ADMIN_REQUIRED", "Sign in to enter the control room.", 401);
  const { id } = await params; if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("SUBMISSION_INVALID", "That submission has a crooked address.");
  let body; try { body = await readJson(request); } catch { return jsonError("JSON_BODY_INVALID", "The review card was unreadable."); }
  if (!["APPROVE", "REJECT"].includes(body?.action)) return jsonError("REVIEW_ACTION_INVALID", "Choose approve or reject.");
  if (body?.moderationNote !== undefined && !cleanText(body.moderationNote, 500, 1)) return jsonError("NOTE_INVALID", "Keep the note under 500 characters.");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const submission = await tx.destinationSubmission.findUnique({ where: { id }, include: { category: true } });
      if (!submission) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });
      const moderationNote = body.moderationNote ? String(body.moderationNote).trim() : null;
      if (body.action === "REJECT") return tx.destinationSubmission.update({ where: { id }, data: { status: "REJECTED", moderationNote, reviewedAt: new Date(), reviewedById: admin.id }, select: { id: true, status: true, destinationId: true } });
      const destination = await tx.destination.upsert({ where: { url: submission.url }, update: { title: submission.title, description: submission.description, tags: submission.tags, categoryId: submission.categoryId, isNsfw: submission.isNsfw, moderationStatus: "APPROVED" }, create: { url: submission.url, title: submission.title, description: submission.description, tags: submission.tags, categoryId: submission.categoryId, isNsfw: submission.isNsfw, healthStatus: "HEALTHY", moderationStatus: "APPROVED", editorialScore: 3, weirdness: 3, rankingBoost: 1 } });
      return tx.destinationSubmission.update({ where: { id }, data: { status: "APPROVED", moderationNote, destinationId: destination.id, reviewedAt: new Date(), reviewedById: admin.id }, select: { id: true, status: true, destinationId: true } });
    });
    return Response.json({ submission: result });
  } catch (error) { if (error.code === "NOT_FOUND") return jsonError("SUBMISSION_NOT_FOUND", "That submission has wandered away.", 404); console.error("submission review failed", error); return jsonError("SUBMISSION_REVIEW_FAILED", "The review could not be saved.", 500); }
}
