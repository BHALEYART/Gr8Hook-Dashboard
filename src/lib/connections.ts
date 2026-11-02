// "Connect Facebook" / "Connect Google": status, and the ad accounts each connection can see.
import { isDemo } from "@/lib/env";
import { listGoogleAdsAccounts } from "@/lib/integrations/google-ads";
import { listMetaAdAccounts } from "@/lib/integrations/meta-ads";
import { createServiceClient } from "@/lib/supabase/server";
import type { Client } from "@/lib/types";

export type AdPlatform = "meta" | "google";
export const isAdPlatform = (p: string): p is AdPlatform => p === "meta" || p === "google";

export interface Connection {
  platform: AdPlatform;
  configured: boolean; // the app has the env vars it needs to offer this button
  connected: boolean;
  connectedAs: string | null;
  expiresAt: string | null;
  expiresSoon: boolean; // within 14 days
  selected: string; // current choice in the account picker's value format
  accounts: { value: string; label: string }[];
  error: string | null;
}

/** Where to send the person after connecting: client settings (admins) or the Connections page. */
export const backPath = (from: string, clientId: string) =>
  from === "admin" ? `/admin/clients/${encodeURIComponent(clientId)}` : `/dashboard/connections?client=${encodeURIComponent(clientId)}`;

export const configured = (p: AdPlatform) =>
  p === "meta" ? Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
    : Boolean(process.env.GOOGLE_ADS_CLIENT_ID && process.env.GOOGLE_ADS_CLIENT_SECRET && process.env.GOOGLE_ADS_API_VERSION);

export async function getConnections(client: Client): Promise<Connection[]> {
  const metaSel = client.meta_ad_account_id ?? "";
  const googleSel = client.google_ads_customer_id ? `${client.google_login_customer_id ?? ""}:${client.google_ads_customer_id.replace(/-/g, "")}` : "";
  if (isDemo) {
    return [
      { platform: "meta", configured: true, connected: true, connectedAs: "Demo User", expiresAt: null, expiresSoon: false, selected: metaSel, error: null,
        accounts: metaSel ? [{ value: metaSel, label: `${client.name} (${metaSel.replace("act_", "")})` }] : [] },
      { platform: "google", configured: true, connected: Boolean(client.google_ads_customer_id), connectedAs: "demo@gr8hook.com", expiresAt: null, expiresSoon: false, selected: googleSel, error: null,
        accounts: googleSel ? [{ value: googleSel, label: `${client.name} (${client.google_ads_customer_id})` }] : [] },
    ];
  }
  const db = createServiceClient();
  return Promise.all((["meta", "google"] as const).map(async (platform): Promise<Connection> => {
    const { data: token } = await db.rpc("get_ad_token", { cid: client.id, kind: platform });
    const base = {
      platform, configured: configured(platform), connected: Boolean(token),
      connectedAs: (platform === "meta" ? client.meta_connected_as : client.google_connected_as) ?? null,
      expiresAt: platform === "meta" ? client.meta_token_expires_at ?? null : null,
      expiresSoon: platform === "meta" && Boolean(client.meta_token_expires_at) && new Date(client.meta_token_expires_at!).getTime() - Date.now() < 14 * 864e5,
      selected: platform === "meta" ? metaSel : googleSel, accounts: [] as Connection["accounts"], error: null as string | null,
    };
    if (!token) return base;
    try {
      base.accounts = platform === "meta" ? await listMetaAdAccounts(token as string) : await listGoogleAdsAccounts(token as string);
    } catch {
      base.error = "Couldn't load ad accounts. The sign-in may have expired or lost access; reconnect to fix it.";
    }
    return base;
  }));
}
