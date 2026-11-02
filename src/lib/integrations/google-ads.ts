// Google Ads API — daily campaign metrics for one customer account under your MCC.
// Access is tied to the Google Cloud project behind your OAuth client (Explorer / Basic / Standard),
// set up on the Google Ads API Overview page in Cloud Console. Developer tokens are now optional.
// Before going live, confirm the current API version at https://developers.google.com/google-ads/api/docs/release-notes
import type { AdMetricDaily } from "@/lib/types";

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

async function accessToken(refreshToken?: string | null): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_ADS_CLIENT_ID"),
      client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
      refresh_token: refreshToken || env("GOOGLE_ADS_REFRESH_TOKEN"),
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google OAuth failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token as string;
}

const devToken = (): Record<string, string> =>
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN ? { "developer-token": process.env.GOOGLE_ADS_DEVELOPER_TOKEN } : {};
/** The manager (MCC) account the request goes through; omitted when the account is reached directly. */
const loginHeader = (id?: string | null): Record<string, string> => (id ? { "login-customer-id": id.replace(/-/g, "") } : {});

interface Row {
  campaign: { id: string; name: string };
  segments: { date: string };
  metrics: { costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number };
}

/**
 * `auth` is the client's own "Connect Google" refresh token and the manager account it reaches the
 * Ads account through. Without them, the shared refresh token and MCC from env vars are used.
 */
export async function fetchGoogleAdsDaily(clientId: string, customerId: string, since: string, until: string,
  auth: { refreshToken?: string | null; loginCustomerId?: string | null } = {}): Promise<AdMetricDaily[]> {
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
      Authorization: `Bearer ${await accessToken(auth.refreshToken)}`,
      ...devToken(),
      ...loginHeader(auth.refreshToken ? auth.loginCustomerId : auth.loginCustomerId ?? process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID),
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

// ───────────── "Connect Google" (OAuth web flow) ─────────────
// Uses the same OAuth client as GOOGLE_ADS_CLIENT_ID/SECRET. It must be a "Web application" client
// with {SITE}/api/connect/google/callback in its Authorized redirect URIs.
export function googleAuthUrl(redirectUri: string, state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", env("GOOGLE_ADS_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/adwords openid email");
  url.searchParams.set("access_type", "offline"); // returns a refresh token for nightly syncs
  url.searchParams.set("prompt", "consent"); // always re-issue the refresh token on reconnect
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, redirect_uri: redirectUri, grant_type: "authorization_code",
      client_id: env("GOOGLE_ADS_CLIENT_ID"), client_secret: env("GOOGLE_ADS_CLIENT_SECRET"),
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { refresh_token?: string; id_token?: string };
  if (!body.refresh_token) throw new Error("Google returned no refresh token");
  let email: string | null = null;
  try { email = JSON.parse(Buffer.from(body.id_token!.split(".")[1], "base64url").toString()).email ?? null; } catch { /* email is cosmetic */ }
  return { refreshToken: body.refresh_token, email };
}

export interface GoogleAccountOption { value: string; label: string }

/**
 * Every Ads account the signed-in Google user can reach: accounts they're added to directly, and
 * the client accounts under any manager (MCC) account they're added to.
 * value = "loginCustomerId:customerId" (loginCustomerId empty when reached directly).
 */
export async function listGoogleAdsAccounts(refreshToken: string): Promise<GoogleAccountOption[]> {
  const version = env("GOOGLE_ADS_API_VERSION");
  const token = await accessToken(refreshToken);
  const headers = (login?: string) => ({ Authorization: `Bearer ${token}`, ...devToken(), ...loginHeader(login), "Content-Type": "application/json" });
  const res = await fetch(`https://googleads.googleapis.com/${version}/customers:listAccessibleCustomers`, { headers: headers() });
  if (!res.ok) throw new Error(`Google accounts failed: ${res.status}`);
  const roots = ((await res.json()) as { resourceNames?: string[] }).resourceNames?.map((r) => r.split("/")[1]) ?? [];

  const out = new Map<string, GoogleAccountOption>();
  const fmt = (id: string) => id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
  for (const root of roots.slice(0, 25)) {
    const q = await fetch(`https://googleads.googleapis.com/${version}/customers/${root}/googleAds:searchStream`, {
      method: "POST", headers: headers(root),
      body: JSON.stringify({ query: "SELECT customer_client.id, customer_client.descriptive_name, customer_client.manager, customer_client.level, customer_client.status FROM customer_client WHERE customer_client.level <= 1" }),
    });
    if (!q.ok) continue; // e.g. a cancelled account
    const batches = (await q.json()) as { results?: { customerClient: { id: string; descriptiveName?: string; manager?: boolean; level?: string; status?: string } }[] }[];
    for (const r of batches.flatMap((b) => b.results ?? [])) {
      const c = r.customerClient;
      if (c.manager || (c.status && c.status !== "ENABLED")) continue;
      const id = String(c.id);
      const login = id === root ? "" : root;
      if (out.has(id) && login) continue; // prefer direct access over going through a manager
      out.set(id, { value: `${login}:${id}`, label: `${c.descriptiveName || "Unnamed account"} (${fmt(id)})${login ? ` · via ${fmt(login)}` : ""}` });
    }
  }
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label));
}
