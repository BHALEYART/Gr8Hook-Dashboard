import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/data";
import { exchangeShopifyCode, normalizeShop, verifyShopifyHmac } from "@/lib/integrations/shopify";
import { createServiceClient } from "@/lib/supabase/server";

// Shopify redirects here after the store approves the app. We check the request really came from
// Shopify (HMAC + our state cookie), swap the code for an offline token and keep it in Vault.
export async function GET(request: NextRequest) {
  await requireAdmin();
  const q = request.nextUrl.searchParams;
  const [clientId, nonce] = (request.cookies.get("g8_shopify_oauth")?.value ?? "").split(".");
  const fail = (reason: string) => {
    const url = new URL(clientId ? `/admin/clients/${clientId}` : "/admin", request.url);
    url.searchParams.set("shopify", reason);
    return NextResponse.redirect(url);
  };
  if (!clientId || !nonce || q.get("state") !== nonce) return fail("expired");

  const db = createServiceClient();
  const { data: client } = await db.from("clients").select("id, shopify_shop, shopify_client_id").eq("id", clientId).maybeSingle();
  const shop = normalizeShop(q.get("shop"));
  if (!client || !shop || shop !== normalizeShop(client.shopify_shop) || !client.shopify_client_id) return fail("mismatch");

  const { data: secret } = await db.rpc("get_shopify_secret", { cid: clientId });
  if (!secret || !verifyShopifyHmac(q, secret as string)) return fail("invalid");

  try {
    const token = await exchangeShopifyCode(shop, client.shopify_client_id, secret as string, q.get("code") ?? "");
    const { error } = await db.rpc("store_shopify_token", { cid: clientId, token });
    if (error) throw error;
  } catch {
    return fail("error");
  }
  const res = NextResponse.redirect(new URL(`/admin/clients/${clientId}?shopify=connected`, request.url));
  res.cookies.delete({ name: "g8_shopify_oauth", path: "/api/shopify" });
  return res;
}
