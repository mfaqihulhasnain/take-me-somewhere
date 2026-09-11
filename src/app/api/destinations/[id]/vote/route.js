import { prisma } from "@/lib/prisma";
import { hashSessionId, isSameOrigin, jsonError, readJson } from "@/lib/security";

export const runtime = "nodejs";

async function applyVote(id, sessionHash, value) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.destinationVote.findUnique({ where: { destinationId_sessionHash: { destinationId: id, sessionHash } } });
        const destination = await tx.destination.findUnique({ where: { id }, select: { upvotes: true, downvotes: true } });
        if (!destination) throw Object.assign(new Error("NOT_FOUND"), { code: "NOT_FOUND" });

        if (existing?.value === value || (!existing && !value)) {
          return { upvotes: destination.upvotes, downvotes: destination.downvotes, userVote: existing?.value || null };
        }

        const increments = {
          upvotes: (value === "UP" ? 1 : 0) - (existing?.value === "UP" ? 1 : 0),
          downvotes: (value === "DOWN" ? 1 : 0) - (existing?.value === "DOWN" ? 1 : 0),
        };
        if (value) {
          await tx.destinationVote.upsert({
            where: { destinationId_sessionHash: { destinationId: id, sessionHash } },
            create: { destinationId: id, sessionHash, value },
            update: { value },
          });
        } else if (existing) {
          await tx.destinationVote.delete({ where: { id: existing.id } });
        }
        const updated = await tx.destination.update({ where: { id }, data: { upvotes: { increment: increments.upvotes }, downvotes: { increment: increments.downvotes } }, select: { upvotes: true, downvotes: true } });
        return { ...updated, userVote: value || null };
      }, { isolationLevel: "Serializable" });
    } catch (error) {
      if (["P2034", "P2002"].includes(error.code) && attempt < 2) continue;
      throw error;
    }
  }
}

export async function PUT(request, { params }) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("DESTINATION_INVALID", "That destination has a crooked address.");
  let body;
  try { body = await readJson(request); } catch { return jsonError("JSON_BODY_INVALID", "The vote card was unreadable."); }
  if (!["UP", "DOWN", "CLEAR"].includes(body?.value)) return jsonError("VOTE_INVALID", "Choose a direction, or clear your vote.");
  let sessionHash;
  try { sessionHash = hashSessionId(body?.sessionId); } catch { return jsonError("SESSION_INVALID", "Your anonymous travel pass is invalid."); }
  try {
    const result = await applyVote(id, sessionHash, body.value === "CLEAR" ? null : body.value);
    return Response.json(result);
  } catch (error) {
    if (error.code === "NOT_FOUND") return jsonError("DESTINATION_NOT_FOUND", "That portal has drifted out of orbit.", 404);
    console.error("vote failed", error);
    return jsonError("VOTE_FAILED", "The voting booth is having a tiny existential crisis.", 500);
  }
}
