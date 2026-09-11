import { beforeEach, describe, expect, it, vi } from "vitest";

const getRandomDestination = vi.hoisted(() => vi.fn());
vi.mock("@/lib/random-destination", () => ({ getRandomDestination }));

import { POST } from "./route";

const request = (body) => new Request("http://localhost:3000/api/destinations/random", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

describe("random destination route", () => {
  beforeEach(() => getRandomDestination.mockReset());
  it("rejects oversized history", async () => {
    const response = await POST(request({ recentIds: Array.from({ length: 51 }, () => crypto.randomUUID()), category: null }));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("RECENT_IDS_TOO_LARGE");
  });
  it("returns a curated destination", async () => {
    getRandomDestination.mockResolvedValue({ repeated: false, destination: { id: "abc", url: "https://example.com", title: "Example", description: "A test", category: "weird-web", tags: ["test"], weirdness: 4 } });
    const response = await POST(request({ recentIds: [], category: "weird-web" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ destination: { title: "Example", category: "weird-web" }, repeated: false });
  });
  it("uses a personality-filled empty response", async () => {
    getRandomDestination.mockResolvedValue({ repeated: false, destination: null });
    const response = await POST(request({ recentIds: [], category: "tiny-games" }));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NO_DESTINATIONS");
  });
});
