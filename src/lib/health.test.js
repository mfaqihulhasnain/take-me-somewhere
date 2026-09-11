import { describe, expect, it, vi } from "vitest";
import { checkUrl, nextHealthState } from "./health";

describe("link health", () => {
  it("accepts redirects and protection responses as reachable", async () => {
    const result = await checkUrl("https://example.com", vi.fn().mockResolvedValue({ status: 403 }));
    expect(result).toEqual({ healthy: true, status: 403, reason: null });
  });

  it("falls back from HEAD 405 to a ranged GET", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ status: 405 }).mockResolvedValueOnce({ status: 200 });
    expect((await checkUrl("https://example.com", fetcher)).healthy).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[1][1].method).toBe("GET");
  });

  it("marks example.invalid-style failures suspect, then dead", () => {
    expect(nextHealthState({ consecutiveFailures: 0 }, { healthy: false })).toMatchObject({ healthStatus: "SUSPECT", consecutiveFailures: 1 });
    expect(nextHealthState({ consecutiveFailures: 2 }, { healthy: false })).toMatchObject({ healthStatus: "DEAD", consecutiveFailures: 3 });
    expect(nextHealthState({ consecutiveFailures: 8 }, { healthy: true })).toEqual({ healthStatus: "HEALTHY", consecutiveFailures: 0 });
  });
});
