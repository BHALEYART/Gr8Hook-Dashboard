// Ties a store order back to an ad platform/campaign from the visit that led to it.
// Order of evidence: UTM tags on the visit → UTM tags in the landing URL → Google ad click IDs.
// fbclid is NOT credited: Facebook adds it to organic link clicks too, so it can't prove an ad click.
// Meta's own (Pixel) view of purchases is reported separately from the platform's insights.
// Some buyers will always show up unattributed (cleared cookies, other devices, offline word of mouth).
import type { Platform } from "@/lib/types";

export interface VisitLike {
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null } | null;
  landingPage?: string | null;
  referrer?: string | null;
}

export interface Attribution {
  platform: Platform | null;
  campaign_id: string | null;
  match_method: "utm" | "click_id" | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

const META = /^(facebook|fb|instagram|ig|meta|an|messenger)$/i;
const GOOGLE = /^(google|youtube|gads|adwords)$/i;
const PAID = /(cpc|ppc|paid|ads?|social[-_]?paid|paid[-_]?social|display|video)/i;

function params(url?: string | null): URLSearchParams | null {
  if (!url) return null;
  try { return new URL(url, "https://shop.example").searchParams; } catch { return null; }
}

/**
 * Uses the last visit first (last-click), then the first visit. `knownCampaigns` are the
 * campaign IDs synced from Meta/Google, so utm_campaign={{campaign.id}} resolves to a campaign.
 */
export function attributeOrder(visits: (VisitLike | null | undefined)[], knownCampaigns: Map<string, Platform>): Attribution {
  for (const v of visits) {
    if (!v) continue;
    const qs = params(v.landingPage);
    const utm = {
      source: v.utm?.source ?? qs?.get("utm_source") ?? null,
      medium: v.utm?.medium ?? qs?.get("utm_medium") ?? null,
      campaign: v.utm?.campaign ?? qs?.get("utm_campaign") ?? null,
      content: v.utm?.content ?? qs?.get("utm_content") ?? null,
    };
    const base = { utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign, utm_content: utm.content };

    // 1. utm_campaign carries a synced campaign ID: exact match.
    if (utm.campaign && knownCampaigns.has(utm.campaign)) {
      return { ...base, platform: knownCampaigns.get(utm.campaign)!, campaign_id: utm.campaign, match_method: "utm" };
    }
    // 2. Paid UTM source without a matching campaign ID: credit the platform only.
    if (utm.source && (META.test(utm.source) || GOOGLE.test(utm.source)) && (!utm.medium || PAID.test(utm.medium))) {
      return { ...base, platform: META.test(utm.source) ? "meta" : "google", campaign_id: null, match_method: "utm" };
    }
    // 3. Google ad click IDs in the landing URL (only added to paid clicks when auto-tagging is on).
    if (qs?.get("gclid") || qs?.get("gbraid") || qs?.get("wbraid")) return { ...base, platform: "google", campaign_id: null, match_method: "click_id" };
  }
  const first = visits.find(Boolean);
  const qs = params(first?.landingPage);
  return {
    platform: null, campaign_id: null, match_method: null,
    utm_source: first?.utm?.source ?? qs?.get("utm_source") ?? null,
    utm_medium: first?.utm?.medium ?? qs?.get("utm_medium") ?? null,
    utm_campaign: first?.utm?.campaign ?? qs?.get("utm_campaign") ?? null,
    utm_content: first?.utm?.content ?? qs?.get("utm_content") ?? null,
  };
}
