"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isDemo } from "@/lib/env";
import { requireAdmin } from "@/lib/data";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { normalizeShop } from "@/lib/integrations/shopify";
import type { ServiceKey } from "@/lib/types";

const SERVICES: ServiceKey[] = ["meta_ads", "google_ads", "ghl", "callrail", "shopify"];
const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : null;
};

function demoNotice(path: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}demo=1`);
}

export async function createClientAction(formData: FormData) {
  await requireAdmin();
  if (isDemo) demoNotice("/admin/clients/new");
  const name = str(formData, "name");
  if (!name) redirect("/admin/clients/new?error=name");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name,
      primary_goal: str(formData, "primary_goal") ?? "leads",
      lead_label: str(formData, "lead_label"),
      show_reach: formData.get("show_reach") === "on",
      google_ads_customer_id: str(formData, "google_ads_customer_id"),
      meta_ad_account_id: str(formData, "meta_ad_account_id"),
      ghl_location_id: str(formData, "ghl_location_id"),
      shopify_shop: normalizeShop(str(formData, "shopify_shop")),
      shopify_client_id: str(formData, "shopify_client_id"),
    })
    .select("id")
    .single();
  if (error || !data) redirect("/admin/clients/new?error=save");

  await supabase.from("client_services").insert(
    SERVICES.map((s) => ({ client_id: data.id, service: s, enabled: formData.get(`svc_${s}`) === "on" })),
  );
  const token = str(formData, "ghl_token");
  if (token) await supabase.rpc("set_ghl_token", { cid: data.id, token });
  await saveShopifySecrets(supabase, data.id, formData);
  const invite = str(formData, "invite_email");
  if (invite) await inviteUser(data.id, invite, "client_owner");

  // TODO: kick off a 13-month backfill for this client (call the sync route or a queue).
  revalidatePath("/admin");
  redirect(`/admin/clients/${data.id}?created=1`);
}

export async function updateClientAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id")!;
  if (isDemo) demoNotice(`/admin/clients/${id}`);
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({
      name: str(formData, "name"),
      primary_goal: str(formData, "primary_goal") ?? "leads",
      lead_label: str(formData, "lead_label"),
      show_reach: formData.get("show_reach") === "on",
      google_ads_customer_id: str(formData, "google_ads_customer_id"),
      meta_ad_account_id: str(formData, "meta_ad_account_id"),
      ghl_location_id: str(formData, "ghl_location_id"),
      shopify_shop: normalizeShop(str(formData, "shopify_shop")),
      shopify_client_id: str(formData, "shopify_client_id"),
    })
    .eq("id", id);
  await supabase.from("client_services").upsert(
    SERVICES.map((s) => ({ client_id: id, service: s, enabled: formData.get(`svc_${s}`) === "on" })),
  );
  const token = str(formData, "ghl_token");
  if (token) await supabase.rpc("set_ghl_token", { cid: id, token });
  await saveShopifySecrets(supabase, id, formData);
  revalidatePath(`/admin/clients/${id}`);
  redirect(`/admin/clients/${id}?saved=1`);
}

export async function saveMappingsAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id")!;
  if (isDemo) demoNotice(`/admin/clients/${id}`);
  const rows: { client_id: string; campaign_id: string; product_or_service: string }[] = [];
  const clear: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("map_")) continue;
    const campaign_id = key.slice(4);
    const v = String(value).trim();
    if (v) rows.push({ client_id: id, campaign_id, product_or_service: v });
    else clear.push(campaign_id);
  }
  const supabase = await createClient();
  if (rows.length) await supabase.from("campaign_mappings").upsert(rows);
  if (clear.length) await supabase.from("campaign_mappings").delete().eq("client_id", id).in("campaign_id", clear);
  redirect(`/admin/clients/${id}?saved=1#mappings`);
}

export async function addAnnotationAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id")!;
  if (isDemo) demoNotice(`/admin/clients/${id}`);
  const date = str(formData, "date");
  const note = str(formData, "note");
  if (date && note) {
    const supabase = await createClient();
    await supabase.from("annotations").insert({ client_id: id, date, note });
  }
  redirect(`/admin/clients/${id}?saved=1#notes`);
}

export async function inviteUserAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id")!;
  if (isDemo) demoNotice(`/admin/clients/${id}`);
  const email = str(formData, "email");
  if (email) await inviteUser(id, email, (str(formData, "role") as "client_owner" | "client_staff") ?? "client_staff");
  redirect(`/admin/clients/${id}?invited=1#users`);
}

export async function setStatusAction(formData: FormData) {
  await requireAdmin();
  const id = str(formData, "id")!;
  if (isDemo) demoNotice(`/admin/clients/${id}`);
  const status = str(formData, "status") === "inactive" ? "inactive" : "active";
  const supabase = await createClient();
  await supabase
    .from("clients")
    .update({ status, deactivated_at: status === "inactive" ? new Date().toISOString() : null })
    .eq("id", id);
  // Deactivated clients are skipped by the nightly sync and their users lose access via RLS
  // only if you also remove memberships; keeping them lets you reactivate cleanly.
  redirect(`/admin/clients/${id}?saved=1`);
}

/** Shopify app secret and (optional) pre-existing Admin API token go straight to Vault. */
async function saveShopifySecrets(supabase: Awaited<ReturnType<typeof createClient>>, cid: string, formData: FormData) {
  const secret = str(formData, "shopify_secret");
  if (secret) await supabase.rpc("set_shopify_secret", { cid, secret });
  const token = str(formData, "shopify_token");
  if (token) await supabase.rpc("set_shopify_token", { cid, token });
}

/** Sends a Supabase invite email and links the user to the client. Needs the service role key. */
async function inviteUser(clientId: string, email: string, role: "client_owner" | "client_staff") {
  const admin = createServiceClient();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/auth/callback?next=/dashboard` });
  let userId = data?.user?.id;
  if (error) {
    // Already registered: look them up instead.
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    userId = existing?.id;
  }
  if (userId) await admin.from("memberships").upsert({ user_id: userId, client_id: clientId, role });
}
