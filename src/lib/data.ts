// Data access for pages. In demo mode everything comes from demo-data.ts;
// otherwise it queries Supabase as the signed-in user (RLS enforces client separation).
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { DEMO_CLIENTS, DEMO_SERVICES, demoBundle, demoStore } from "@/lib/demo-data";
import { buildStoreData } from "@/lib/store";
import { campaignRows, lastMonths, monthKey, rollupMonthly, type DashboardInput } from "@/lib/metrics";
import type { AdMetricDaily, Annotation, CampaignMapping, CampaignRow, Client, ClientService, Lead, StoreOrder, StoreOrderLine, Viewer } from "@/lib/types";

export async function getViewer(): Promise<Viewer> {
  if (isDemo) return { userId: "demo", email: "demo@gr8hook.com", isAdmin: true, clientIds: DEMO_CLIENTS.map((c) => c.id) };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("is_admin").eq("id", auth.user.id).maybeSingle(),
    supabase.from("memberships").select("client_id").eq("user_id", auth.user.id),
  ]);
  return {
    userId: auth.user.id,
    email: auth.user.email ?? "",
    isAdmin: Boolean(profile?.is_admin),
    clientIds: (memberships ?? []).map((m) => m.client_id as string),
  };
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer.isAdmin) redirect("/dashboard");
  return viewer;
}

/** Admins, or the client's owner, may connect/disconnect that client's ad accounts. */
export async function canManageClient(viewer: Viewer, clientId: string): Promise<boolean> {
  if (viewer.isAdmin) return true;
  if (isDemo || !viewer.clientIds.includes(clientId)) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("can_manage_client", { cid: clientId });
  return data === true;
}

export async function listClients(): Promise<Client[]> {
  if (isDemo) return DEMO_CLIENTS;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").order("name");
  return (data ?? []) as Client[];
}

export async function getClient(id: string): Promise<Client | null> {
  if (isDemo) return DEMO_CLIENTS.find((c) => c.id === id) ?? null;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  return (data as Client) ?? null;
}

export async function getServices(clientId: string): Promise<ClientService[]> {
  if (isDemo) return DEMO_SERVICES.filter((s) => s.client_id === clientId);
  const supabase = await createClient();
  const { data } = await supabase.from("client_services").select("*").eq("client_id", clientId);
  return (data ?? []) as ClientService[];
}

/** Picks the client to show: ?client= if allowed, otherwise the viewer's first client. */
export async function resolveClient(viewer: Viewer, requested?: string): Promise<Client | null> {
  const clients = await listClients(); // RLS already limits this to what the viewer may see
  if (requested) {
    const match = clients.find((c) => c.id === requested);
    if (match) return match;
  }
  return clients.find((c) => c.status === "active") ?? clients[0] ?? null;
}

async function loadInput(clientId: string, since: string): Promise<DashboardInput & { annotations: Annotation[] }> {
  if (isDemo) {
    const b = demoBundle(clientId);
    return { ...b, metrics: b.metrics.filter((m) => m.date >= since), leads: b.leads.filter((l) => l.created_at >= since) };
  }
  const supabase = await createClient();
  const [metrics, leads, opps, appts, mappings, notes] = await Promise.all([
    supabase.from("ad_metrics_daily").select("*").eq("client_id", clientId).gte("date", since),
    supabase.from("leads").select("*").eq("client_id", clientId).gte("created_at", since),
    supabase.from("opportunities").select("*").eq("client_id", clientId).gte("updated_at", since),
    supabase.from("appointments").select("*").eq("client_id", clientId).gte("starts_at", since),
    supabase.from("campaign_mappings").select("*").eq("client_id", clientId),
    supabase.from("annotations").select("*").eq("client_id", clientId).gte("date", since).order("date"),
  ]);
  return {
    metrics: (metrics.data ?? []).map((r) => ({ ...r, spend: Number(r.spend), conversions: Number(r.conversions), conversion_value: Number(r.conversion_value) })),
    leads: (leads.data ?? []) as Lead[],
    opportunities: (opps.data ?? []).map((o) => ({ ...o, contact_id: o.ghl_contact_id, value: Number(o.value) })),
    appointments: (appts.data ?? []).map((a) => ({ ...a, contact_id: a.ghl_contact_id })),
    mappings: (mappings.data ?? []) as CampaignMapping[],
    annotations: (notes.data ?? []) as Annotation[],
  };
}

/**
 * Monthly building blocks for the Overview. The page sums whichever months are in view
 * (the whole period, one scrubbed month, or two compared months) on the client.
 */
export async function getDashboard(clientId: string, monthsBack: number) {
  // Load twice the window so the previous period is available for comparison.
  const all = lastMonths(monthsBack * 2);
  const current = all.slice(monthsBack);
  const previous = all.slice(0, monthsBack);
  const input = await loadInput(clientId, `${all[0]}-01`);
  const campaignsByMonth: Record<string, CampaignRow[]> = {};
  for (const m of all) campaignsByMonth[m] = campaignRows(input, [m]);
  return {
    rows: rollupMonthly(input, all),
    current,
    previous,
    campaignsByMonth,
    annotations: input.annotations.filter((a) => all.includes(monthKey(a.date))),
  };
}

/** Campaign totals for the last `monthsBack` months. */
export async function getCampaigns(clientId: string, monthsBack: number) {
  const months = lastMonths(monthsBack);
  const input = await loadInput(clientId, `${months[0]}-01`);
  return campaignRows(input, months);
}

