// Shopify Admin GraphQL API — orders with line items and the customer journey (UTMs, landing page).
// Auth: each client store installs a Gr8 Hook app made in the Shopify Dev Dashboard. The one-time
// OAuth install (/api/shopify/connect → /api/shopify/callback) returns an offline Admin API token,
// stored encrypted in Supabase Vault. Scopes: read_orders (+ read_all_orders for history past 60 days).
// Confirm the API version at https://shopify.dev/docs/api/usage/versioning before going live.
import { createHmac, timingSafeEqual } from "node:crypto";
import { attributeOrder, type VisitLike } from "@/lib/attribution";
import type { Platform, StoreOrder, StoreOrderLine } from "@/lib/types";

export const SHOPIFY_SCOPES = "read_orders,read_all_orders,read_products";
const version = () => process.env.SHOPIFY_API_VERSION || "2026-10";

/** "Lakeshore-Candle.myshopify.com/" or "lakeshore-candle" → "lakeshore-candle.myshopify.com" (or null if invalid). */
export function normalizeShop(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

/** Verifies the `hmac` Shopify adds to OAuth redirects. */
export function verifyShopifyHmac(query: URLSearchParams, secret: string): boolean {
  const hmac = query.get("hmac");
  if (!hmac) return false;
  const message = [...query.entries()]
    .filter(([k]) => k !== "hmac" && k !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const digest = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(digest, "utf8"), b = Buffer.from(hmac, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Swaps the one-time OAuth code for an offline Admin API access token. */
export async function exchangeShopifyCode(shop: string, clientId: string, clientSecret: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Shopify returned no access token");
  return body.access_token;
}

interface Money { shopMoney: { amount: string; currencyCode: string } }
interface GqlVisit {
  landingPage: string | null;
  referrerUrl: string | null;
  utmParameters: { source: string | null; medium: string | null; campaign: string | null; content: string | null } | null;
}
interface GqlOrder {
  id: string;
  name: string;
  createdAt: string;
  cancelledAt: string | null;
  currentTotalPriceSet: Money;
  customerJourneySummary: { firstVisit: GqlVisit | null; lastVisit: GqlVisit | null } | null;
  lineItems: { nodes: { id: string; title: string; variantTitle: string | null; quantity: number; product: { id: string; title: string } | null; discountedTotalSet: Money }[] };
}

const ORDERS_QUERY = `
query Orders($q: String!, $after: String) {
  orders(first: 100, after: $after, query: $q, sortKey: CREATED_AT) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id name createdAt cancelledAt
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      customerJourneySummary {
        firstVisit { landingPage referrerUrl utmParameters { source medium campaign content } }
        lastVisit { landingPage referrerUrl utmParameters { source medium campaign content } }
      }
      lineItems(first: 100) {
        nodes { id title variantTitle quantity product { id title } discountedTotalSet { shopMoney { amount currencyCode } } }
      }
    }
  }
}`;

const toVisit = (v: GqlVisit | null): VisitLike | null =>
  v ? { utm: v.utmParameters, landingPage: v.landingPage, referrer: v.referrerUrl } : null;

/**
 * Orders created since `since` (YYYY-MM-DD), attributed to ad campaigns.
 * `knownCampaigns` maps synced campaign IDs to their platform so utm_campaign={{campaign.id}} matches exactly.
 */
export async function fetchShopifyOrders(clientId: string, shop: string, token: string, since: string, knownCampaigns: Map<string, Platform>) {
  const orders: StoreOrder[] = [];
  const lines: StoreOrderLine[] = [];
  let after: string | null = null;
  do {
    const res: Response = await fetch(`https://${shop}/admin/api/${version()}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: ORDERS_QUERY, variables: { q: `created_at:>=${since}`, after } }),
    });
    if (!res.ok) throw new Error(`Shopify orders failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { data?: { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: GqlOrder[] } }; errors?: unknown };
    if (!body.data) throw new Error(`Shopify orders error: ${JSON.stringify(body.errors).slice(0, 500)}`);

    for (const o of body.data.orders.nodes) {
      const id = o.id.split("/").pop()!;
      const journey = o.customerJourneySummary;
      const a = attributeOrder([toVisit(journey?.lastVisit ?? null), toVisit(journey?.firstVisit ?? null)], knownCampaigns);
      const visit = journey?.lastVisit ?? journey?.firstVisit ?? null;
      orders.push({
        client_id: clientId, order_id: id, name: o.name, created_at: o.createdAt,
        total: Number(o.currentTotalPriceSet.shopMoney.amount), currency: o.currentTotalPriceSet.shopMoney.currencyCode,
        cancelled: Boolean(o.cancelledAt), ...a,
        landing_page: visit?.landingPage ?? null, referrer: visit?.referrerUrl ?? null,
      });
      for (const l of o.lineItems.nodes) {
        lines.push({
          client_id: clientId, order_id: id, line_id: l.id.split("/").pop()!,
          product_id: l.product ? l.product.id.split("/").pop()! : null,
          product_title: l.product?.title ?? l.title, variant_title: l.variantTitle,
          quantity: l.quantity, amount: Number(l.discountedTotalSet.shopMoney.amount),
        });
      }
    }
    after = body.data.orders.pageInfo.hasNextPage ? body.data.orders.pageInfo.endCursor : null;
  } while (after);
  return { orders, lines };
}
