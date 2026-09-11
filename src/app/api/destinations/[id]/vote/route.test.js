import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ $transaction: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { PUT } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const request = (value) => new Request(`http://localhost:3000/api/destinations/${id}/vote`, { method: "PUT", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify({ sessionId, value }) });

describe("vote route", () => {
  beforeEach(() => { process.env.SESSION_HASH_SECRET = "test-secret"; prisma.$transaction.mockReset(); });
  it("rejects a bad vote value", async () => { expect((await PUT(request("MAYBE"), { params: Promise.resolve({ id }) })).status).toBe(400); });
  it("upserts one anonymous vote and returns counters", async () => {
    const tx = {
      destinationVote: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
      destination: { findUnique: vi.fn().mockResolvedValue({ upvotes: 2, downvotes: 1 }), update: vi.fn().mockResolvedValue({ upvotes: 3, downvotes: 1 }) },
    };
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    const response = await PUT(request("UP"), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ upvotes: 3, downvotes: 1, userVote: "UP" });
    expect(tx.destinationVote.upsert).toHaveBeenCalledOnce();
  });
});
