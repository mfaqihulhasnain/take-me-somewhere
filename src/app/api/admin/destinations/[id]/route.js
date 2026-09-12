import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { isSameOrigin, jsonError, readJson } from "@/lib/security";
import { cleanText, normalizeCategory, normalizeHttpsUrl, normalizeTags, numeric } from "@/lib/validation";

export const runtime = "nodejs";

export async function PATCH(request, { params }) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  if (!await requireAdmin(request)) return jsonError("ADMIN_REQUIRED", "Sign in to enter the control room.", 401);
  const { id } = await params; if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("DESTINATION_INVALID", "That destination has a crooked address.");
  let body; try { body = await readJson(request); } catch { return jsonError("JSON_BODY_INVALID", "The edit card was unreadable."); }
  const data = {};
  if (body.title !== undefined) { const value = cleanText(body.title, 120, 2); if (!value) return jsonError("TITLE_INVALID", "Title must be 2–120 characters."); data.title = value; }
  if (body.description !== undefined) { const value = cleanText(body.description, 600, 20); if (!value) return jsonError("DESCRIPTION_INVALID", "Description must be 20–600 characters."); data.description = value; }
  if (body.url !== undefined) { const value = normalizeHttpsUrl(body.url); if (!value) return jsonError("URL_INVALID", "Use a public HTTPS URL."); data.url = value; }
  if (body.tags !== undefined) { const value = normalizeTags(body.tags); if (!value) return jsonError("TAGS_INVALID", "Use up to eight short tags."); data.tags = value; }
  if (body.category !== undefined) { const slug = normalizeCategory(body.category); if (!slug) return jsonError("CATEGORY_INVALID", "Choose a launch category."); const category = await prisma.category.findUnique({ where: { slug }, select: { id: true } }); if (!category) return jsonError("CATEGORY_INVALID", "Choose a launch category."); data.categoryId = category.id; }
  for (const key of ["healthStatus", "moderationStatus"]) if (body[key] !== undefined) { const allowed = key === "healthStatus" ? ["HEALTHY", "SUSPECT", "DEAD"] : ["APPROVED", "FLAGGED"]; if (!allowed.includes(body[key])) return jsonError("STATUS_INVALID", "That status is not supported."); data[key] = body[key]; }
  if (body.isNsfw !== undefined) { if (typeof body.isNsfw !== "boolean") return jsonError("NSFW_INVALID", "Choose yes or no."); data.isNsfw = body.isNsfw; }
  for (const [key, min, max] of [["editorialScore", 1, 5], ["weirdness", 1, 5], ["rankingBoost", 0.1, 5]]) if (body[key] !== undefined) { const value = numeric(body[key], min, max); if (value === null) return jsonError("RANKING_VALUE_INVALID", `${key} is outside its safe range.`); data[key] = key === "rankingBoost" ? value : Math.round(value); }
  if (!Object.keys(data).length) return jsonError("EDIT_EMPTY", "There are no changes to save.");
  try { const destination = await prisma.destination.update({ where: { id }, data, include: { category: { select: { slug: true, label: true } } } }); return Response.json({ destination }); }
  catch (error) { if (error.code === "P2025") return jsonError("DESTINATION_NOT_FOUND", "That destination has drifted away.", 404); if (error.code === "P2002") return jsonError("URL_EXISTS", "Another destination already uses that URL.", 409); console.error("destination edit failed", error); return jsonError("DESTINATION_EDIT_FAILED", "The edit could not be saved.", 500); }
}