/** E-commerce Overview: Shopify orders tied to ads, monthly and per product, with spend and platform-reported purchases. */
export async function getStore(clientId: string, monthsBack: number) {
  const all = lastMonths(monthsBack * 2);
  const current = all.slice(monthsBack);
  const since = `${all[0]}-01`;
  let metrics: AdMetricDaily[], orders: StoreOrder[], lines: StoreOrderLine[], annotations: Annotation[];
  if (isDemo) {
    const st = demoStore(clientId);
    metrics = st.metrics.filter((m) => m.date >= since);
    orders = st.orders.filter((o) => o.created_at >= since);
    const ids = new Set(orders.map((o) => o.order_id));
    lines = st.lines.filter((l) => ids.has(l.order_id));
    annotations = st.annotations;
  } else {
    const supabase = await createClient();
    // Page through results; Supabase returns at most 1,000 rows per request.
    async function paged<T>(build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
      const out: T[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await build(from, from + 999);
        out.push(...((data ?? []) as T[]));
        if (!data || data.length < 1000) return out;
      }
    }
    const [m, o, notes] = await Promise.all([
      paged<AdMetricDaily>((f, t) => supabase.from("ad_metrics_daily").select("*").eq("client_id", clientId).gte("date", since).range(f, t)),
      paged<StoreOrder & { shopify_order_lines: StoreOrderLine[] }>((f, t) =>
        supabase.from("shopify_orders").select("*, shopify_order_lines(*)").eq("client_id", clientId).gte("created_at", since).order("created_at").range(f, t)),
      supabase.from("annotations").select("*").eq("client_id", clientId).gte("date", since).order("date"),
    ]);
    metrics = m.map((r) => ({ ...r, spend: Number(r.spend), conversions: Number(r.conversions), conversion_value: Number(r.conversion_value) }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    orders = o.map(({ shopify_order_lines: _l, ...r }) => ({ ...r, total: Number(r.total) }));
    lines = o.flatMap((r) => r.shopify_order_lines.map((l) => ({ ...l, amount: Number(l.amount) })));
    annotations = (notes.data ?? []) as Annotation[];
  }
  return { ...buildStoreData(all, current, metrics, orders, lines), annotations: annotations.filter((a) => all.includes(monthKey(a.date))) };
}

export async function getRecentLeads(clientId: string, limit = 50) {
  const since = `${lastMonths(3)[0]}-01`;
  const input = await loadInput(clientId, since);
  const names = new Map<string, string>();
  for (const m of input.metrics) names.set(m.campaign_id, m.campaign_name);
  const won = new Map(input.opportunities.filter((o) => o.status === "won").map((o) => [o.contact_id, o]));
  const appt = new Map(input.appointments.map((a) => [a.contact_id, a]));
  return [...input.leads]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((l) => ({
      ...l,
      campaign_name: l.campaign_id ? names.get(l.campaign_id) ?? l.campaign_id : null,
      appointment: appt.get(l.ghl_contact_id)?.status ?? null,
      won_value: won.get(l.ghl_contact_id)?.value ?? null,
      service: won.get(l.ghl_contact_id)?.service ?? null,
    }));
}

/** E-commerce "Orders & sales": the most recent Shopify orders with the ad (if any) each was tied to. */
export async function getRecentOrders(clientId: string, limit = 50) {
  let orders: StoreOrder[], lines: StoreOrderLine[], names = new Map<string, string>();
  if (isDemo) {
    const st = demoStore(clientId);
    orders = [...st.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    const ids = new Set(orders.map((o) => o.order_id));
    lines = st.lines.filter((l) => ids.has(l.order_id));
    for (const m of st.metrics) names.set(m.campaign_id, m.campaign_name);
  } else {
    const supabase = await createClient();
    const { data } = await supabase.from("shopify_orders").select("*, shopify_order_lines(*)").eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(limit);
    const rows = (data ?? []) as (StoreOrder & { shopify_order_lines: StoreOrderLine[] })[];
    orders = rows.map((r) => ({ ...r, total: Number(r.total) }));
    lines = rows.flatMap((r) => r.shopify_order_lines.map((l) => ({ ...l, amount: Number(l.amount) })));
    const ids = [...new Set(orders.map((o) => o.campaign_id).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: camps } = await supabase.from("ad_metrics_daily").select("campaign_id, campaign_name").eq("client_id", clientId).in("campaign_id", ids).limit(1000);
      names = new Map((camps ?? []).map((c) => [c.campaign_id as string, c.campaign_name as string]));
    }
  }
  const byOrder = new Map<string, StoreOrderLine[]>();
  for (const l of lines) byOrder.set(l.order_id, [...(byOrder.get(l.order_id) ?? []), l]);
  const host = (u: string | null) => { try { return u ? new URL(u).hostname.replace(/^www\./, "") : null; } catch { return null; } };
  return orders.map((o) => ({
    ...o,
    campaign_name: o.campaign_id ? names.get(o.campaign_id) ?? o.campaign_id : null,
    items: (byOrder.get(o.order_id) ?? []).map((l) => (l.quantity > 1 ? `${l.product_title} ×${l.quantity}` : l.product_title)).join(", "),
    // Where the visit came from when it wasn't an ad: UTM source/medium, else the referring site, else direct.
    source: o.utm_source ? `${o.utm_source}${o.utm_medium ? ` / ${o.utm_medium}` : ""}` : host(o.referrer) ?? "Direct / unknown",
  }));
}

export async function getMappings(clientId: string) {
  const since = `${lastMonths(3)[0]}-01`;
  const input = await loadInput(clientId, since);
  const campaigns = new Map<string, { id: string; name: string; platform: string }>();
  for (const m of input.metrics) campaigns.set(m.campaign_id, { id: m.campaign_id, name: m.campaign_name, platform: m.platform });
  const mapped = new Map(input.mappings.map((m) => [m.campaign_id, m.product_or_service]));
  return [...campaigns.values()].map((c) => ({ ...c, service: mapped.get(c.id) ?? "" }));
}
