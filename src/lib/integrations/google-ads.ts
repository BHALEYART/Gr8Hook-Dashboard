// Google Ads API — daily campaign metrics for one customer account under your MCC.
// Requires an approved developer token (apply from your MCC: Tools → API Center).
// Before going live, confirm the current API version at https://developers.google.com/google-ads/api/docs/release-notes
import type { AdMetricDaily } from "@/lib/types";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

async function accessToken(): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_ADS_CLIENT_ID"),
      client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_ADS_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

interface Row {
  campaign: { id: string; name: string };
  segments: { date: string };
  metrics: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number };
}

export async function fetchGoogleAdsDaily(clientId: string, customerId: string, since: string, until: string): Promise<AdMetricDaily[]> {
  const version = env("GOOGLE_ADS_API_VERSION"); // e.g. "vNN"
  const cid = customerId.replace(/-/g, "");
  const query = `
    SELECT campaign.id, campaign.name, segments.date,
           metrics.cost_micros, metrics.impressions, metrics.clicks,
           metrics.conversions, metrics.conversions_value
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'`;

  const res = await fetch(`https://googleads.googleapis.com/${version}/customers/${cid}/googleAds:searchStream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "developer-token": env("GOOGLE_ADS_DEVELOPER_TOKEN"),
      "login-customer-id": env("GOOGLE_ADS_LOGIN_CUSTOMER_ID").replace(/-/g, ""), // your MCC ID
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Google Ads query failed: ${res.status} ${await res.text()}`);

  // searchStream returns an array of batches, each with `results`.
  const batches = (await res.json()) as { results?: Row[] }[];
  return batches.flatMap((b) => b.results ?? []).map((r) => ({
    client_id: clientId,
    platform: "google" as const,
    campaign_id: String(r.campaign.id),
    campaign_name: r.campaign.name,
    date: r.segments.date,
    spend: Number(r.metrics.costMicros ?? 0) / 1_000_000,
    impressions: Number(r.metrics.impressions ?? 0),
    clicks: Number(r.metrics.clicks ?? 0),
    conversions: Number(r.metrics.conversions ?? 0),
    conversion_value: Number(r.metrics.conversionsValue ?? 0),
  }));
}
