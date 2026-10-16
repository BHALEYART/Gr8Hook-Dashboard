import type { AdMetricDaily, Appointment, CampaignMapping, CampaignRow, Lead, MonthRow, Opportunity } from "@/lib/types";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthKey(d: string | Date) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The last `n` calendar months, oldest first, including the current month. */
export function lastMonths(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(monthKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))));
  }
  return out;
}

export interface DashboardInput {
  metrics: AdMetricDaily[];
  leads: Lead[];
  opportunities: Opportunity[];
  appointments: Appointment[];
  mappings: CampaignMapping[];
}

/** Revenue from won opportunities, keyed by the campaign that produced the contact. */
function wonByContact(opportunities: Opportunity[]) {
  const map = new Map<string, number>();
  for (const o of opportunities) {
    if (o.status !== "won") continue;
    map.set(o.contact_id, (map.get(o.contact_id) ?? 0) + o.value);
  }
  return map;
}

/** One row per month: ad delivery, attention, and the CRM results tied back to ads. */
export function rollupMonthly(input: DashboardInput, months: string[]): MonthRow[] {
  const blank = (m: string): MonthRow => ({
    month: m, label: MONTH_LABELS[Number(m.slice(5)) - 1], spend: 0, clicks: 0, impressions: 0, reach: 0, engagements: 0,
    video_views: 0, landing_page_views: 0, leads: 0, appointments: 0, sales: 0, revenue: 0, google_leads: 0, meta_leads: 0, unattributed: 0,
  });
  const rows = new Map<string, MonthRow>(months.map((m) => [m, blank(m)]));
  const platformOf = new Map<string, string>();
  for (const r of input.metrics) {
    platformOf.set(r.campaign_id, r.platform);
    const row = rows.get(monthKey(r.date));
    if (!row) continue;
    row.spend += r.spend;
    row.clicks += r.clicks;
    row.impressions += r.impressions;
    row.reach += r.reach ?? 0;
    row.engagements += r.engagements ?? 0;
    row.video_views += r.video_views ?? 0;
    row.landing_page_views += r.landing_page_views ?? 0;
  }
  const won = wonByContact(input.opportunities);
  for (const l of input.leads) {
    const row = rows.get(monthKey(l.created_at));
    if (!row) continue;
    if (!l.campaign_id) { row.unattributed += 1; continue; } // only paid, attributed leads count below
    row.leads += 1;
    const p = platformOf.get(l.campaign_id);
    if (p === "google") row.google_leads += 1;
    else if (p === "meta") row.meta_leads += 1;
    const value = won.get(l.ghl_contact_id);
    if (value !== undefined) { row.sales += 1; row.revenue += value; }
  }
  const paidContacts = new Set(input.leads.filter((l) => l.campaign_id).map((l) => l.ghl_contact_id));
  for (const a of input.appointments) {
    if (!paidContacts.has(a.contact_id) || a.status === "cancelled") continue;
    const row = rows.get(monthKey(a.starts_at));
    if (row) row.appointments += 1;
  }
  const current = monthKey(new Date());
  return months.map((m) => {
    const r = rows.get(m)!;
    // The current month is partial; label it so a lower bar doesn't read as a drop.
    return { ...r, label: m === current ? `${r.label} (MTD)` : r.label, spend: Math.round(r.spend), revenue: Math.round(r.revenue) };
  });
}

export function campaignRows(input: DashboardInput, months: string[]): CampaignRow[] {
  const inRange = new Set(months);
  const byId = new Map<string, CampaignRow>();
  const mapping = new Map(input.mappings.map((m) => [m.campaign_id, m.product_or_service]));
  for (const r of input.metrics) {
    if (!inRange.has(monthKey(r.date))) continue;
    const row = byId.get(r.campaign_id) ?? {
      platform: r.platform, campaign_id: r.campaign_id, campaign_name: r.campaign_name,
      spend: 0, clicks: 0, impressions: 0, reach: 0, engagements: 0, landing_page_views: 0, leads: 0, revenue: 0,
      service: mapping.get(r.campaign_id) ?? null,
    };
    row.spend += r.spend;
    row.clicks += r.clicks;
    row.impressions += r.impressions;
    row.reach += r.reach ?? 0;
    row.engagements += r.engagements ?? 0;
    row.landing_page_views += r.landing_page_views ?? 0;
    byId.set(r.campaign_id, row);
  }
  const won = wonByContact(input.opportunities);
  for (const l of input.leads) {
    if (!l.campaign_id || !inRange.has(monthKey(l.created_at))) continue;
    const row = byId.get(l.campaign_id);
    if (!row) continue;
    row.leads += 1;
    row.revenue += won.get(l.ghl_contact_id) ?? 0;
  }
  return [...byId.values()]
    .map((r) => ({ ...r, spend: Math.round(r.spend), revenue: Math.round(r.revenue) }))
    .sort((a, b) => b.spend - a.spend);
}

export function pctChange(now: number, before: number): number | null {
  if (!before) return null;
  return ((now - before) / before) * 100;
}

export const money = (n: number, digits = 0) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits, minimumFractionDigits: digits });
export const num = (n: number) => n.toLocaleString("en-US");
