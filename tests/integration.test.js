import { beforeAll, afterAll, describe, expect, it } from "vitest";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
const suite = enabled ? describe : describe.skip;

suite("Postgres integration", () => {
  let db;
  let getRandomDestination;
  let categoryId;
  const fixtureUrls = ["https://example.com/tms-fixture-good", "https://example.com/tms-fixture-dead", "https://example.com/tms-fixture-nsfw"];

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must point to a dedicated database.");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    ({ prisma: db } = await import("@/lib/prisma"));
    ({ getRandomDestination } = await import("@/lib/random-destination"));
    const category = await db.category.upsert({ where: { slug: "integration-fixture" }, update: {}, create: { slug: "integration-fixture", label: "Integration fixture", description: "Tests", accent: "#fff", sortOrder: 99 } });
    categoryId = category.id;
    await db.destination.createMany({ data: [
      { url: fixtureUrls[0], title: "Good fixture", description: "good", tags: [], categoryId, healthStatus: "HEALTHY", moderationStatus: "APPROVED", isNsfw: false },
      { url: fixtureUrls[1], title: "Dead fixture", description: "dead", tags: [], categoryId, healthStatus: "DEAD", moderationStatus: "APPROVED", isNsfw: false },
      { url: fixtureUrls[2], title: "NSFW fixture", description: "nsfw", tags: [], categoryId, healthStatus: "HEALTHY", moderationStatus: "APPROVED", isNsfw: true },
    ], skipDuplicates: true });
  });

  afterAll(async () => {
    if (!db) return;
    await db.destination.deleteMany({ where: { url: { in: fixtureUrls } } });
    await db.category.delete({ where: { id: categoryId } }).catch(() => {});
    await db.$disconnect();
  });

  it("selects healthy, approved, non-NSFW destinations and excludes recent IDs", async () => {
    const first = await db.destination.findUnique({ where: { url: fixtureUrls[0] } });
    const result = await getRandomDestination({ category: "integration-fixture", recentIds: [] });
    expect(result.destination.url).toBe(fixtureUrls[0]);
    const repeated = await getRandomDestination({ category: "integration-fixture", recentIds: [first.id] });
    expect(repeated.destination.url).toBe(fixtureUrls[0]);
    expect(repeated.repeated).toBe(true);
  });
});
