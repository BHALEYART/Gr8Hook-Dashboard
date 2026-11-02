import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { backPath, configured, isAdPlatform } from "@/lib/connections";
import { canManageClient, getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { googleAuthUrl } from "@/lib/integrations/google-ads";
import { metaAuthUrl } from "@/lib/integrations/meta-ads";

// "Connect Facebook" / "Connect Google": sends the person to the platform's sign-in and consent screen.
// ?client=ID&from=admin returns to client settings afterwards; otherwise to /dashboard/connections.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/connect/[platform]">) {
  const { platform } = await ctx.params;
  const clientId = request.nextUrl.searchParams.get("client") ?? "";
  const from = request.nextUrl.searchParams.get("from") === "admin" ? "admin" : "dashboard";
  const back = new URL(backPath(from, clientId), request.url);
  if (!isAdPlatform(platform)) return NextResponse.redirect(back);

  const viewer = await getViewer();
  if (!(await canManageClient(viewer, clientId))) { back.searchParams.set("connect", "denied"); return NextResponse.redirect(back); }
  if (isDemo) { back.searchParams.set("demo", "1"); return NextResponse.redirect(back); }
  if (!configured(platform)) { back.searchParams.set("connect", `${platform}-setup`); return NextResponse.redirect(back); }

  const nonce = randomUUID();
  const site = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const redirectUri = `${site}/api/connect/${platform}/callback`;
  const url = platform === "meta" ? metaAuthUrl(redirectUri, nonce) : googleAuthUrl(redirectUri, nonce);

  const res = NextResponse.redirect(url);
  res.cookies.set(`g8_${platform}_oauth`, JSON.stringify({ clientId, nonce, from }),
    { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: `/api/connect/${platform}` });
  return res;
}
