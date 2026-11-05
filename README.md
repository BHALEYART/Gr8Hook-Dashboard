# Gr8 Hook Dashboard

Client-facing attribution dashboard: Meta + Google Ads performance paired with GoHighLevel leads, appointments and sales.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres, Auth, RLS, Vault) · Tailwind CSS 4 · Recharts · Vercel (hosting + nightly cron).

Runs in **demo mode** with sample data until Supabase is connected, so you can click through everything right away.

## Run it locally

```bash
npm install
npm run dev
# open http://localhost:3000  (demo mode — any email signs in)
```

## What's here

| Area | Path | Status |
| --- | --- | --- |
| Login (password or magic link), session refresh, route protection | `src/app/login`, `src/proxy.ts`, `src/app/auth/callback` | Working |
| Client dashboard: KPIs, month-over-month chart, top campaigns, attribution | `src/app/(app)/dashboard` | Working (demo + live queries) |
| Campaigns table (spend, leads, CPL, revenue, ROAS, product pairing) | `src/app/(app)/dashboard/campaigns` | Working |
| Leads & sales feed (source, campaign, appointment, sale) | `src/app/(app)/dashboard/leads` | Working |
| Admin: client list, add client, client settings, campaign pairing, chart notes, invites, deactivate | `src/app/(app)/admin` | Working against Supabase |
| Database schema + row-level security + encrypted token storage | `supabase/migrations/0001_init.sql` | Ready to run |
| Reach metrics + per-client lead label / Reach view | `supabase/migrations/0002_reach_and_labels.sql` | Ready to run |
| Google Ads, Meta, GoHighLevel API clients | `src/lib/integrations/*` | Written, needs API access + live testing |
| Nightly sync (last 7 days, or 400-day backfill) | `src/lib/sync.ts`, `src/app/api/cron/sync` | Written, needs API access |
| GHL webhook (real-time contact updates) | `src/app/api/webhooks/ghl` | Contacts done; opportunities/appointments TODO |

## How data stays separated

Every data table has a `client_id`. Postgres Row Level Security only returns rows for clients the signed-in user belongs to (`memberships`), while admins (`profiles.is_admin = true`) see everything. GoHighLevel tokens are encrypted in Supabase Vault and only readable by the background sync (service role).

## Go live

