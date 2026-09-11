import { prisma } from "@/lib/prisma";
import { isSameOrigin, jsonError } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("DESTINATION_INVALID", "That destination has a crooked address.");
  try {
    const result = await prisma.destination.updateMany({ where: { id }, data: { clickCount: { increment: 1 } } });
    if (!result.count) return jsonError("DESTINATION_NOT_FOUND", "That portal has drifted out of orbit.", 404);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("click increment failed", error);
    return jsonError("CLICK_FAILED", "The counter missed a beat.", 500);
  }
}
