// E-commerce rollups: monthly store sales for the whole store ("all") and for each product,
// split by the ad platform each order was tied to, plus ad spend and platform-reported purchases.
import { monthKey } from "@/lib/metrics";
import type { AdMetricDaily, Platform, StoreMonth, StoreOrder, StoreOrderLine } from "@/lib/types";

export const ALL = "all";
export const blankStoreMonth = (): StoreMonth => ({
  orders: 0, units: 0, revenue: 0, ad_orders: 0, ad_revenue: 0, meta_orders: 0, meta_revenue: 0, google_orders: 0, google_revenue: 0,
});

export interface StoreCampaignMonth {
  campaign_id: string;
  campaign_name: string;
  platform: Platform;
  spend: number;
  /** Store-verified orders/revenue tied to this campaign by UTM, per product key ("all" or a product ID). */
  byProduct: Record<string, { orders: number; revenue: number }>;
}

export interface StoreData {
  months: string[]; // previous + current window, oldest first
  current: string[];
  previous: string[];
  products: { id: string; title: string; revenue: number; units: number }[]; // current window, best sellers first
  store: Record<string, Record<string, StoreMonth>>; // month → product key → numbers
  ads: Record<string, { spend: number; meta_spend: number; google_spend: number; meta_reported: number; meta_reported_orders: number; google_reported: number; google_reported_orders: number }>;
  campaigns: Record<string, StoreCampaignMonth[]>; // month → campaigns
  recent: (Pick<StoreOrder, "order_id" | "name" | "created_at" | "total" | "platform" | "match_method" | "utm_source" | "utm_medium"> & { campaign_name: string | null; items: string })[];
}

const round = (n: number) => Math.round(n * 100) / 100;

export function buildStoreData(months: string[], current: string[], metrics: AdMetricDaily[], orders: StoreOrder[], lines: StoreOrderLine[]): StoreData {
  const inWindow = new Set(months);
  const live = orders.filter((o) => !o.cancelled && inWindow.has(monthKey(o.created_at)));
  const linesByOrder = new Map<string, StoreOrderLine[]>();
  for (const l of lines) {
    const arr = linesByOrder.get(l.order_id) ?? [];
    arr.push(l);
    linesByOrder.set(l.order_id, arr);
  }

  const store: StoreData["store"] = Object.fromEntries(months.map((m) => [m, { [ALL]: blankStoreMonth() }]));
  const names = new Map<string, string>();
  for (const r of metrics) names.set(r.campaign_id, r.campaign_name);

  // Campaign spend + platform-reported purchases (Meta Pixel / Google tag) by month
  const ads: StoreData["ads"] = Object.fromEntries(months.map((m) => [m, { spend: 0, meta_spend: 0, google_spend: 0, meta_reported: 0, meta_reported_orders: 0, google_reported: 0, google_reported_orders: 0 }]));
  const camp = new Map<string, StoreCampaignMonth>(); // key: month|campaign
  const campRow = (m: string, id: string, platform: Platform) => {
    const k = `${m}|${id}`;
    let row = camp.get(k);
    if (!row) { row = { campaign_id: id, campaign_name: names.get(id) ?? id, platform, spend: 0, byProduct: {} }; camp.set(k, row); }
    return row;
  };
  for (const r of metrics) {
    const m = monthKey(r.date);
    if (!inWindow.has(m)) continue;
    const a = ads[m];
    a.spend += r.spend;
    if (r.platform === "meta") { a.meta_spend += r.spend; a.meta_reported += r.conversion_value; a.meta_reported_orders += r.conversions; }
    else { a.google_spend += r.spend; a.google_reported += r.conversion_value; a.google_reported_orders += r.conversions; }
    campRow(m, r.campaign_id, r.platform).spend += r.spend;
  }

  const add = (row: StoreMonth, o: StoreOrder, revenue: number, units: number) => {
    row.orders += 1; row.units += units; row.revenue += revenue;
    if (o.platform) {
      row.ad_orders += 1; row.ad_revenue += revenue;
      if (o.platform === "meta") { row.meta_orders += 1; row.meta_revenue += revenue; }
      else { row.google_orders += 1; row.google_revenue += revenue; }
    }
  };

  const productTotals = new Map<string, { id: string; title: string; revenue: number; units: number }>();
  const currentSet = new Set(current);
  for (const o of live) {
    const m = monthKey(o.created_at);
    const ls = linesByOrder.get(o.order_id) ?? [];
    add(store[m][ALL], o, o.total, ls.reduce((s, l) => s + l.quantity, 0));
    const cRow = o.campaign_id ? campRow(m, o.campaign_id, o.platform ?? "meta") : null;
    if (cRow) {
      const all = (cRow.byProduct[ALL] ??= { orders: 0, revenue: 0 });
      all.orders += 1; all.revenue += o.total;
    }
    // Per product: the order counts once per product it contains; revenue is that product's line total.
    const perProduct = new Map<string, { title: string; revenue: number; units: number }>();
    for (const l of ls) {
      const key = l.product_id ?? `title:${l.product_title}`;
      const p = perProduct.get(key) ?? { title: l.product_title, revenue: 0, units: 0 };
      p.revenue += l.amount; p.units += l.quantity;
      perProduct.set(key, p);
    }
    for (const [key, p] of perProduct) {
      add((store[m][key] ??= blankStoreMonth()), o, p.revenue, p.units);
      if (cRow) {
        const row = (cRow.byProduct[key] ??= { orders: 0, revenue: 0 });
        row.orders += 1; row.revenue += p.revenue;
      }
      if (currentSet.has(m)) {
        const t = productTotals.get(key) ?? { id: key, title: p.title, revenue: 0, units: 0 };
        t.revenue += p.revenue; t.units += p.units;
        productTotals.set(key, t);
      } else if (!productTotals.has(key)) {
        productTotals.set(key, { id: key, title: p.title, revenue: 0, units: 0 });
      }
    }
  }

  // Round money for display
  for (const m of months) {
    for (const row of Object.values(store[m])) for (const k of ["revenue", "ad_revenue", "meta_revenue", "google_revenue"] as const) row[k] = round(row[k]);
    const a = ads[m];
    for (const k of Object.keys(a) as (keyof typeof a)[]) a[k] = round(a[k]);
  }
  const campaigns: StoreData["campaigns"] = Object.fromEntries(months.map((m) => [m, [] as StoreCampaignMonth[]]));
  for (const [k, row] of camp) campaigns[k.split("|")[0]].push(row);

  const nowIso = new Date().toISOString(); // demo data runs to month end; lists only show what has "happened"
  const recent = live
    .filter((o) => currentSet.has(monthKey(o.created_at)) && o.created_at <= nowIso)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 25)
    .map((o) => ({
      order_id: o.order_id, name: o.name, created_at: o.created_at, total: o.total, platform: o.platform, match_method: o.match_method,
      utm_source: o.utm_source, utm_medium: o.utm_medium,
      campaign_name: o.campaign_id ? names.get(o.campaign_id) ?? o.campaign_id : null,
      items: (linesByOrder.get(o.order_id) ?? []).map((l) => (l.quantity > 1 ? `${l.product_title} ×${l.quantity}` : l.product_title)).join(", "),
    }));

  return {
    months, current, previous: months.filter((m) => !currentSet.has(m)),
    products: [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).map((p) => ({ ...p, revenue: round(p.revenue) })),
    store, ads, campaigns, recent,
  };
}
