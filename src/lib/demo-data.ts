// Sample data for demo mode. Deterministic (seeded) so screens look the same on every load.
import type {
  AdMetricDaily, Annotation, Appointment, CampaignMapping, Client, ClientService, Lead, Opportunity, StoreOrder, StoreOrderLine,
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
  { id: "demo-roofing", name: "Northside Roofing (demo)", status: "active", primary_goal: "sales", brand_color: null,
    google_ads_customer_id: "123-456-7890", meta_ad_account_id: "act_100200300", ghl_location_id: "loc_demo_roof", created_at: "2025-08-01" },
  { id: "demo-salon", name: "Bella Salon & Spa (demo)", status: "active", primary_goal: "appointments", brand_color: null,
    google_ads_customer_id: null, meta_ad_account_id: "act_400500600", ghl_location_id: "loc_demo_salon", created_at: "2025-11-01" },
  { id: "demo-fitness", name: "Peak Form Coaching (demo)", status: "active", primary_goal: "leads", brand_color: null,
    lead_label: "Consult requests",
    google_ads_customer_id: "234-567-8901", meta_ad_account_id: "act_700800900", ghl_location_id: "loc_demo_fit", created_at: "2025-09-01" },
  { id: "demo-creator", name: "Kayla Rae Creative Course (demo)", status: "active", primary_goal: "sales", brand_color: null,
    lead_label: "Email signups", show_reach: true,
    google_ads_customer_id: "345-678-9012", meta_ad_account_id: "act_810910010", ghl_location_id: "loc_demo_creator", created_at: "2025-10-01" },
  { id: "demo-shop", name: "Lakeshore Candle Co. (demo)", status: "active", primary_goal: "ecommerce", brand_color: null,
    shopify_shop: "lakeshore-candle.myshopify.com", shopify_client_id: "demo",
    google_ads_customer_id: "456-789-0123", meta_ad_account_id: "act_920020030", ghl_location_id: null, created_at: "2025-08-15" },
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
  { client_id: "demo-fitness", service: "meta_ads", enabled: true },
  { client_id: "demo-fitness", service: "google_ads", enabled: true },
  { client_id: "demo-fitness", service: "ghl", enabled: true },
  { client_id: "demo-fitness", service: "callrail", enabled: false },
  { client_id: "demo-creator", service: "meta_ads", enabled: true },
  { client_id: "demo-creator", service: "google_ads", enabled: true },
  { client_id: "demo-creator", service: "ghl", enabled: true },
  { client_id: "demo-creator", service: "callrail", enabled: false },
  { client_id: "demo-shop", service: "meta_ads", enabled: true },
  { client_id: "demo-shop", service: "google_ads", enabled: true },
  { client_id: "demo-shop", service: "shopify", enabled: true },
  { client_id: "demo-shop", service: "ghl", enabled: false },
  { client_id: "demo-shop", service: "callrail", enabled: false },
];

interface CampaignDef {
  id: string; name: string; platform: "google" | "meta"; daily: number; cpc: number; cvr: number; close: number; value: number; service: string;
  ipc?: number;   // impressions per click (awareness campaigns run much higher)
  appt?: number;  // share of leads that book an appointment (default 0.7)
  er?: number;    // engagements per impression
  vvr?: number;   // video views per impression
  freq?: number;  // impressions per person reached
}

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
  "demo-fitness": [
    { id: "m-51001", name: "Meta | Free Body Comp Consult", platform: "meta", daily: 32, cpc: 2.1, cvr: 0.06, close: 0.3, value: 1500, service: "12-Week Coaching", appt: 0.62 },
    { id: "m-51002", name: "Meta | Transformation Stories", platform: "meta", daily: 18, cpc: 1.4, cvr: 0.035, close: 0.22, value: 1500, service: "12-Week Coaching", appt: 0.55, vvr: 0.22 },
    { id: "g-52001", name: "Search | Personal Trainer Near Me", platform: "google", daily: 24, cpc: 3.8, cvr: 0.1, close: 0.4, value: 900, service: "Personal Training", appt: 0.7, vvr: 0 },
    { id: "m-51003", name: "Meta | Consult Retargeting", platform: "meta", daily: 10, cpc: 1.6, cvr: 0.08, close: 0.4, value: 1500, service: "12-Week Coaching", appt: 0.68 },
  ],
  "demo-creator": [
    { id: "m-61001", name: "Reels | Course Trailer", platform: "meta", daily: 55, cpc: 0.38, cvr: 0.018, close: 0.18, value: 397, service: "Creator Course", ipc: 140, appt: 0, er: 0.045, vvr: 0.38, freq: 1.7 },
    { id: "m-61002", name: "Meta | Free Masterclass Signup", platform: "meta", daily: 38, cpc: 0.75, cvr: 0.14, close: 0.2, value: 397, service: "Creator Course", ipc: 60, appt: 0, er: 0.02, vvr: 0.12 },
    { id: "m-61003", name: "Meta | Checkout Retargeting", platform: "meta", daily: 14, cpc: 0.95, cvr: 0.22, close: 0.6, value: 397, service: "Creator Course", ipc: 45, appt: 0, er: 0.015, vvr: 0.08, freq: 3.2 },
    { id: "g-62001", name: "YouTube | Creator Course Preview", platform: "google", daily: 22, cpc: 0.32, cvr: 0.02, close: 0.17, value: 397, service: "Creator Course", ipc: 160, appt: 0, er: 0.025, vvr: 0.42, freq: 2.1 },
  ],
};

