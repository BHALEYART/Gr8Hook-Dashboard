// Data access for pages. In demo mode everything comes from demo-data.ts;
// otherwise it queries Supabase as the signed-in user (RLS enforces client separation).
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { DEMO_CLIENTS, DEMO_SERVICES, demoBundle } from "@/lib/demo-data";
import { campaignRows, kpis, lastMonths, monthKey, rollupMonthly, type DashboardInput } from "@/lib/metrics";
import type { Annotation, CampaignMapping, Client, ClientService, Lead, Viewer } from "@/lib/types";

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

export async function getDashboard(clientId: string, monthsBack: number) {
  // Load twice the window so the previous period is available for % change.
  const all = lastMonths(monthsBack * 2);
  const current = all.slice(monthsBack);
  const previous = all.slice(0, monthsBack);
  const input = await loadInput(clientId, `${all[0]}-01`);
  const monthsNow = rollupMonthly(input, current);
  const monthsPrev = rollupMonthly(input, previous);
  const currentSet = new Set(current);
  const leadsNow = input.leads.filter((l) => currentSet.has(monthKey(l.created_at)));
  const unattributed = leadsNow.filter((l) => !l.campaign_id).length;
  const k = kpis(monthsNow, monthsPrev, unattributed);

  // Funnel: ad clicks → leads → appointments → sales, for ad-driven contacts in the window.
  const paidContacts = new Set(leadsNow.filter((l) => l.campaign_id).map((l) => l.ghl_contact_id));
  const clicks = input.metrics.filter((m) => currentSet.has(monthKey(m.date))).reduce((s, m) => s + m.clicks, 0);
  const sales = input.opportunities.filter((o) => o.status === "won" && paidContacts.has(o.contact_id)).length;
  const platformOf = new Map(input.metrics.map((m) => [m.campaign_id, m.platform]));
  const bySource = { google: 0, meta: 0, unattributed };
  for (const l of leadsNow) {
    if (!l.campaign_id) continue;
    const p = platformOf.get(l.campaign_id);
    if (p === "google") bySource.google++;
    else if (p === "meta") bySource.meta++;
  }

  return {
    months: monthsNow,
    kpis: k,
    funnel: { spend: k.spend, clicks, leads: k.leads, appointments: k.appointments, sales },
    bySource,
    campaigns: campaignRows(input, current),
    annotations: input.annotations.filter((a) => currentSet.has(monthKey(a.date))),
  };
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

export async function getMappings(clientId: string) {
  const since = `${lastMonths(3)[0]}-01`;
  const input = await loadInput(clientId, since);
  const campaigns = new Map<string, { id: string; name: string; platform: string }>();
  for (const m of input.metrics) campaigns.set(m.campaign_id, { id: m.campaign_id, name: m.campaign_name, platform: m.platform });
  const mapped = new Map(input.mappings.map((m) => [m.campaign_id, m.product_or_service]));
  return [...campaigns.values()].map((c) => ({ ...c, service: mapped.get(c.id) ?? "" }));
}
