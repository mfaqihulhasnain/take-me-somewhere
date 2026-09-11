import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { getRandomDestination } from "./random-destination";

describe("random destination selection", () => {
  beforeEach(() => prisma.$queryRaw.mockReset());
  it("falls back to a repeated result when every eligible link was recently seen", async () => {
    const destination = { id: "1", url: "https://example.com", title: "Test", description: "Test", category: "weird-web", tags: [], weirdness: 3 };
    prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([destination]);
    const result = await getRandomDestination({ recentIds: ["11111111-1111-4111-8111-111111111111"], category: "weird-web" });
    expect(result).toEqual({ destination, repeated: true });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it("returns null without retrying when a category is empty", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    const result = await getRandomDestination({ category: "tiny-games" });
    expect(result).toEqual({ destination: null, repeated: false });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });
});
