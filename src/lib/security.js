import crypto from "node:crypto";

export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function hashSessionId(sessionId) {
  if (typeof sessionId !== "string" || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    throw new Error("A valid anonymous session ID is required.");
  }
  const secret = process.env.SESSION_HASH_SECRET;
  if (!secret) throw new Error("SESSION_HASH_SECRET is required.");
  return crypto.createHmac("sha256", secret).update(sessionId).digest("hex");
}

export function jsonError(code, message, status = 400) {
  return Response.json({ error: { code, message } }, { status });
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error("JSON_BODY_INVALID");
  }
}
