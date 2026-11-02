"use server";

import { redirect } from "next/navigation";
import { backPath, getConnections, isAdPlatform } from "@/lib/connections";
import { canManageClient, getClient, getViewer } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { createServiceClient } from "@/lib/supabase/server";

const field = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (f: FormData, result: string) => {
  const path = backPath(field(f, "from"), field(f, "client"));
  return `${path}${path.includes("?") ? "&" : "?"}${result}`;
};

async function guard(formData: FormData) {
  const clientId = field(formData, "client");
  const platform = field(formData, "platform");
  if (!isAdPlatform(platform) || !(await canManageClient(await getViewer(), clientId))) redirect(back(formData, "connect=denied"));
  if (isDemo) redirect(back(formData, "demo=1"));
  return { clientId, platform };
}

/** Saves which ad account this client's dashboard reads, from the accounts the connection can see. */
export async function chooseAdAccountAction(formData: FormData) {
  const { clientId, platform } = await guard(formData);
  const value = field(formData, "account");
  const client = await getClient(clientId);
  if (!client) redirect("/dashboard");
  const conn = (await getConnections(client)).find((c) => c.platform === platform);
  if (!conn?.accounts.some((a) => a.value === value)) redirect(back(formData, `connect=${platform}-pick`));

  const db = createServiceClient();
  if (platform === "meta") {
    await db.from("clients").update({ meta_ad_account_id: value }).eq("id", clientId);
  } else {
    const [login, id] = value.split(":");
    await db.from("clients").update({ google_ads_customer_id: id, google_login_customer_id: login || null }).eq("id", clientId);
  }
  await db.from("client_services").upsert({ client_id: clientId, service: platform === "meta" ? "meta_ads" : "google_ads", enabled: true });
  redirect(back(formData, `connect=${platform}-saved`));
}

/** Removes the client's own token. Syncs fall back to the agency's shared access, if it has any. */
export async function disconnectAdAction(formData: FormData) {
  const { clientId, platform } = await guard(formData);
  await createServiceClient().rpc("clear_ad_token", { cid: clientId, kind: platform });
  redirect(back(formData, `connect=${platform}-removed`));
}
