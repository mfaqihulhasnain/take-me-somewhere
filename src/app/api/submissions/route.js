import { prisma } from "@/lib/prisma";
import { isSameOrigin, jsonError, readJson } from "@/lib/security";
import { cleanText, normalizeCategory, normalizeEmail, normalizeHttpsUrl, normalizeTags } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  let body;
  try { body = await readJson(request); } catch { return jsonError("JSON_BODY_INVALID", "The submission card was unreadable."); }
  if (body?.website) return jsonError("BOT_DETECTED", "That hidden field should stay empty.");
  const url = normalizeHttpsUrl(body?.url);
  const title = cleanText(body?.title, 120, 2);
  const description = cleanText(body?.description, 600, 20);
  const categorySlug = normalizeCategory(body?.category);
  const tags = normalizeTags(body?.tags);
  const contactEmail = normalizeEmail(body?.contactEmail);
  if (!url) return jsonError("URL_INVALID", "Use a public HTTPS URL without a password or private host.");
  if (!title) return jsonError("TITLE_INVALID", "Give the portal a short title (2–120 characters).");
  if (!description) return jsonError("DESCRIPTION_INVALID", "Add a useful description (20–600 characters).");
  if (!categorySlug) return jsonError("CATEGORY_INVALID", "Choose one of the launch categories.");
  if (!tags) return jsonError("TAGS_INVALID", "Use up to eight short comma-separated tags.");
  if (body?.contactEmail && !contactEmail) return jsonError("EMAIL_INVALID", "That contact email does not look right.");
  if (body?.isNsfw !== undefined && typeof body.isNsfw !== "boolean") return jsonError("NSFW_INVALID", "Choose yes or no for mature content.");
  if (body?.attestation !== true) return jsonError("ATTESTATION_REQUIRED", "Please confirm that you own or represent this site.");

  try {
    const category = await prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
    if (!category) return jsonError("CATEGORY_INVALID", "That category is not on the departure board.");
    const [destination, pending] = await Promise.all([
      prisma.destination.findUnique({ where: { url }, select: { id: true } }),
      prisma.destinationSubmission.findFirst({ where: { url, status: "PENDING" }, select: { id: true } }),
    ]);
    if (destination || pending) return jsonError("SUBMISSION_EXISTS", "That portal is already in our records or review queue.", 409);
    const submission = await prisma.destinationSubmission.create({
      data: { url, title, description, tags, categoryId: category.id, contactEmail, isNsfw: body.isNsfw === true },
      select: { id: true, status: true },
    });
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    console.error("submission failed", error);
    return jsonError("SUBMISSION_FAILED", "The submission envelope missed its train. Try again.", 500);
  }
}
