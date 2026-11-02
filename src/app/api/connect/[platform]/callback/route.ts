import { NextResponse, type NextRequest } from "next/server";
import { backPath, isAdPlatform } from "@/lib/connections";
import { canManageClient, getViewer } from "@/lib/data";
import { exchangeGoogleCode } from "@/lib/integrations/google-ads";
import { exchangeMetaCode } from "@/lib/integrations/meta-ads";
import { createServiceClient } from "@/lib/supabase/server";

// Facebook / Google send the person back here. We check the state cookie, swap the code for a
// long-lived token, keep it in Vault, and return to settings where they pick the ad account.
export async function GET(request: NextRequest, ctx: RouteContext<"/api/connect/[platform]/callback">) {
  const { platform } = await ctx.params;
  if (!isAdPlatform(platform)) return NextResponse.redirect(new URL("/dashboard", request.url));
  const q = request.nextUrl.searchParams;
  let state: { clientId?: string; nonce?: string; from?: string } = {};
  try { state = JSON.parse(request.cookies.get(`g8_${platform}_oauth`)?.value ?? "{}"); } catch { /* treated as expired */ }
  const clientId = state.clientId ?? "";
  const done = (result: string) => {
    const url = new URL(backPath(state.from ?? "dashboard", clientId), request.url);
    url.searchParams.set("connect", `${platform}-${result}`);
    const res = NextResponse.redirect(url);
    res.cookies.delete({ name: `g8_${platform}_oauth`, path: `/api/connect/${platform}` });
    return res;
  };
  if (!clientId || !state.nonce || q.get("state") !== state.nonce) return done("expired");
  if (q.get("error")) return done("cancelled"); // they closed or declined the consent screen
  if (!(await canManageClient(await getViewer(), clientId))) return done("denied");

  const site = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const redirectUri = `${site}/api/connect/${platform}/callback`;
  const db = createServiceClient();
  try {
    if (platform === "meta") {
      const { token, expiresAt, name } = await exchangeMetaCode(q.get("code") ?? "", redirectUri);
      const { error } = await db.rpc("store_ad_token", { cid: clientId, kind: "meta", val: token });
      if (error) throw error;
      await db.from("clients").update({ meta_connected_as: name, meta_token_expires_at: expiresAt }).eq("id", clientId);
    } else {
      const { refreshToken, email } = await exchangeGoogleCode(q.get("code") ?? "", redirectUri);
      const { error } = await db.rpc("store_ad_token", { cid: clientId, kind: "google", val: refreshToken });
      if (error) throw error;
      await db.from("clients").update({ google_connected_as: email }).eq("id", clientId);
    }
  } catch {
    return done("error");
  }
  return done("connected");
}
