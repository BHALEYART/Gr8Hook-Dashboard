-- E-commerce mode: Shopify orders, line items and per-client Shopify app credentials.

-- New goal and service keys
alter table public.clients drop constraint if exists clients_primary_goal_check;
alter table public.clients add constraint clients_primary_goal_check
  check (primary_goal in ('leads', 'sales', 'appointments', 'ecommerce'));
alter table public.client_services drop constraint if exists client_services_service_check;
alter table public.client_services add constraint client_services_service_check
  check (service in ('meta_ads', 'google_ads', 'ghl', 'callrail', 'shopify'));

alter table public.sync_runs drop constraint if exists sync_runs_source_check;
alter table public.sync_runs add constraint sync_runs_source_check
  check (source in ('google', 'meta', 'ghl', 'shopify'));

alter table public.clients
  add column if not exists shopify_shop text,        -- e.g. lakeshore-candle.myshopify.com
  add column if not exists shopify_client_id text;   -- the Shopify app's Client ID (not secret)

alter table public.client_secrets
  add column if not exists shopify_secret_secret_id uuid,  -- app Client secret (Vault)
  add column if not exists shopify_token_secret_id uuid;   -- Admin API access token (Vault)

create table public.shopify_orders (
  client_id uuid not null references public.clients (id) on delete cascade,
  order_id text not null,
  name text,
  created_at timestamptz not null,
  total numeric(12, 2) not null default 0,
  currency text,
  cancelled boolean not null default false,
  platform text check (platform in ('google', 'meta')),
  campaign_id text,
  match_method text check (match_method in ('utm', 'click_id')),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  landing_page text,
  referrer text,
  synced_at timestamptz not null default now(),
  primary key (client_id, order_id)
);
create index on public.shopify_orders (client_id, created_at);

create table public.shopify_order_lines (
  client_id uuid not null references public.clients (id) on delete cascade,
  order_id text not null,
  line_id text not null,
  product_id text,
  product_title text not null,
  variant_title text,
  quantity integer not null default 1,
  amount numeric(12, 2) not null default 0,
  primary key (client_id, line_id),
  foreign key (client_id, order_id) references public.shopify_orders (client_id, order_id) on delete cascade
);
create index on public.shopify_order_lines (client_id, order_id);
create index on public.shopify_order_lines (client_id, product_id);

alter table public.shopify_orders enable row level security;
alter table public.shopify_order_lines enable row level security;
do $$
declare t text;
begin
  foreach t in array array['shopify_orders', 'shopify_order_lines']
  loop
    execute format('create policy "%1$s read" on public.%1$I for select using (public.can_view_client(client_id))', t);
    execute format('create policy "%1$s admin write" on public.%1$I for all using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ───────────── Vault helpers for Shopify credentials ─────────────

-- Shared upsert of a client secret into Vault. kind: 'shopify_secret' | 'shopify_token'.
create or replace function public._put_shopify_secret(cid uuid, kind text, val text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  insert into public.client_secrets (client_id) values (cid) on conflict (client_id) do nothing;
  if kind = 'shopify_secret' then
    select shopify_secret_secret_id into sid from public.client_secrets where client_id = cid;
  else
    select shopify_token_secret_id into sid from public.client_secrets where client_id = cid;
  end if;
  if sid is null then
    sid := vault.create_secret(val, kind || '_' || cid::text);
    if kind = 'shopify_secret' then
      update public.client_secrets set shopify_secret_secret_id = sid, updated_at = now() where client_id = cid;
    else
      update public.client_secrets set shopify_token_secret_id = sid, updated_at = now() where client_id = cid;
    end if;
  else
    perform vault.update_secret(sid, val);
    update public.client_secrets set updated_at = now() where client_id = cid;
  end if;
end $$;
revoke all on function public._put_shopify_secret(uuid, text, text) from public, anon, authenticated;

-- Admin saves the app's Client secret, or pastes an existing Admin API token.
create or replace function public.set_shopify_secret(cid uuid, secret text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  perform public._put_shopify_secret(cid, 'shopify_secret', secret);
end $$;

create or replace function public.set_shopify_token(cid uuid, token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  perform public._put_shopify_secret(cid, 'shopify_token', token);
end $$;

-- The OAuth callback (service role) stores the token it receives from Shopify.
create or replace function public.store_shopify_token(cid uuid, token text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._put_shopify_secret(cid, 'shopify_token', token);
end $$;
revoke all on function public.store_shopify_token(uuid, text) from public, anon, authenticated;
grant execute on function public.store_shopify_token(uuid, text) to service_role;

-- Service role reads decrypted values (sync job and OAuth callback only).
create or replace function public.get_shopify_secret(cid uuid)
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret from public.client_secrets cs
  join vault.decrypted_secrets ds on ds.id = cs.shopify_secret_secret_id where cs.client_id = cid
$$;
create or replace function public.get_shopify_token(cid uuid)
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret from public.client_secrets cs
  join vault.decrypted_secrets ds on ds.id = cs.shopify_token_secret_id where cs.client_id = cid
$$;
revoke all on function public.get_shopify_secret(uuid) from public, anon, authenticated;
revoke all on function public.get_shopify_token(uuid) from public, anon, authenticated;
grant execute on function public.get_shopify_secret(uuid) to service_role;
grant execute on function public.get_shopify_token(uuid) to service_role;

-- Whether a client's store is connected (safe for admins to see; never returns the token).
create or replace function public.shopify_connected(cid uuid)
returns boolean language sql security definer set search_path = public as $$
  select public.is_admin() and exists (
    select 1 from public.client_secrets where client_id = cid and shopify_token_secret_id is not null)
$$;
