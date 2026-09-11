import { DEAD_FAILURE_THRESHOLD } from "./constants";

export const HEALTHY_HTTP_STATUSES = new Set([200, 201, 202, 203, 204, 206, 300, 301, 302, 303, 307, 308, 401, 403, 405, 429]);

export async function checkUrl(url, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    let response = await fetchImpl(url, { method: "HEAD", redirect: "follow", signal: controller.signal, headers: { "user-agent": "TakeMeSomewhereBot/1.0" } });
    if (response.status === 405 || response.status === 501) {
      response = await fetchImpl(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { range: "bytes=0-1023", "user-agent": "TakeMeSomewhereBot/1.0" } });
    }
    const healthy = HEALTHY_HTTP_STATUSES.has(response.status);
    return { healthy, status: response.status, reason: healthy ? null : `HTTP_${response.status}` };
  } catch (error) {
    return { healthy: false, status: null, reason: error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR" };
  } finally {
    clearTimeout(timeout);
  }
}

export function nextHealthState(destination, result) {
  if (result.healthy) {
    return { healthStatus: "HEALTHY", consecutiveFailures: 0 };
  }
  const consecutiveFailures = destination.consecutiveFailures + 1;
  return { healthStatus: consecutiveFailures >= DEAD_FAILURE_THRESHOLD ? "DEAD" : "SUSPECT", consecutiveFailures };
}
