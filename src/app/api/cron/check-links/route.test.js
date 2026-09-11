import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ destination: { findMany: vi.fn(), update: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { GET } from "./route";

describe("link checker cron route", () => {
  beforeEach(() => { process.env.CRON_SECRET = "cron-test"; prisma.destination.findMany.mockReset(); prisma.destination.update.mockReset(); });
  it("rejects requests without the cron secret", async () => {
    const response = await GET(new Request("http://localhost:3000/api/cron/check-links"));
    expect(response.status).toBe(401);
  });
  it("checks a batch and reports healthy results", async () => {
    prisma.destination.findMany.mockResolvedValue([{ id: "1", url: "https://example.com", healthStatus: "HEALTHY", consecutiveFailures: 0 }]);
    prisma.destination.update.mockResolvedValue({ healthStatus: "HEALTHY" });
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 200 });
    const response = await GET(new Request("http://localhost:3000/api/cron/check-links", { headers: { authorization: "Bearer cron-test" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ checked: 1, healthy: 1, failed: 0, newlyDead: 0 });
    fetcher.mockRestore();
  });
});
