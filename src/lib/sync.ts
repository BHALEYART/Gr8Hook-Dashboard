// Nightly sync: pulls ads + CRM data for each active client and upserts it.
// Runs with the service role (bypasses RLS). Called from /api/cron/sync.
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchGoogleAdsDaily } from "@/lib/integrations/google-ads";
import { fetchMetaDaily } from "@/lib/integrations/meta-ads";
import { fetchAppointments, fetchContacts, fetchOpportunities } from "@/lib/integrations/gohighlevel";
import type { Client } from "@/lib/types";

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86_400_000));

/** Re-pull the last 7 days every night (late conversions); 400 days on a backfill. */
export async function syncClient(db: SupabaseClient, client: Client, opts: { backfill?: boolean } = {}) {
  const since = daysAgo(opts.backfill ? 400 : 7);
  const until = daysAgo(0);
  const { data: services } = await db.from("client_services").select("service, enabled").eq("client_id", client.id);
  const on = (s: string) => services?.some((x) => x.service === s && x.enabled);
  const results: Record<string, string> = {};

  async function run(source: "google" | "meta" | "ghl", job: () => Promise<number>) {
    const { data: runRow } = await db.from("sync_runs").insert({ client_id: client.id, source }).select("id").single();
    try {
      const rows = await job();
      await db.from("sync_runs").update({ status: "success", finished_at: new Date().toISOString(), rows_upserted: rows }).eq("id", runRow?.id);
      results[source] = `ok (${rows})`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.from("sync_runs").update({ status: "error", finished_at: new Date().toISOString(), error: msg.slice(0, 2000) }).eq("id", runRow?.id);
      results[source] = `error: ${msg.slice(0, 200)}`;
    }
  }

  if (on("google_ads") && client.google_ads_customer_id) {
    await run("google", async () => {
      const rows = await fetchGoogleAdsDaily(client.id, client.google_ads_customer_id!, since, until);
      if (rows.length) {
        const { error } = await db.from("ad_metrics_daily").upsert(rows.map((r) => ({ ...r, synced_at: new Date().toISOString() })));
        if (error) throw error;
      }
      return rows.length;
    });
  }

  if (on("meta_ads") && client.meta_ad_account_id) {
    await run("meta", async () => {
      const rows = await fetchMetaDaily(client.id, client.meta_ad_account_id!, since, until);
      if (rows.length) {
        const { error } = await db.from("ad_metrics_daily").upsert(rows.map((r) => ({ ...r, synced_at: new Date().toISOString() })));
        if (error) throw error;
      }
      return rows.length;
    });
  }

  if (on("ghl") && client.ghl_location_id) {
    await run("ghl", async () => {
      const { data: token } = await db.rpc("get_ghl_token", { cid: client.id });
      if (!token) throw new Error("No GoHighLevel token saved for this client");

      // Known campaign IDs, used to resolve utm_campaign → campaign.
      const { data: camps } = await db.from("ad_metrics_daily").select("campaign_id").eq("client_id", client.id);
      const known = new Set((camps ?? []).map((c) => c.campaign_id as string));

      const contacts = await fetchContacts(token as string, client.ghl_location_id!, since);
      const leads = contacts.map((c) => ({
        client_id: client.id,
        ...c,
        // Exact match when UTM templates put the campaign ID in utm_campaign.
        // TODO: fall back to gclid/fbclid matching once click-ID lookups are added.
        campaign_id: c.utm_campaign && known.has(c.utm_campaign) ? c.utm_campaign : null,
        synced_at: new Date().toISOString(),
      }));
      if (leads.length) {
        const { error } = await db.from("leads").upsert(leads, { onConflict: "client_id,ghl_contact_id" });
        if (error) throw error;
      }

      const opps = await fetchOpportunities(token as string, client.ghl_location_id!);
      if (opps.length) {
        const { error } = await db.from("opportunities").upsert(opps.map((o) => ({ client_id: client.id, ...o })), { onConflict: "client_id,ghl_opportunity_id" });
        if (error) throw error;
      }

      const calendars = client.ghl_calendar_ids ?? [];
      const appts = calendars.length ? await fetchAppointments(token as string, client.ghl_location_id!, calendars, since, new Date().toISOString()) : [];
      if (appts.length) {
        const { error } = await db.from("appointments").upsert(appts.map((a) => ({ client_id: client.id, ...a })), { onConflict: "client_id,ghl_appointment_id" });
        if (error) throw error;
      }
      return leads.length + opps.length + appts.length;
    });
  }

  return results;
}
