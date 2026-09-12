import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CATEGORY_SLUGS, MAX_RECENT_IDS } from "./constants";

function selectionQuery({ recentIds, category }) {
  const categoryClause = category ? Prisma.sql`AND c.slug = ${category}` : Prisma.empty;
  const recentClause = recentIds.length
    ? Prisma.sql`AND d.id NOT IN (${Prisma.join(recentIds)})`
    : Prisma.empty;

  return Prisma.sql`
    SELECT d.id, d.url, d.title, d.description, d.tags, d.weirdness, c.slug AS category
    FROM "Destination" d
    JOIN "Category" c ON c.id = d."categoryId"
    WHERE d."healthStatus" = 'HEALTHY'
      AND d."moderationStatus" = 'APPROVED'
      AND d."isNsfw" = false
      ${categoryClause}
      ${recentClause}
    ORDER BY -LN(GREATEST(RANDOM(), 0.000001)) / GREATEST(0.1, COALESCE(d."rankingBoost", 1)) ASC
    LIMIT 1
  `;
}

export async function getRandomDestination({ recentIds = [], category = null } = {}) {
  const safeRecentIds = [...new Set(recentIds)]
    .filter((id) => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id))
    .slice(0, MAX_RECENT_IDS);
  const safeCategory = category && CATEGORY_SLUGS.has(category) ? category : null;

  let rows = await prisma.$queryRaw(selectionQuery({ recentIds: safeRecentIds, category: safeCategory }));
  let repeated = false;
  if (!rows.length && safeRecentIds.length) {
    rows = await prisma.$queryRaw(selectionQuery({ recentIds: [], category: safeCategory }));
    repeated = rows.length > 0;
  }
  return { destination: rows[0] || null, repeated };
}
