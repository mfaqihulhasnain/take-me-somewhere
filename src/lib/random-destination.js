import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CATEGORY_SLUGS, MAX_RECENT_IDS } from "./constants";

function selectionQuery({ recentIds, category }) {
  const categoryClause = category ? Prisma.sql`AND c.slug = ${category}` : Prisma.empty;
  const recentClause = recentIds.length
    ? Prisma.sql`AND d.id NOT IN (${Prisma.join(recentIds)})`
    : Prisma.empty;

  return Prisma.sql`
    WITH cfg AS (
      SELECT
        COALESCE("baseWeight", 1.0)::double precision AS base_weight,
        COALESCE("editorialWeight", 0.22)::double precision AS editorial_weight,
        COALESCE("weirdnessWeight", 0.10)::double precision AS weirdness_weight,
        COALESCE("voteWeight", 1.0)::double precision AS vote_weight,
        COALESCE("voteCap", 0.75)::double precision AS vote_cap,
        COALESCE("reportPenalty", 0.20)::double precision AS report_penalty,
        COALESCE("minWeight", 0.10)::double precision AS min_weight
      FROM "RankingConfig" WHERE id = 'default'
    ), scored AS (
      SELECT
        d.id, d.url, d.title, d.description, d.tags, d.weirdness, c.slug AS category,
        GREATEST(
          COALESCE((SELECT min_weight FROM cfg), 0.10),
          d."rankingBoost" * c."weightMultiplier" * (
            COALESCE((SELECT base_weight FROM cfg), 1.0)
            + (d."editorialScore" - 3) * COALESCE((SELECT editorial_weight FROM cfg), 0.22)
            + (d.weirdness - 3) * COALESCE((SELECT weirdness_weight FROM cfg), 0.10)
            + LEAST(COALESCE((SELECT vote_cap FROM cfg), 0.75), GREATEST(-COALESCE((SELECT vote_cap FROM cfg), 0.75),
                COALESCE((d.upvotes - d.downvotes)::numeric / GREATEST(5, d.upvotes + d.downvotes), 0) * COALESCE((SELECT vote_weight FROM cfg), 1.0)
              ))
            - d."reportCount" * COALESCE((SELECT report_penalty FROM cfg), 0.20)
          )
        ) AS weight
      FROM "Destination" d
      JOIN "Category" c ON c.id = d."categoryId"
      WHERE d."healthStatus" = 'HEALTHY'
        AND d."moderationStatus" = 'APPROVED'
        AND d."isNsfw" = false
        ${categoryClause}
        ${recentClause}
    )
    SELECT id, url, title, description, tags, weirdness, category
    FROM scored
    ORDER BY -LN(GREATEST(RANDOM(), 0.000001)) / weight ASC
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
