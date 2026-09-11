import { getRandomDestination } from "@/lib/random-destination";
import { CATEGORY_SLUGS, MAX_RECENT_IDS } from "@/lib/constants";
import { jsonError, readJson } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return jsonError("JSON_BODY_INVALID", "The mystery envelope was smudged. Try again.");
  }

  const recentIds = Array.isArray(body?.recentIds) ? body.recentIds : [];
  if (recentIds.length > MAX_RECENT_IDS) {
    return jsonError("RECENT_IDS_TOO_LARGE", "That is an entire scrapbook. Keep the last 50 discoveries.");
  }
  const category = body?.category ?? null;
  if (category !== null && (typeof category !== "string" || !CATEGORY_SLUGS.has(category))) {
    return jsonError("CATEGORY_INVALID", "That vibe is not on the departure board.");
  }

  try {
    const result = await getRandomDestination({ recentIds, category });
    if (!result.destination) {
      return jsonError("NO_DESTINATIONS", "This corner is temporarily empty. Try the whole internet.", 404);
    }
    const { destination } = result;
    return Response.json({
      destination: {
        id: destination.id,
        url: destination.url,
        title: destination.title,
        description: destination.description,
        category: destination.category,
        tags: destination.tags,
        weirdness: Number(destination.weirdness),
      },
      repeated: result.repeated,
    });
  } catch (error) {
    console.error("random destination failed", error);
    return jsonError("DESTINATION_LOOKUP_FAILED", "The portal lost its coordinates. Try once more.", 500);
  }
}
