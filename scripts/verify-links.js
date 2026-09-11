const groups = require("../prisma/seed-data.cjs");

const entries = Object.values(groups).flat();
const CONCURRENCY = 10;
const TIMEOUT = 8_000;

async function check(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    let response = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal, headers: { "user-agent": "TakeMeSomewhereSeedVerifier/1.0" } });
    if ([405, 501].includes(response.status)) response = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal, headers: { range: "bytes=0-1023", "user-agent": "TakeMeSomewhereSeedVerifier/1.0" } });
    return { url, status: response.status, ok: (response.status >= 200 && response.status < 400) || [401, 403, 405, 429].includes(response.status) };
  } catch (error) { return { url, status: error.name === "AbortError" ? "TIMEOUT" : "NETWORK_ERROR", ok: false }; }
  finally { clearTimeout(timer); }
}

async function main() {
  const results = [];
  let cursor = 0;
  async function worker() { while (cursor < entries.length) { const item = entries[cursor++]; results.push({ ...item, ...(await check(item.url)) }); } }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, entries.length) }, worker));
  const failed = results.filter((result) => !result.ok);
  for (const result of failed) console.log(`FAIL ${result.status} ${result.url}`);
  console.log(`Checked ${results.length} unique URLs: ${results.length - failed.length} reachable, ${failed.length} failed.`);
  if (failed.length) process.exitCode = 1;
}

main();
