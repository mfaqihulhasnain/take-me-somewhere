import { prisma } from "@/lib/prisma";
import { checkUrl, nextHealthState } from "@/lib/health";
import { jsonError } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

const CONCURRENCY = 8;
const BATCH_SIZE = 80;

async function mapWithConcurrency(items, worker) {
  const output = [];
  let cursor = 0;
  async function runner() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, runner));
  return output;
}

export async function GET(request) {
  const expected = process.env.CRON_SECRET;
  const received = request.headers.get("authorization");
  if (!expected || received !== `Bearer ${expected}`) return jsonError("UNAUTHORIZED", "Only the scheduled caretaker may enter.", 401);

  const destinations = await prisma.destination.findMany({ orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } }, take: BATCH_SIZE, select: { id: true, url: true, healthStatus: true, consecutiveFailures: true } });
  const results = await mapWithConcurrency(destinations, async (destination) => {
    const result = await checkUrl(destination.url);
    const state = nextHealthState(destination, result);
    const updated = await prisma.destination.update({ where: { id: destination.id }, data: { ...state, lastCheckedAt: new Date(), lastHttpStatus: result.status, lastFailureReason: result.reason } });
    return { result, updated, wasDead: destination.healthStatus === "DEAD" };
  });
  const summary = results.reduce((acc, item) => {
    acc.checked += 1;
    if (item.result.healthy) acc.healthy += 1; else acc.failed += 1;
    if (item.updated.healthStatus === "DEAD" && !item.wasDead) acc.newlyDead += 1;
    return acc;
  }, { checked: 0, healthy: 0, failed: 0, newlyDead: 0 });
  return Response.json(summary);
}
