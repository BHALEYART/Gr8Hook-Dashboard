import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isDemo } from "@/lib/env";
import { getClient, requireAdmin } from "@/lib/data";
import { normalizeShop, SHOPIFY_SCOPES } from "@/lib/integrations/shopify";

// Admin clicks "Connect Shopify" → we send them to the store's install/approve screen.
export async function GET(request: NextRequest) {
  await requireAdmin();
  const id = request.nextUrl.searchParams.get("client") ?? "";
  const back = new URL(`/admin/clients/${id}`, request.url);
  if (isDemo) { back.searchParams.set("demo", "1"); return NextResponse.redirect(back); }

  const client = await getClient(id);
  const shop = normalizeShop(client?.shopify_shop);
  if (!client || !shop || !client.shopify_client_id) {
    back.searchParams.set("shopify", "missing");
    return NextResponse.redirect(back);
  }

  const nonce = randomUUID();
  const site = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  const url = new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id", client.shopify_client_id);
  url.searchParams.set("scope", SHOPIFY_SCOPES);
  url.searchParams.set("redirect_uri", `${site}/api/shopify/callback`);
  url.searchParams.set("state", nonce);

  const res = NextResponse.redirect(url);
  res.cookies.set("g8_shopify_oauth", `${client.id}.${nonce}`, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/shopify" });
  return res;
}
