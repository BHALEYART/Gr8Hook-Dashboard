// Sample data for demo mode. Deterministic (seeded) so screens look the same on every load.
import type {
  AdMetricDaily, Annotation, Appointment, CampaignMapping, Client, ClientService, Lead, Opportunity,
} from "@/lib/types";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ava", "Liam", "Mia", "Noah", "Emma", "Elijah", "Olivia", "James", "Sophia", "Lucas", "Isabella", "Mason", "Harper", "Ethan", "Amelia", "Logan"];
const LAST = ["Johnson", "Smith", "Brown", "Davis", "Miller", "Wilson", "Moore", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris", "Martin"];

export const DEMO_CLIENTS: Client[] = [
  { id: "demo-roofing", name: "Northside Roofing (demo)", status: "active", primary_goal: "leads", brand_color: null,
    google_ads_customer_id: "123-456-7890", meta_ad_account_id: "act_100200300", ghl_location_id: "loc_demo_roof", created_at: "2025-08-01" },
  { id: "demo-salon", name: "Bella Salon & Spa (demo)", status: "active", primary_goal: "appointments", brand_color: null,
    google_ads_customer_id: null, meta_ad_account_id: "act_400500600", ghl_location_id: "loc_demo_salon", created_at: "2025-11-01" },
];

export const DEMO_SERVICES: ClientService[] = [
  { client_id: "demo-roofing", service: "meta_ads", enabled: true },
  { client_id: "demo-roofing", service: "google_ads", enabled: true },
  { client_id: "demo-roofing", service: "ghl", enabled: true },
  { client_id: "demo-roofing", service: "callrail", enabled: true },
  { client_id: "demo-salon", service: "meta_ads", enabled: true },
  { client_id: "demo-salon", service: "google_ads", enabled: false },
  { client_id: "demo-salon", service: "ghl", enabled: true },
  { client_id: "demo-salon", service: "callrail", enabled: false },
];

interface CampaignDef { id: string; name: string; platform: "google" | "meta"; daily: number; cpc: number; cvr: number; close: number; value: number; service: string }

const CAMPAIGNS: Record<string, CampaignDef[]> = {
  "demo-roofing": [
    { id: "g-21001", name: "Search | Roof Repair", platform: "google", daily: 45, cpc: 6.5, cvr: 0.09, close: 0.32, value: 1400, service: "Roof Repair" },
    { id: "g-21002", name: "Search | Roof Replacement", platform: "google", daily: 60, cpc: 8.2, cvr: 0.06, close: 0.22, value: 11500, service: "Roof Replacement" },
    { id: "m-31001", name: "Meta | Free Inspection Offer", platform: "meta", daily: 35, cpc: 1.6, cvr: 0.035, close: 0.18, value: 6200, service: "Roof Replacement" },
    { id: "m-31002", name: "Meta | Storm Damage Retargeting", platform: "meta", daily: 18, cpc: 1.2, cvr: 0.05, close: 0.25, value: 4800, service: "Storm Repair" },
  ],
  "demo-salon": [
    { id: "m-41001", name: "Meta | New Client Facial Offer", platform: "meta", daily: 25, cpc: 0.9, cvr: 0.06, close: 0.55, value: 140, service: "Facials" },
    { id: "m-41002", name: "Meta | Balayage Showcase", platform: "meta", daily: 20, cpc: 1.1, cvr: 0.045, close: 0.5, value: 260, service: "Hair Color" },
    { id: "m-41003", name: "Meta | Bridal Party Packages", platform: "meta", daily: 12, cpc: 1.4, cvr: 0.03, close: 0.4, value: 900, service: "Bridal" },
  ],
};

interface DemoBundle {
  metrics: AdMetricDaily[]; leads: Lead[]; opportunities: Opportunity[]; appointments: Appointment[];
  mappings: CampaignMapping[]; annotations: Annotation[];
}

// Keeps sample ROAS in a believable 3–6× range.
const CLOSE_SCALE = 0.22;

const cache = new Map<string, DemoBundle>();

export function demoBundle(clientId: string): DemoBundle {
  const hit = cache.get(clientId);
  if (hit) return hit;
  const r = rng(clientId.length * 7919 + clientId.charCodeAt(5));
  const camps = CAMPAIGNS[clientId] ?? [];
  const metrics: AdMetricDaily[] = [];
  const leads: Lead[] = [];
  const opportunities: Opportunity[] = [];
  const appointments: Appointment[] = [];
  const today = new Date();
  const DAYS = 400;
  let n = 0;

  for (let d = DAYS; d >= 0; d--) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d));
    const iso = date.toISOString().slice(0, 10);
    const ramp = 0.7 + 0.6 * ((DAYS - d) / DAYS); // spend and efficiency improve over time
    for (const c of camps) {
      const spend = c.daily * (0.85 + r() * 0.3) * (0.9 + 0.2 * ((DAYS - d) / DAYS));
      const clicks = Math.max(0, Math.round((spend / c.cpc) * (0.85 + r() * 0.3)));
      const impressions = Math.round(clicks * (35 + r() * 30));
      const expLeads = clicks * c.cvr * ramp;
      const count = Math.floor(expLeads) + (r() < expLeads % 1 ? 1 : 0);
      metrics.push({ client_id: clientId, platform: c.platform, campaign_id: c.id, campaign_name: c.name, date: iso,
        spend: Math.round(spend * 100) / 100, impressions, clicks, conversions: count, conversion_value: 0 });
      for (let i = 0; i < count; i++) {
        n++;
        const contact = `${clientId}-c${n}`;
        leads.push({ id: `${contact}-l`, client_id: clientId, ghl_contact_id: contact,
          name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
          created_at: `${iso}T${String(8 + Math.floor(r() * 11)).padStart(2, "0")}:15:00Z`,
          source: c.platform === "google" ? "google" : "facebook", utm_campaign: c.id, campaign_id: c.id,
          gclid: c.platform === "google" ? `gclid_${n}` : null, fbclid: c.platform === "meta" ? `fbclid_${n}` : null });
        if (r() < 0.7) {
          appointments.push({ id: `${contact}-a`, client_id: clientId, contact_id: contact,
            starts_at: `${iso}T15:00:00Z`, status: r() < 0.82 ? "showed" : "noshow" });
        }
        const won = r() < c.close * ramp * CLOSE_SCALE;
        opportunities.push({ id: `${contact}-o`, client_id: clientId, contact_id: contact, pipeline: "Sales", service: c.service,
          stage: won ? "Closed Won" : "Follow Up", status: won ? "won" : "open",
          value: won ? Math.round(c.value * (0.7 + r() * 0.6)) : 0, updated_at: iso });
      }
    }
    // Some organic / unattributed leads every few days
    if (r() < 0.35) {
      n++;
      leads.push({ id: `${clientId}-c${n}-l`, client_id: clientId, ghl_contact_id: `${clientId}-c${n}`,
        name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
        created_at: `${iso}T12:00:00Z`, source: "direct", utm_campaign: null, campaign_id: null, gclid: null, fbclid: null });
    }
  }

  const mappings = camps.map((c) => ({ client_id: clientId, campaign_id: c.id, product_or_service: c.service }));
  const m = (back: number) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 5));
    return d.toISOString().slice(0, 10);
  };
  const annotations: Annotation[] = [
    { id: `${clientId}-n1`, client_id: clientId, date: m(4), note: "Launched new offer creative" },
    { id: `${clientId}-n2`, client_id: clientId, date: m(2), note: "Added retargeting audience" },
  ];
  const bundle = { metrics, leads, opportunities, appointments, mappings, annotations };
  cache.set(clientId, bundle);
  return bundle;
}