const NOTES: Record<string, [number, string][]> = {
  "demo-fitness": [[5, "New Year challenge creative launched"], [3, "Added consult retargeting"], [1, "Raised Google budget 20%"]],
  "demo-creator": [[6, "Course trailer Reel went live"], [4, "Free masterclass funnel launched"], [2, "Cart-open week + checkout retargeting"]],
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
  if (STORE_CAMPAIGNS[clientId]) {
    const st = demoStore(clientId);
    const bundle: DemoBundle = { metrics: st.metrics, leads: [], opportunities: [], appointments: [], mappings: st.mappings, annotations: st.annotations };
    cache.set(clientId, bundle);
    return bundle;
  }
  const r = rng(clientId.length * 7919 + clientId.charCodeAt(5));
  const ra = rng(clientId.length * 104729 + clientId.charCodeAt(6)); // separate stream for attention metrics
  const camps = CAMPAIGNS[clientId] ?? [];
  const metrics: AdMetricDaily[] = [];
  const leads: Lead[] = [];
  const opportunities: Opportunity[] = [];
  const appointments: Appointment[] = [];
  const today = new Date();
  const DAYS = 760; // two years, so a 12-month view has a full prior period to compare against
  let n = 0;

  for (let d = DAYS; d >= 0; d--) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d));
    const iso = date.toISOString().slice(0, 10);
    const ramp = 0.7 + 0.6 * ((DAYS - d) / DAYS); // spend and efficiency improve over time
    for (const c of camps) {
      const spend = c.daily * (0.85 + r() * 0.3) * (0.9 + 0.2 * ((DAYS - d) / DAYS));
      const clicks = Math.max(0, Math.round((spend / c.cpc) * (0.85 + r() * 0.3)));
      const impressions = Math.round(clicks * (c.ipc ? c.ipc * (0.85 + r() * 0.3) : 35 + r() * 30));
      const search = c.platform === "google" && !c.ipc;
      const reach = Math.round(impressions / ((c.freq ?? (search ? 1.3 : 1.9)) * (0.9 + ra() * 0.2)));
      const engagements = Math.round(impressions * (c.er ?? (search ? 0 : 0.012)) * (0.8 + ra() * 0.4));
      const video_views = Math.round(impressions * (c.vvr ?? (search ? 0 : 0.08)) * (0.8 + ra() * 0.4));
      const landing_page_views = Math.round(clicks * (0.62 + ra() * 0.2));
      const expLeads = clicks * c.cvr * ramp;
      const count = Math.floor(expLeads) + (r() < expLeads % 1 ? 1 : 0);
      metrics.push({ client_id: clientId, platform: c.platform, campaign_id: c.id, campaign_name: c.name, date: iso,
        spend: Math.round(spend * 100) / 100, impressions, clicks, conversions: count, conversion_value: 0,
        reach, engagements, video_views, landing_page_views });
      for (let i = 0; i < count; i++) {
        n++;
        const contact = `${clientId}-c${n}`;
        leads.push({ id: `${contact}-l`, client_id: clientId, ghl_contact_id: contact,
          name: `${FIRST[Math.floor(r() * FIRST.length)]} ${LAST[Math.floor(r() * LAST.length)]}`,
          created_at: `${iso}T${String(8 + Math.floor(r() * 11)).padStart(2, "0")}:15:00Z`,
          source: c.platform === "google" ? "google" : "facebook", utm_campaign: c.id, campaign_id: c.id,
          gclid: c.platform === "google" ? `gclid_${n}` : null, fbclid: c.platform === "meta" ? `fbclid_${n}` : null });
        if (r() < (c.appt ?? 0.7)) {
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
  const notes: [number, string][] = NOTES[clientId] ?? [[4, "Launched new offer creative"], [2, "Added retargeting audience"]];
  const annotations: Annotation[] = notes.map(([back, note], i) => ({ id: `${clientId}-n${i + 1}`, client_id: clientId, date: m(back), note }));
  const bundle = { metrics, leads, opportunities, appointments, mappings, annotations };
  cache.set(clientId, bundle);
  return bundle;
}

// ───────────────────────── E-commerce demo (Shopify) ─────────────────────────

interface Product { id: string; title: string; price: number }
const PRODUCTS: Product[] = [
  { id: "p-pine", title: "Lakeside Pine Candle", price: 32 },
  { id: "p-cedar", title: "Cedar & Smoke Candle", price: 34 },
  { id: "p-lav", title: "Lavender Fields Candle", price: 28 },
  { id: "p-gift", title: "Seasonal 3-Pack Gift Set", price: 79 },
  { id: "p-melt", title: "Wax Melt Sampler", price: 22 },
  { id: "p-trim", title: "Wick Trimmer", price: 18 },
];
const WEIGHTS = [0.24, 0.2, 0.18, 0.16, 0.13, 0.09];

interface StoreCampaign { id: string; name: string; platform: "google" | "meta"; daily: number; cpc: number; cvr: number; focus?: string; reportX: number }
const STORE_CAMPAIGNS: Record<string, StoreCampaign[]> = {
  "demo-shop": [
    { id: "m-71001", name: "Advantage+ Shopping | All Candles", platform: "meta", daily: 55, cpc: 0.95, cvr: 0.028, reportX: 1.35 },
    { id: "m-71002", name: "Retargeting | Cart Abandoners", platform: "meta", daily: 18, cpc: 1.15, cvr: 0.065, reportX: 1.3 },
    { id: "m-71003", name: "Reels | Gift Set Launch", platform: "meta", daily: 24, cpc: 0.7, cvr: 0.016, focus: "p-gift", reportX: 1.45 },
    { id: "g-72001", name: "Shopping | Candles", platform: "google", daily: 32, cpc: 0.62, cvr: 0.03, reportX: 1.1 },
    { id: "g-72002", name: "Search | Lakeshore Candle (Brand)", platform: "google", daily: 7, cpc: 0.45, cvr: 0.08, reportX: 1.05 },
  ],
};
const STORE_NOTES: Record<string, [number, string][]> = {
  "demo-shop": [[5, "Advantage+ Shopping launched"], [3, "Cart abandoner retargeting added"], [1, "Gift set Reels for the holidays"]],
};

const storeCache = new Map<string, { metrics: AdMetricDaily[]; orders: StoreOrder[]; lines: StoreOrderLine[]; mappings: CampaignMapping[]; annotations: Annotation[] }>();

/** Sample Shopify orders, their ad sources, and the platform-reported (Pixel / Google tag) purchases. */
export function demoStore(clientId: string) {
  const hit = storeCache.get(clientId);
  if (hit) return hit;
  const r = rng(clientId.length * 31337 + clientId.charCodeAt(5));
  const camps = STORE_CAMPAIGNS[clientId] ?? [];
  const metrics: AdMetricDaily[] = [];
  const orders: StoreOrder[] = [];
  const lines: StoreOrderLine[] = [];
  const today = new Date();
  const DAYS = 760; // two years, so a 12-month view has a full prior period to compare against
  let num = 1000, lineNo = 0;

  const pick = (focus?: string) => {
    if (focus && r() < 0.65) return PRODUCTS.find((p) => p.id === focus)!;
    let x = r();
    for (let i = 0; i < PRODUCTS.length; i++) { x -= WEIGHTS[i]; if (x <= 0) return PRODUCTS[i]; }
    return PRODUCTS[0];
  };
  const makeOrder = (iso: string, attrib: Partial<StoreOrder>, focus?: string) => {
    num++;
    const id = `${clientId}-o${num}`;
    const items = 1 + (r() < 0.35 ? 1 : 0) + (r() < 0.1 ? 1 : 0);
    const used = new Set<string>();
    let total = 0;
    for (let i = 0; i < items; i++) {
      const p = pick(i === 0 ? focus : undefined);
      if (used.has(p.id)) continue;
      used.add(p.id);
      const qty = r() < 0.2 ? 2 : 1;
      const amount = Math.round(p.price * qty * (r() < 0.15 ? 0.85 : 1) * 100) / 100;
      total += amount;
      lines.push({ client_id: clientId, order_id: id, line_id: `${id}-l${++lineNo}`, product_id: p.id, product_title: p.title, variant_title: null, quantity: qty, amount });
    }
    const shipping = total >= 60 ? 0 : 6.95;
    orders.push({
      client_id: clientId, order_id: id, name: `#${num}`, created_at: `${iso}T${String(9 + Math.floor(r() * 12)).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}:00Z`,
      total: Math.round((total + shipping) * 100) / 100, currency: "USD", cancelled: r() < 0.02,
      platform: null, campaign_id: null, match_method: null, utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null,
      landing_page: "/", referrer: null, ...attrib,
    });
    return total + shipping;
  };

  for (let d = DAYS; d >= 0; d--) {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d));
    const iso = date.toISOString().slice(0, 10);
    const month = date.getUTCMonth();
    const season = month === 10 ? 1.45 : month === 11 ? 1.8 : month === 0 ? 0.8 : month >= 5 && month <= 7 ? 0.85 : 1;
    const ramp = 0.75 + 0.5 * ((DAYS - d) / DAYS);
    for (const c of camps) {
      const spend = c.daily * (0.85 + r() * 0.3) * (season > 1 ? 1 + (season - 1) * 0.6 : 1);
      const clicks = Math.max(0, Math.round((spend / c.cpc) * (0.85 + r() * 0.3)));
      const exp = clicks * c.cvr * ramp * Math.sqrt(season);
      const buys = Math.floor(exp) + (r() < exp % 1 ? 1 : 0);
      let value = 0;
      for (let i = 0; i < buys; i++) {
        const x = r();
        // Most ad buyers keep their UTM tags; some lose them (other device, cleared cookies) and land as unattributed.
        const attrib: Partial<StoreOrder> = x < 0.76
          ? { platform: c.platform, campaign_id: c.id, match_method: "utm", utm_source: c.platform === "meta" ? "facebook" : "google",
              utm_medium: c.platform === "meta" ? "paid" : "cpc", utm_campaign: c.id, landing_page: `/products?utm_campaign=${c.id}` }
          : x < 0.84 && c.platform === "google"
            ? { platform: "google", match_method: "click_id", landing_page: "/collections/candles?gclid=demo" }
            : { landing_page: "/" };
        value += makeOrder(iso, attrib, c.focus);
      }
      // What the ad platform reports (Pixel / Google tag): includes view-through and modeled purchases.
      const reported = Math.round(buys * c.reportX + (r() - 0.5));
      metrics.push({ client_id: clientId, platform: c.platform, campaign_id: c.id, campaign_name: c.name, date: iso,
        spend: Math.round(spend * 100) / 100, impressions: Math.round(clicks * (40 + r() * 30)), clicks,
        conversions: Math.max(0, reported), conversion_value: Math.round(value * c.reportX * 100) / 100 });
    }
    // Organic, email and direct orders
    const organic = 2.4 * season * ramp;
    const n = Math.floor(organic) + (r() < organic % 1 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const x = r();
      makeOrder(iso, x < 0.25 ? { utm_source: "klaviyo", utm_medium: "email", landing_page: "/?utm_source=klaviyo&utm_medium=email" }
        : x < 0.4 ? { utm_source: "instagram", utm_medium: "social", referrer: "https://instagram.com/", landing_page: "/?utm_source=instagram&utm_medium=social" }
        : { referrer: x < 0.6 ? "https://www.google.com/" : null });
    }
  }
  const mappings = camps.map((c) => ({ client_id: clientId, campaign_id: c.id, product_or_service: c.focus ? PRODUCTS.find((p) => p.id === c.focus)!.title : "All products" }));
  const annotations: Annotation[] = (STORE_NOTES[clientId] ?? []).map(([back, note], i) => ({
    id: `${clientId}-n${i + 1}`, client_id: clientId, note,
    date: new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 8)).toISOString().slice(0, 10),
  }));
  const out = { metrics, orders, lines, mappings, annotations };
  storeCache.set(clientId, out);
  return out;
}

