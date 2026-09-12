import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { jsonError } from "@/lib/security";

export const runtime = "nodejs";

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("ADMIN_REQUIRED", "Sign in to enter the control room.", 401);
  try {
    const [total, healthy, suspect, dead, flagged, nsfw, pending, approved, rejected, submissions, destinations, categories, config] = await Promise.all([
      prisma.destination.count(), prisma.destination.count({ where: { healthStatus: "HEALTHY" } }), prisma.destination.count({ where: { healthStatus: "SUSPECT" } }), prisma.destination.count({ where: { healthStatus: "DEAD" } }), prisma.destination.count({ where: { moderationStatus: "FLAGGED" } }), prisma.destination.count({ where: { isNsfw: true } }), prisma.destinationSubmission.count({ where: { status: "PENDING" } }), prisma.destinationSubmission.count({ where: { status: "APPROVED" } }), prisma.destinationSubmission.count({ where: { status: "REJECTED" } }), prisma.destinationSubmission.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100, include: { category: { select: { slug: true, label: true } } } }), prisma.destination.findMany({ orderBy: { updatedAt: "desc" }, take: 300, include: { category: { select: { slug: true, label: true } } } }), prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, label: true, weightMultiplier: true } }), prisma.rankingConfig.findUnique({ where: { id: "default" } }),
    ]);
    return Response.json({ metrics: { total, healthy, suspect, dead, flagged, nsfw, pending, approved, rejected }, submissions, destinations, categories, config: config || { id: "default", baseWeight: 1, editorialWeight: 0.22, weirdnessWeight: 0.1, voteWeight: 1, voteCap: 0.75, reportPenalty: 0.2, minWeight: 0.1 } });
  } catch (error) { console.error("admin overview failed", error); return jsonError("ADMIN_OVERVIEW_FAILED", "The control room is still loading.", 500); }
}
