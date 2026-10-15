-- Gr8 Hook Dashboard — initial schema
-- Multi-tenant: every data row carries client_id. Row Level Security (RLS)
-- lets client users read only their own client's rows; admins see everything.
-- Background sync jobs use the service role key, which bypasses RLS.

create extension if not exists "pgcrypto";

-- ───────────────────────── People & access ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  primary_goal text not null default 'leads' check (primary_goal in ('leads', 'sales', 'appointments')),
  brand_color text,
  google_ads_customer_id text,      -- e.g. 123-456-7890 (under your MCC)
  meta_ad_account_id text,          -- e.g. act_1234567890
  ghl_location_id text,             -- GoHighLevel sub-account (location) ID
  ghl_calendar_ids text[] not null default '{}',  -- calendars to pull appointments from
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  role text not null default 'client_staff' check (role in ('client_owner', 'client_staff')),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

-- Create a profile automatically when someone signs up / accepts an invite.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helpers used by RLS policies (security definer avoids recursive policy checks).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.can_view_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin()
      or exists (select 1 from public.memberships m where m.user_id = auth.uid() and m.client_id = cid)
$$;

-- ───────────────────────── Client configuration ─────────────────────────

create table public.client_services (
  client_id uuid not null references public.clients (id) on delete cascade,
  service text not null check (service in ('meta_ads', 'google_ads', 'ghl', 'callrail')),
  enabled boolean not null default true,
  primary key (client_id, service)
);

create table public.client_settings (
  client_id uuid primary key references public.clients (id) on delete cascade,
  monthly_targets jsonb not null default '{}'::jsonb,  -- e.g. {"leads": 60, "cpl": 40}
  notes text
);

-- Encrypted credentials live in Supabase Vault; this table only stores the Vault secret ID.
-- No RLS policies are defined, so only the service role can read it.
create table public.client_secrets (
  client_id uuid primary key references public.clients (id) on delete cascade,
  ghl_token_secret_id uuid,
  updated_at timestamptz not null default now()
);

create table public.campaign_mappings (
  client_id uuid not null references public.clients (id) on delete cascade,
  campaign_id text not null,
  product_or_service text not null,
  primary key (client_id, campaign_id)
);

create table public.annotations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  date date not null,
  note text not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── Synced data ─────────────────────────

create table public.ad_metrics_daily (
  client_id uuid not null references public.clients (id) on delete cascade,
  platform text not null check (platform in ('google', 'meta')),
  campaign_id text not null,
  campaign_name text not null,
  date date not null,
  spend numeric(12, 2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  conversions numeric(12, 2) not null default 0,
  conversion_value numeric(12, 2) not null default 0,
  synced_at timestamptz not null default now(),
  primary key (client_id, platform, campaign_id, date)
);
create index on public.ad_metrics_daily (client_id, date);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ghl_contact_id text not null,
  name text,
  email text,
  phone text,
  created_at timestamptz not null,
  source text,              -- attribution source (facebook, google, direct, ...)
  utm_source text,
  utm_medium text,
  utm_campaign text,        -- holds the campaign ID when UTM templates are used
  utm_content text,
  gclid text,
  fbclid text,
  campaign_id text,         -- resolved match to ad_metrics_daily.campaign_id
  synced_at timestamptz not null default now(),
  unique (client_id, ghl_contact_id)
);
create index on public.leads (client_id, created_at);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ghl_opportunity_id text not null,
  ghl_contact_id text,
  pipeline text,
  stage text,
  status text check (status in ('open', 'won', 'lost', 'abandoned')),
  value numeric(12, 2) not null default 0,
  service text,
  updated_at timestamptz not null,
  unique (client_id, ghl_opportunity_id)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ghl_appointment_id text not null,
  ghl_contact_id text,
  starts_at timestamptz not null,
  status text check (status in ('booked', 'confirmed', 'showed', 'noshow', 'cancelled')),
  unique (client_id, ghl_appointment_id)
);

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  source text not null check (source in ('google', 'meta', 'ghl')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'success', 'error')),
  rows_upserted int,
  error text
);

-- ───────────────────────── Row Level Security ─────────────────────────

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.memberships enable row level security;
alter table public.client_services enable row level security;
alter table public.client_settings enable row level security;
alter table public.client_secrets enable row level security;
alter table public.campaign_mappings enable row level security;
alter table public.annotations enable row level security;
alter table public.ad_metrics_daily enable row level security;
alter table public.leads enable row level security;
alter table public.opportunities enable row level security;
alter table public.appointments enable row level security;
alter table public.sync_runs enable row level security;

-- Profiles: see your own; admins see all.
create policy "profiles read" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "profiles admin write" on public.profiles for update using (public.is_admin());

-- Clients & memberships
create policy "clients read" on public.clients for select using (public.can_view_client(id));
create policy "clients admin write" on public.clients for all using (public.is_admin()) with check (public.is_admin());
create policy "memberships read" on public.memberships for select using (user_id = auth.uid() or public.is_admin());
create policy "memberships admin write" on public.memberships for all using (public.is_admin()) with check (public.is_admin());

-- Per-client tables: members read, admins write. (Sync jobs use the service role.)
do $$
declare t text;
begin
  foreach t in array array['client_services', 'client_settings', 'campaign_mappings', 'annotations',
                           'ad_metrics_daily', 'leads', 'opportunities', 'appointments', 'sync_runs']
  loop
    execute format('create policy "%1$s read" on public.%1$I for select using (public.can_view_client(client_id))', t);
    execute format('create policy "%1$s admin write" on public.%1$I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;
-- client_secrets: intentionally no policies (service role only).

-- ───────────────────────── Vault helpers ─────────────────────────

-- Admin saves/replaces a client's GoHighLevel token (encrypted in Vault).
create or replace function public.set_ghl_token(cid uuid, token text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  select ghl_token_secret_id into sid from public.client_secrets where client_id = cid;
  if sid is null then
    sid := vault.create_secret(token, 'ghl_token_' || cid::text);
    insert into public.client_secrets (client_id, ghl_token_secret_id) values (cid, sid)
    on conflict (client_id) do update set ghl_token_secret_id = excluded.ghl_token_secret_id, updated_at = now();
  else
    perform vault.update_secret(sid, token);
    update public.client_secrets set updated_at = now() where client_id = cid;
  end if;
end $$;

-- Sync jobs (service role only) read the decrypted token.
create or replace function public.get_ghl_token(cid uuid)
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret
  from public.client_secrets cs
  join vault.decrypted_secrets ds on ds.id = cs.ghl_token_secret_id
  where cs.client_id = cid
$$;
revoke all on function public.get_ghl_token(uuid) from public, anon, authenticated;
grant execute on function public.get_ghl_token(uuid) to service_role;
