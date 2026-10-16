// Meta Marketing API — daily campaign insights for one ad account.
// Uses a long-lived System User token from your Business Manager (needs ads_read).
// Confirm the current Graph API version at https://developers.facebook.com/docs/graph-api/changelog
import type { AdMetricDaily } from "@/lib/types";

interface InsightRow {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  actions?: { action_type: string; value: string }[];
  action_values?: { action_type: string; value: string }[];
}

// Which action types count as a "conversion". Adjust per client (lead, purchase, schedule…).
const CONVERSION_ACTIONS = new Set(["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "purchase", "schedule"]);

export async function fetchMetaDaily(clientId: string, adAccountId: string, since: string, until: string): Promise<AdMetricDaily[]> {
  const version = process.env.META_API_VERSION; // e.g. "vNN.0"
  const token = process.env.META_ACCESS_TOKEN;
  if (!version || !token) throw new Error("META_API_VERSION / META_ACCESS_TOKEN not set");

  const act = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const params = new URLSearchParams({
    level: "campaign",
    time_increment: "1",
    fields: "campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: token,
  });
  let url: string | null = `https://graph.facebook.com/${version}/${act}/insights?${params}`;
  const out: AdMetricDaily[] = [];

  while (url) {
    const res: Response = await fetch(url);
    if (!res.ok) throw new Error(`Meta insights failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { data: InsightRow[]; paging?: { next?: string } };
    for (const r of body.data) {
      const conv = (r.actions ?? []).filter((a) => CONVERSION_ACTIONS.has(a.action_type)).reduce((s, a) => s + Number(a.value), 0);
      const action = (type: string) => Number((r.actions ?? []).find((a) => a.action_type === type)?.value ?? 0);
      const value = (r.action_values ?? []).filter((a) => CONVERSION_ACTIONS.has(a.action_type)).reduce((s, a) => s + Number(a.value), 0);
      out.push({
        client_id: clientId,
        platform: "meta",
        campaign_id: r.campaign_id,
        campaign_name: r.campaign_name,
        date: r.date_start,
        spend: Number(r.spend ?? 0),
        impressions: Number(r.impressions ?? 0),
        clicks: Number(r.clicks ?? 0),
        conversions: conv,
        conversion_value: value,
        // Daily reach is people reached that day; summing days slightly overcounts repeat viewers.
        reach: Number(r.reach ?? 0),
        engagements: action("post_engagement"),
        video_views: action("video_view"),
        landing_page_views: action("landing_page_view"),
      });
    }
    url = body.paging?.next ?? null;
  }
  return out;
}
