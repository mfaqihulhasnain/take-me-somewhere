import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { CATEGORY_SLUGS } from "@/lib/constants";
import { isSameOrigin, jsonError, readJson } from "@/lib/security";
import { numeric } from "@/lib/validation";

export const runtime = "nodejs";
const fields = { baseWeight: [0.01, 10], editorialWeight: [0, 2], weirdnessWeight: [0, 2], voteWeight: [0, 2], voteCap: [0.05, 3], reportPenalty: [0, 2], minWeight: [0.01, 10] };
const DEFAULT_CONFIG = { baseWeight: 1, editorialWeight: 0.22, weirdnessWeight: 0.1, voteWeight: 1, voteCap: 0.75, reportPenalty: 0.2, minWeight: 0.1 };

function safeConfig(input, fallback) {
  const result = Object.fromEntries(Object.keys(fields).map((key) => [key, Number(fallback?.[key] ?? DEFAULT_CONFIG[key])]));
  for (const [key, [min, max]] of Object.entries(fields)) { if (input?.[key] === undefined) continue; const value = numeric(input[key], min, max); if (value === null) return null; result[key] = value; }
  return result;
}

export async function GET(request) {
  if (!await requireAdmin(request)) return jsonError("ADMIN_REQUIRED", "Sign in to enter the control room.", 401);
  const [config, categories] = await Promise.all([prisma.rankingConfig.findUnique({ where: { id: "default" } }), prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, label: true, weightMultiplier: true } })]);
  return Response.json({ config: config || { id: "default", ...DEFAULT_CONFIG }, categories });
}

export async function PUT(request) {
  if (!isSameOrigin(request)) return jsonError("ORIGIN_INVALID", "This portal only accepts local signals.", 403);
  if (!await requireAdmin(request)) return jsonError("ADMIN_REQUIRED", "Sign in to enter the control room.", 401);
  let body; try { body = await readJson(request); } catch { return jsonError("JSON_BODY_INVALID", "The formula card was unreadable."); }
  const current = await prisma.rankingConfig.findUnique({ where: { id: "default" } }) || DEFAULT_CONFIG;
  const config = safeConfig(body?.config, current); if (!config) return jsonError("RANKING_VALUE_INVALID", "One formula value is outside its safe range.");
  if (body?.categoryMultipliers !== undefined && (!Array.isArray(body.categoryMultipliers) || body.categoryMultipliers.length > 8 || body.categoryMultipliers.some((item) => !CATEGORY_SLUGS.has(item?.slug) || numeric(item?.multiplier, 0.1, 5) === null))) return jsonError("CATEGORY_WEIGHTS_INVALID", "Each category multiplier must be between 0.1 and 5.");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const saved = await tx.rankingConfig.upsert({ where: { id: "default" }, update: config, create: { id: "default", ...config } });
      if (Array.isArray(body.categoryMultipliers)) for (const item of body.categoryMultipliers) { const value = numeric(item.multiplier, 0.1, 5); await tx.category.update({ where: { slug: item.slug }, data: { weightMultiplier: value } }); }
      const categories = await tx.category.findMany({ orderBy: { sortOrder: "asc" }, select: { slug: true, label: true, weightMultiplier: true } });
      return { config: saved, categories };
    });
    return Response.json(result);
  } catch (error) { if (error.code === "CATEGORY_WEIGHTS_INVALID") return jsonError(error.code, "Each category multiplier must be between 0.1 and 5."); console.error("ranking save failed", error); return jsonError("RANKING_SAVE_FAILED", "The formula could not be saved.", 500); }
}
