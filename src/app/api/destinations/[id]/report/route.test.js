import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { POST } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const request = (reason) => new Request(`http://localhost:3000/api/destinations/${id}/report`, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ sessionId, reason }) });

describe("report route", () => {
  beforeEach(() => { process.env.SESSION_HASH_SECRET = "test-secret"; prisma.$transaction.mockReset(); });
  it("rejects an invalid reason", async () => { expect((await POST(request("BORING"), { params: Promise.resolve({ id }) })).status).toBe(400); });
  it("deduplicates the same anonymous report", async () => {
    const tx = { destination: { findUnique: vi.fn().mockResolvedValue({ reportCount: 2, moderationStatus: "APPROVED", healthStatus: "HEALTHY" }) }, destinationReport: { findUnique: vi.fn().mockResolvedValue({ id: "existing" }), create: vi.fn(), count: vi.fn() } };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const response = await POST(request("DEAD"), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ accepted: true, duplicate: true });
    expect(tx.destinationReport.create).not.toHaveBeenCalled();
  });
});
