// GoHighLevel API v2 (LeadConnector) — contacts with attribution, opportunities and appointments.
// Auth: a Private Integration token per sub-account (location), stored encrypted in Supabase Vault.
// Endpoint paths, query names and attribution fields have changed between versions —
// check each call against https://highlevel.stoplight.io/docs/integrations before going live.

const BASE = "https://services.leadconnectorhq.com";
const VERSION_HEADER = "2021-07-28"; // GHL's v2 API version header; confirm in the docs

async function ghl<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Version: VERSION_HEADER, Accept: "application/json", "Content-Type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`GHL ${path} failed: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** GHL contact attribution, normalized. GHL stores first-touch and last-touch attribution on the contact. */
export interface GhlContact {
  ghl_contact_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created_at: string;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  gclid: string | null;
  fbclid: string | null;
}

// Loose shape: field names vary between API versions and contact sources.
type RawAttribution = Record<string, string | undefined>;
interface RawContact {
  id: string;
  firstName?: string; lastName?: string; contactName?: string;
  email?: string; phone?: string; dateAdded?: string; source?: string;
  attributionSource?: RawAttribution;
  lastAttributionSource?: RawAttribution;
}

const pick = (a: RawAttribution | undefined, ...keys: string[]) => {
  for (const k of keys) if (a?.[k]) return a[k]!;
  return null;
};

export function normalizeContact(c: RawContact): GhlContact {
  const first = c.attributionSource; // first touch is what credits the ad that found them
  return {
    ghl_contact_id: c.id,
    name: c.contactName ?? ([c.firstName, c.lastName].filter(Boolean).join(" ") || null),
    email: c.email ?? null,
    phone: c.phone ?? null,
    created_at: c.dateAdded ?? new Date().toISOString(),
    source: pick(first, "adSource", "utmSource", "sessionSource", "medium") ?? c.source ?? null,
    utm_source: pick(first, "utmSource"),
    utm_medium: pick(first, "utmMedium"),
    utm_campaign: pick(first, "utmCampaign", "campaign"),
    utm_content: pick(first, "utmContent"),
    gclid: pick(first, "gclid"),
    fbclid: pick(first, "fbclid"),
  };
}

/** Contacts added on or after `since` (ISO date). Paginates with searchAfter. */
export async function fetchContacts(token: string, locationId: string, since: string): Promise<GhlContact[]> {
  const out: GhlContact[] = [];
  let searchAfter: unknown[] | undefined;
  for (let page = 0; page < 50; page++) {
    const body = await ghl<{ contacts: (RawContact & { searchAfter?: unknown[] })[] }>(token, "/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        locationId,
        pageLimit: 100,
        ...(searchAfter ? { searchAfter } : {}),
        filters: [{ field: "dateAdded", operator: "range", value: { gte: since } }],
        sort: [{ field: "dateAdded", direction: "asc" }],
      }),
    });
    out.push(...body.contacts.map(normalizeContact));
    if (body.contacts.length < 100) break;
    searchAfter = body.contacts[body.contacts.length - 1].searchAfter;
    if (!searchAfter) break;
  }
  return out;
}

export interface GhlOpportunity {
  ghl_opportunity_id: string;
  ghl_contact_id: string | null;
  pipeline: string | null;
  stage: string | null;
  status: "open" | "won" | "lost" | "abandoned";
  value: number;
  service: string | null;
  updated_at: string;
}

export async function fetchOpportunities(token: string, locationId: string): Promise<GhlOpportunity[]> {
  const out: GhlOpportunity[] = [];
  for (let page = 1; page <= 50; page++) {
    const body = await ghl<{ opportunities: Record<string, unknown>[] }>(
      token, `/opportunities/search?location_id=${encodeURIComponent(locationId)}&limit=100&page=${page}`,
    );
    for (const o of body.opportunities) {
      out.push({
        ghl_opportunity_id: String(o.id),
        ghl_contact_id: (o.contactId as string) ?? null,
        pipeline: (o.pipelineId as string) ?? null,
        stage: (o.pipelineStageId as string) ?? null,
        status: ((o.status as string) ?? "open") as GhlOpportunity["status"],
        value: Number(o.monetaryValue ?? 0),
        service: null, // TODO: map from a custom field or pipeline name per client
        updated_at: (o.updatedAt as string) ?? new Date().toISOString(),
      });
    }
    if (body.opportunities.length < 100) break;
  }
  return out;
}

export interface GhlAppointment {
  ghl_appointment_id: string;
  ghl_contact_id: string | null;
  starts_at: string;
  status: "booked" | "confirmed" | "showed" | "noshow" | "cancelled";
}

/** Calendar events between two timestamps. GHL requires a calendar (or user/group) to scope the query. */
export async function fetchAppointments(token: string, locationId: string, calendarIds: string[], since: string, until: string): Promise<GhlAppointment[]> {
  const out: GhlAppointment[] = [];
  for (const calendarId of calendarIds) {
    const q = new URLSearchParams({ locationId, calendarId, startTime: String(Date.parse(since)), endTime: String(Date.parse(until)) });
    const body = await ghl<{ events: Record<string, unknown>[] }>(token, `/calendars/events?${q}`);
    for (const e of body.events ?? []) {
      out.push({
        ghl_appointment_id: String(e.id),
        ghl_contact_id: (e.contactId as string) ?? null,
        starts_at: (e.startTime as string) ?? since,
        status: (((e.appointmentStatus as string) ?? "booked").replace("no_show", "noshow")) as GhlAppointment["status"],
      });
    }
  }
  return out;
}