1. **Supabase:** create a project, then paste `supabase/setup_all.sql` into the SQL editor and run it (it's the migrations below combined). Or run `supabase/migrations/0001_init.sql`, `0002_reach_and_labels.sql`, `0003_shopify.sql`, `0004_ad_connections.sql` and `0005_audit_leads.sql` (in that order) in the SQL editor.
2. **Make yourself admin:** sign up once through the app (or add your user under Authentication), then run
   `update public.profiles set is_admin = true where lower(email) = 'you@example.com';`
3. **Auth settings:** in Supabase → Authentication → URL configuration, set the Site URL to your app URL and add `https://YOUR-APP/auth/callback` as a redirect URL. Turn off public sign-ups (invite-only).
4. **Vercel:** import this repo, add the variables from `.env.example`, and deploy. Point a subdomain like `app.gr8hook.com` at it and set `NEXT_PUBLIC_SITE_URL`.
5. **APIs:** fill in the Google Ads, Meta and GHL variables as each approval comes through. Check the API versions in `google-ads.ts`, `meta-ads.ts` and `gohighlevel.ts` against the current docs.
6. **First sync:** after adding a client, run a backfill:
   `curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR-APP/api/cron/sync?client=CLIENT_ID&backfill=1"`
   After that, Vercel Cron runs it nightly (`vercel.json`, 08:00 UTC).

## How attribution works

A lead counts as "from ads" when its GHL first-touch `utm_campaign` matches a synced campaign ID. Use these UTM templates so that match is exact:

- **Meta:** `utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}`
- **Google:** `utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={creative}` (keep auto-tagging on)

Revenue comes from **won** GHL opportunities on those contacts. Leads without a match show as "Unattributed."

## E-commerce clients (Shopify)

Set a client's primary goal to **E-commerce sales (Shopify)** and its Overview becomes a store view: sales by month for the whole store or one product, orders tied to ads, and the store's numbers next to what the Meta Pixel and Google tag report.

**Connect a store** (Shopify ended new legacy custom apps on Jan 1, 2026, so each store installs an app you make):

1. In the [Shopify Dev Dashboard](https://dev.shopify.com/dashboard), create an app for the client. Choose **custom distribution** and enter the client's store.
2. Set the app URL to `https://app.gr8hook.com` and add `https://app.gr8hook.com/api/shopify/callback` as an allowed redirect URL.
3. Scopes: `read_orders`, `read_all_orders`, `read_products`. `read_all_orders` (history past 60 days) and the customer-journey fields need Shopify's approval: request **protected customer data** access (Level 1 is enough; no names, emails or addresses are read) and `read_all_orders` in the app's settings.
4. In the dashboard: Admin → client → paste the store domain, the app's **Client ID** and **Client secret**, then save and press **Connect Shopify**. The store owner approves the install, and the offline token is stored in Supabase Vault.
5. Run a backfill (same curl as above). Nightly syncs then pull the last 7 days of orders.

If a store already has an Admin API token from an older custom app, paste it in "Existing Admin API token" instead of connecting.

**How orders are tied to ads** (`src/lib/attribution.ts`), using the visit Shopify records before checkout (last visit, then first visit):

1. `utm_campaign` matches a synced campaign ID → that campaign.
2. `utm_source` is facebook/instagram or google/youtube with a paid medium (or no medium) → that platform.
3. A Google click ID (`gclid`, `gbraid`, `wbraid`) on the landing page → Google.

`fbclid` alone isn't counted, because Facebook adds it to organic link clicks too. Everything else shows as unattributed. Some ad buyers always will (other devices, blocked tracking, coming back days later), so the store number is a floor and the platforms' own (view-through, modeled) numbers usually run higher. The dashboard shows both. Ad spend can't be split by product, so ROAS shows for the whole store only.

Optional env: `SHOPIFY_API_VERSION` (defaults to `2026-10`).

## Connect Facebook / Connect Google

Admins (client settings → **Ad account connections**) and client owners (account menu → **Connections**) can sign in to Facebook or Google, then pick the ad account the dashboard should read. Tokens are stored in Supabase Vault for that client. Clients without a connection keep using the shared tokens in the env vars.

**Google setup**
1. Google Cloud → APIs & Services → Credentials → your OAuth client. It must be a **Web application** client (create one if yours is Desktop, and update `GOOGLE_ADS_CLIENT_ID/SECRET`).
2. Add `https://app.gr8hook.com/api/connect/google/callback` under **Authorized redirect URIs**.
3. Until Google verifies the OAuth consent screen, people see an "unverified app" warning they can click through, and the number of users is capped. Submit for verification before offering it to other agencies.

**Meta setup**
1. In the Meta app: **Add product → Facebook Login for Business** (or Facebook Login).
2. Add `https://app.gr8hook.com/api/connect/meta/callback` to **Valid OAuth Redirect URIs**.
3. Add `META_APP_ID` and `META_APP_SECRET` (App settings → Basic) in Vercel. Optionally create a Login configuration with `ads_read` and `business_management` and set `META_LOGIN_CONFIG_ID`.
4. Until the app has **Advanced Access** to `ads_read` (Business Verification + App Review), only people with a role on the Meta app can connect. Add yourself and testers under App roles in the meantime.
5. Regular user tokens last about 60 days. The settings card shows when it renews and turns red two weeks before; reconnecting renews it.

## Free website audit endpoint

`POST /api/site-audit` powers the free audit at gr8hook.com/audit. It runs Google PageSpeed Insights (mobile and desktop) and checks the page's public HTML: title, description, H1, viewport, social preview, structured data, sitemap, click-to-call, booking links, lead forms, Google tag and Meta Pixel.

- Set `PAGESPEED_API_KEY` in Vercel (a Google Cloud API key restricted to the PageSpeed Insights API).
- Only gr8hook.com may call it (CORS), private/internal addresses are refused, and each instance allows 8 audits per IP per hour with a 15-minute cache.
- `POST /api/audit-lead` handles "Get my full report": it saves the lead to `audit_leads` (needs Supabase), emails the owner a branded report with recommendations (needs `RESEND_API_KEY`), scores the lead and emails you an alert for hot leads (every lead if the database isn't set up, or with `AUDIT_NOTIFY_ALL=true`).
- If neither the database nor email is set up, the audit page falls back to FormSubmit so no lead is lost.
- Leads appear in **Admin → Audit leads** with their findings, score, suggested service, status and notes.
- Email setup: in Resend, add the domain `gr8hook.com`, add the DNS records it shows at GoDaddy (they don't affect your Microsoft 365 mail), then set `RESEND_API_KEY` in Vercel.

## Demo site (demo.gr8hook.com)

A second Vercel project from this same repo, with **no Supabase variables**, runs in demo mode with sample clients. Demo data is generated through the end of the current month, so the latest month always looks complete (lists only show items dated up to today).

## Next steps

- [ ] gclid/fbclid fallback matching when `utm_campaign` is missing
- [ ] Map GHL opportunity custom fields/pipelines to a product or service
- [ ] Opportunity and appointment webhook handlers
- [ ] Sync health page in admin (reads `sync_runs`)
- [ ] Monthly PDF/email report
- [ ] Calendar ID picker for appointments (`clients.ghl_calendar_ids`)
