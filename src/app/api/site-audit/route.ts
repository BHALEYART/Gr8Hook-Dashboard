import { NextResponse, type NextRequest } from "next/server";
import { signAudit } from "@/lib/audit-sign";
import { clientIp, cors, allowOrigin, rateLimited } from "@/lib/public-api";
import { runAudit, runSpeed, type AuditResult, type SpeedResult } from "@/lib/site-audit";

// Public endpoint for the free audit on gr8hook.com/audit. Only gr8hook.com (and local previews) may call it.
// Google's speed test can take over a minute on heavy sites. 300s is the Hobby maximum with Fluid compute.
export const maxDuration = 300;

// Recent results are reused for 15 minutes (per instance) so repeat checks don't re-run Google's test.
// The page checks and each Google speed test (mobile, desktop) are separate requests, so each gets the full time limit.
const cache = new Map<string, { at: number; result: AuditResult | SpeedResult }>();
const CACHE_MS = 15 * 60 * 1000;

/** Health check: open this URL in a browser to confirm the endpoint is deployed and the API key is set. */
export function GET() {
  return NextResponse.json({
    ok: true,
    pagespeedKey: Boolean(process.env.PAGESPEED_API_KEY),
    emailReports: Boolean(process.env.RESEND_API_KEY),
    leadDatabase: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL),
  });
}

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = cors(origin);
  if (!allowOrigin(origin)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers });

  const now = Date.now();
  const body = (await request.json().catch(() => ({}))) as { url?: unknown; strategy?: unknown };
  const input = typeof body.url === "string" ? body.url.slice(0, 300) : "";
  const strategy = body.strategy === "mobile" || body.strategy === "desktop" ? body.strategy : null;
  const key = `${strategy ?? "page"}:${input.trim().toLowerCase().replace(/\/+$/, "")}`;
  const cached = cache.get(key);
  if (cached && now - cached.at < CACHE_MS) return NextResponse.json({ ...cached.result, token: signAudit(cached.result) }, { headers });

  if (rateLimited(`audit:${strategy ?? "page"}:${clientIp(request)}`, 10, 60 * 60 * 1000)) return NextResponse.json({ error: "You've run a lot of audits this hour. Please try again a little later." }, { status: 429, headers });

  try {
    const result = strategy ? await runSpeed(input, strategy) : await runAudit(input);
    if (!("error" in result && result.error)) cache.set(key, { at: now, result });
    if (cache.size > 200) cache.delete(cache.keys().next().value!);
    return NextResponse.json({ ...result, token: signAudit(result) }, { headers });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Something went wrong. Please try again." }, { status: 400, headers });
  }
}
