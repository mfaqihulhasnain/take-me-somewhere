import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ destination: { updateMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { POST } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const request = new Request(`http://localhost:3000/api/destinations/${id}/click`, { method: "POST", headers: { origin: "http://localhost:3000" } });

describe("click route", () => {
  beforeEach(() => prisma.destination.updateMany.mockReset());
  it("increments an existing destination without blocking on a response body", async () => {
    prisma.destination.updateMany.mockResolvedValue({ count: 1 });
    const response = await POST(request, { params: Promise.resolve({ id }) });
    expect(response.status).toBe(204);
    expect(prisma.destination.updateMany).toHaveBeenCalledWith({ where: { id }, data: { clickCount: { increment: 1 } } });
  });
});
