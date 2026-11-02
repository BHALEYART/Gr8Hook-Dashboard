// Meta Marketing API — daily campaign insights for one ad account.
// Token: the client's own "Connect Facebook" token (Vault) when they've connected, otherwise the
// shared System User token from your Business Manager (META_ACCESS_TOKEN, needs ads_read).
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

export async function fetchMetaDaily(clientId: string, adAccountId: string, since: string, until: string, clientToken?: string | null): Promise<AdMetricDaily[]> {
  const version = process.env.META_API_VERSION; // e.g. "vNN.0"
  const token = clientToken || process.env.META_ACCESS_TOKEN;
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

// ───────────── "Connect Facebook" (Facebook Login) ─────────────
// Needs META_APP_ID + META_APP_SECRET, Facebook Login added to the app, and
// {SITE}/api/connect/meta/callback in its Valid OAuth Redirect URIs.
// With META_LOGIN_CONFIG_ID (Facebook Login for Business configuration) the dialog uses that config instead of scopes.
const graph = () => `https://graph.facebook.com/${process.env.META_API_VERSION || "v26.0"}`;
const metaEnv = () => {
  const id = process.env.META_APP_ID, secret = process.env.META_APP_SECRET;
  if (!id || !secret) throw new Error("META_APP_ID / META_APP_SECRET not set");
  return { id, secret };
};

export function metaAuthUrl(redirectUri: string, state: string) {
  const { id } = metaEnv();
  const url = new URL(`https://www.facebook.com/${process.env.META_API_VERSION || "v26.0"}/dialog/oauth`);
  url.searchParams.set("client_id", id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  if (process.env.META_LOGIN_CONFIG_ID) url.searchParams.set("config_id", process.env.META_LOGIN_CONFIG_ID);
  else url.searchParams.set("scope", "ads_read,business_management");
  return url.toString();
}

/** Code → short-lived token → long-lived token (about 60 days; system-user configs don't expire). */
export async function exchangeMetaCode(code: string, redirectUri: string) {
  const { id, secret } = metaEnv();
  const get = async (params: Record<string, string>) => {
    const res = await fetch(`${graph()}/oauth/access_token?${new URLSearchParams({ client_id: id, client_secret: secret, ...params })}`);
    if (!res.ok) throw new Error(`Meta token exchange failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as { access_token: string; expires_in?: number };
  };
  const short = await get({ redirect_uri: redirectUri, code });
  const long = await get({ grant_type: "fb_exchange_token", fb_exchange_token: short.access_token });
  const me = await fetch(`${graph()}/me?fields=name&access_token=${encodeURIComponent(long.access_token)}`).then((r) => r.json()).catch(() => ({}));
  return {
    token: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000).toISOString() : null,
    name: (me as { name?: string }).name ?? null,
  };
}

export interface AdAccountOption { value: string; label: string }

/** Ad accounts the signed-in person (or system user) can read. value = "act_123". */
export async function listMetaAdAccounts(token: string): Promise<AdAccountOption[]> {
  const out: AdAccountOption[] = [];
  let url: string | null = `${graph()}/me/adaccounts?${new URLSearchParams({ fields: "account_id,name,business{name}", limit: "200", access_token: token })}`;
  while (url && out.length < 1000) {
    const res: Response = await fetch(url);
    if (!res.ok) throw new Error(`Meta ad accounts failed: ${res.status}`);
    const body = (await res.json()) as { data: { account_id: string; name: string; business?: { name: string } }[]; paging?: { next?: string } };
    for (const a of body.data) out.push({ value: `act_${a.account_id}`, label: `${a.name}${a.business ? ` · ${a.business.name}` : ""} (${a.account_id})` });
    url = body.paging?.next ?? null;
  }
  return out.sort((a, b) => a.label.localeCompare(b.label));
}
