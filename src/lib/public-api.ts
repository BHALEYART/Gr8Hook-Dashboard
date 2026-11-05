// Shared guards for the public endpoints used by gr8hook.com (CORS allow-list and a light per-IP rate limit).
import type { NextRequest } from "next/server";

const ALLOWED = (process.env.AUDIT_ALLOWED_ORIGINS || "https://gr8hook.com,https://www.gr8hook.com").split(",").map((s) => s.trim()).filter(Boolean);

export const allowOrigin = (origin: string | null) =>
  origin && (ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ? origin : null;

export const cors = (origin: string | null): Record<string, string> => {
  const o = allowOrigin(origin);
  return o
    ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : { Vary: "Origin" };
};

export const clientIp = (request: NextRequest) => (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";

// Serverless instances don't share memory, so this limits each instance, not globally. Enough to stop casual abuse.
const buckets = new Map<string, number[]>();
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return true;
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value!);
  return false;
}
