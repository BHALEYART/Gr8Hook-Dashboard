import { NextResponse, type NextRequest } from "next/server";
import { runAudit, type AuditResult } from "@/lib/site-audit";

// Public endpoint for the free audit on gr8hook.com/audit. Only gr8hook.com (and local previews) may call it.
export const maxDuration = 60;

const ALLOWED = (process.env.AUDIT_ALLOWED_ORIGINS || "https://gr8hook.com,https://www.gr8hook.com").split(",").map((s) => s.trim());
const allowOrigin = (origin: string | null) =>
  origin && (ALLOWED.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ? origin : null;
const cors = (origin: string | null): Record<string, string> => {
  const o = allowOrigin(origin);
  return o ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" } : { Vary: "Origin" };
};

// Light abuse protection. Serverless instances don't share memory, so this is per instance, not global.
const hits = new Map<string, number[]>();
const cache = new Map<string, { at: number; result: AuditResult }>();
const LIMIT = 8, WINDOW = 60 * 60 * 1000, CACHE_MS = 15 * 60 * 1000;

/** Health check: open this URL in a browser to confirm the endpoint is deployed and the API key is set. */
export function GET() {
  return NextResponse.json({ ok: true, pagespeedKey: Boolean(process.env.PAGESPEED_API_KEY) });
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = cors(origin);
  if (!allowOrigin(origin)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return NextResponse.json({ error: "You've run a lot of audits this hour. Please try again a little later." }, { status: 429, headers });

  const body = (await request.json().catch(() => ({}))) as { url?: unknown };
  const input = typeof body.url === "string" ? body.url.slice(0, 300) : "";
  const key = input.trim().toLowerCase().replace(/\/+$/, "");
  const cached = cache.get(key);
  if (cached && now - cached.at < CACHE_MS) return NextResponse.json(cached.result, { headers });

  recent.push(now);
  hits.set(ip, recent);
  try {
    const result = await runAudit(input);
    cache.set(key, { at: now, result });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return NextResponse.json(result, { headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }, { status: 400, headers });
  }
}
