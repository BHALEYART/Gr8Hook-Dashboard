import type { Client, ClientService } from "@/lib/types";

const SERVICES = [
  { key: "meta_ads", label: "Meta Ads", hint: "Facebook & Instagram" },
  { key: "google_ads", label: "Google Ads", hint: "Search & Performance Max" },
  { key: "ghl", label: "GoHighLevel", hint: "Leads, opportunities, appointments" },
  { key: "callrail", label: "CallRail", hint: "Call tracking (via GHL)" },
  { key: "shopify", label: "Shopify", hint: "Store orders, products, UTMs" },
];

/** Shared form fields for creating and editing a client. */
export function ClientFields({ client, services }: { client?: Client; services?: ClientService[] }) {
  const enabled = (k: string) => (services ? services.some((s) => s.service === k && s.enabled) : k !== "callrail" && k !== "shopify");
  return (
    <div className="grid gap-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-base font-bold">Basics</legend>
        <div className="field">
          <label className="label" htmlFor="name">Client name</label>
          <input className="input" id="name" name="name" defaultValue={client?.name} required />
        </div>
        <div className="field">
          <label className="label" htmlFor="primary_goal">Primary goal</label>
          <select className="input" id="primary_goal" name="primary_goal" defaultValue={client?.primary_goal ?? "leads"}>
            <option value="leads">Leads</option>
            <option value="sales">Sales</option>
            <option value="appointments">Appointments / bookings</option>
            <option value="ecommerce">E-commerce sales (Shopify)</option>
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="lead_label">What they call a lead (optional)</label>
          <input className="input" id="lead_label" name="lead_label" placeholder="e.g. Consult requests, Email signups" defaultValue={client?.lead_label ?? ""} />
        </div>
        <label className="flex min-h-14 cursor-pointer items-center gap-3 self-end rounded-xl border border-line px-4 py-3 hover:border-ink-3">
          <input type="checkbox" name="show_reach" defaultChecked={client?.show_reach ?? false} className="h-5 w-5 accent-[#FF5A36]" />
          <span>
            <span className="block text-sm font-semibold">Show Reach view</span>
            <span className="block text-xs text-ink-3">Impressions, reach and engagement, for awareness-driven clients</span>
          </span>
        </label>
      </fieldset>

      <fieldset>
        <legend className="mb-3 font-display text-base font-bold">Services</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <label key={s.key} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-line px-4 py-3 hover:border-ink-3">
              <input type="checkbox" name={`svc_${s.key}`} defaultChecked={enabled(s.key)} className="h-5 w-5 accent-[#FF5A36]" />
              <span>
                <span className="block text-sm font-semibold">{s.label}</span>
                <span className="block text-xs text-ink-3">{s.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 font-display text-base font-bold">Connections</legend>
        <div className="field">
          <label className="label" htmlFor="google_ads_customer_id">Google Ads customer ID</label>
          <input className="input" id="google_ads_customer_id" name="google_ads_customer_id" placeholder="123-456-7890" defaultValue={client?.google_ads_customer_id ?? ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="meta_ad_account_id">Meta ad account ID</label>
          <input className="input" id="meta_ad_account_id" name="meta_ad_account_id" placeholder="act_1234567890" defaultValue={client?.meta_ad_account_id ?? ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ghl_location_id">GoHighLevel location ID</label>
          <input className="input" id="ghl_location_id" name="ghl_location_id" defaultValue={client?.ghl_location_id ?? ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ghl_token">GoHighLevel private integration token</label>
          <input className="input" id="ghl_token" name="ghl_token" type="password" autoComplete="off"
            placeholder={client ? "Leave blank to keep the current token" : "pit-…"} />
          <span className="text-xs text-ink-3">Stored encrypted in Supabase Vault. Never shown again.</span>
        </div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 font-display text-base font-bold">Shopify store</legend>
        <p className="text-sm text-ink-2 sm:col-span-2">
          From the client&apos;s Gr8 Hook app in the Shopify Dev Dashboard. Save, then use <strong>Connect Shopify</strong> to install it on the store.
        </p>
        <div className="field">
          <label className="label" htmlFor="shopify_shop">Store domain</label>
          <input className="input" id="shopify_shop" name="shopify_shop" placeholder="store-name.myshopify.com" defaultValue={client?.shopify_shop ?? ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="shopify_client_id">App client ID</label>
          <input className="input" id="shopify_client_id" name="shopify_client_id" autoComplete="off" defaultValue={client?.shopify_client_id ?? ""} />
        </div>
        <div className="field">
          <label className="label" htmlFor="shopify_secret">App client secret</label>
          <input className="input" id="shopify_secret" name="shopify_secret" type="password" autoComplete="off"
            placeholder={client ? "Leave blank to keep the current secret" : ""} />
          <span className="text-xs text-ink-3">Stored encrypted in Supabase Vault. Never shown again.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="shopify_token">Existing Admin API token (optional)</label>
          <input className="input" id="shopify_token" name="shopify_token" type="password" autoComplete="off" placeholder="shpat_… (only if the store already has one)" />
          <span className="text-xs text-ink-3">Skip this if you&apos;ll use Connect Shopify.</span>
        </div>
      </fieldset>
    </div>
  );
}
