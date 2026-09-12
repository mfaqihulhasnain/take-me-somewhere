import net from "node:net";
import { CATEGORY_SLUGS } from "./constants";

export function cleanText(value, max, min = 1) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : null;
}

export function normalizeTags(value) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  const tags = [...new Set(source.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 8 || tags.some((tag) => tag.length > 30)) return null;
  return tags;
}

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || host.endsWith(".invalid")) return true;
  if (net.isIP(host) === 4) {
    const parts = host.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || parts[0] === 0 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  }
  if (net.isIP(host) === 6) return host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
  return false;
}

export function normalizeHttpsUrl(value) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || isPrivateHost(parsed.hostname)) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch { return null; }
}

export function normalizeCategory(value) {
  return typeof value === "string" && CATEGORY_SLUGS.has(value) ? value : null;
}

export function normalizeEmail(value) {
  if (value === undefined || value === null || value === "") return null;
  const email = String(value).trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function numeric(value, min, max) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}