// ───────────── Demo leads from the free website audit ─────────────
import { recommendations as auditRecs, scoreLead as auditScore } from "@/lib/audit-leads";
import type { AuditResult, Check } from "@/lib/site-audit";
import type { AuditLead } from "@/lib/types";

let demoLeadsCache: AuditLead[] | null = null;
export function demoAuditLeads(): AuditLead[] {
  if (demoLeadsCache) return demoLeadsCache;
  const ck = (id: string, group: Check["group"], status: Check["status"], title: string, detail = ""): Check => ({ id, group, status, title, detail });
  const base = (pass: string[]): Check[] => [
    ck("https", "security", "pass", "HTTPS enabled"), ck("title", "seo", pass.includes("title") ? "pass" : "warn", pass.includes("title") ? "Page title found" : "Page title could be stronger"),
    ck("description", "seo", pass.includes("description") ? "pass" : "warn", pass.includes("description") ? "Page description found" : "Missing page description"),
    ck("call", "conversion", pass.includes("call") ? "pass" : "warn", pass.includes("call") ? "Click-to-call link found" : "No click-to-call link found"),
    ck("form", "conversion", pass.includes("form") ? "pass" : "warn", pass.includes("form") ? "Contact or lead form found" : "No lead form detected on this page"),
    ck("ga", "tracking", pass.includes("ga") ? "pass" : "warn", pass.includes("ga") ? "Google tag detected" : "No Google tag detected"),
    ck("pixel", "tracking", pass.includes("pixel") ? "pass" : "info", pass.includes("pixel") ? "Meta Pixel detected" : "No Meta Pixel detected"),
  ];
  const rows: [string, string, string, string, string | null, string, number, string[], number][] = [
    ["Maria Lopez", "Lopez Family Dental", "maria@lopezfamilydental.com", "https://lopezfamilydental.com/", "(616) 555-0142", "ads_roi", 34, ["title", "call", "form"], 2],
    ["Derek Shaw", "Shaw Roofing & Gutters", "derek@shawroofing.co", "https://shawroofing.co/", "(248) 555-0187", "follow_up", 58, ["title", "description", "ga"], 6],
    ["Tanya Brooks", "Glow Studio Spa", "glowstudiospa@gmail.com", "https://glowstudiospa.com/", null, "unknown_results", 71, ["title", "description", "call", "form"], 26],
    ["Sam Patel", "Patel Accounting", "sam@patelcpa.com", "https://patelcpa.com/", null, "google", 92, ["title", "description", "call", "form", "ga", "pixel"], 50],
  ];
  demoLeadsCache = rows.map(([name, business, email, website, phone, concern, perf, pass, hoursAgo], i) => {
    const audit: AuditResult = {
      url: website, finalUrl: website, fetchedAt: new Date(Date.now() - hoursAgo * 36e5).toISOString(),
      mobile: { performance: perf, accessibility: 84, seo: pass.includes("description") ? 92 : 75, bestPractices: 96 },
      desktop: { performance: Math.min(99, perf + 25), accessibility: 84, seo: pass.includes("description") ? 92 : 75, bestPractices: 96 },
      metrics: [{ label: "Main content loads (mobile)", value: `${(9 - perf / 14).toFixed(1)} s`, status: perf >= 90 ? "pass" : perf >= 50 ? "warn" : "fail" }],
      lighthouseIssues: perf < 90 ? [{ title: "Images are larger than they need to be", category: "Speed", status: perf < 50 ? "fail" : "warn" }] : [],
      checks: base(pass), notes: [],
    };
    const recs = auditRecs(audit);
    const s = auditScore(audit, { email, phone, concern });
    return {
      id: `demo-lead-${i + 1}`, created_at: audit.fetchedAt, status: i === 3 ? "contacted" : "new", name, business, email, phone, concern,
      concern_detail: i === 1 ? "We get calls from the ads but nobody has time to follow up quickly." : null,
      website, audited_at: audit.fetchedAt, scores: { mobile: audit.mobile, desktop: audit.desktop },
      issues: [...audit.checks.filter((c) => c.status === "warn" || c.status === "fail").map(({ title, detail, status, group }) => ({ title, detail, status, group })),
        ...audit.lighthouseIssues.map((x) => ({ title: x.title, status: x.status, group: x.category }))],
      recommendations: recs, lead_score: s.score, lead_tier: s.tier, suggested_services: s.services, score_reasons: s.reasons, notes: null,
      source: "website-audit", referrer: i === 0 ? "https://www.facebook.com/" : null, utm: (i === 0 ? { utm_source: "facebook", utm_campaign: "free-audit" } : {}) as Record<string, string>,
      consent_marketing: i !== 2, report_emailed_at: audit.fetchedAt,
    } satisfies AuditLead;
  });
  return demoLeadsCache;
}
