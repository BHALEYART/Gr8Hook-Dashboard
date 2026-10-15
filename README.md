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
| Google Ads, Meta, GoHighLevel API clients | `src/lib/integrations/*` | Written, needs API access + live testing |
| Nightly sync (last 7 days, or 400-day backfill) | `src/lib/sync.ts`, `src/app/api/cron/sync` | Written, needs API access |
| GHL webhook (real-time contact updates) | `src/app/api/webhooks/ghl` | Contacts done; opportunities/appointments TODO |

## How data stays separated

Every data table has a `client_id`. Postgres Row Level Security only returns rows for clients the signed-in user belongs to (`memberships`), while admins (`profiles.is_admin = true`) see everything. GoHighLevel tokens are encrypted in Supabase Vault and only readable by the background sync (service role).

## Go live

1. **Supabase:** create a project, then run `supabase/migrations/0001_init.sql` in the SQL editor.
2. **Make yourself admin:** sign up once through the app (or add your user under Authentication), then run
   `update public.profiles set is_admin = true where email = 'you@example.com';`
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

## Next steps

- [ ] gclid/fbclid fallback matching when `utm_campaign` is missing
- [ ] Map GHL opportunity custom fields/pipelines to a product or service
- [ ] Opportunity and appointment webhook handlers
- [ ] Sync health page in admin (reads `sync_runs`)
- [ ] Monthly PDF/email report
- [ ] Calendar ID picker for appointments (`clients.ghl_calendar_ids`)
