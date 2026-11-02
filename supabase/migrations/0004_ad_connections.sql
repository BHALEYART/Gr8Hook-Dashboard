-- "Connect Facebook" / "Connect Google": per-client OAuth tokens for the ad platforms.
-- Tokens live in Supabase Vault. Clients without one fall back to the shared tokens in Vercel env vars.

alter table public.client_secrets
  add column if not exists meta_token_secret_id uuid,
  add column if not exists google_refresh_secret_id uuid;

alter table public.clients
  add column if not exists google_login_customer_id text,   -- manager account the Ads account is reached through (if any)
  add column if not exists meta_connected_as text,          -- who signed in, shown in settings
  add column if not exists google_connected_as text,
  add column if not exists meta_token_expires_at timestamptz;

-- Owners can manage their own client's connections (admins can manage any).
create or replace function public.can_manage_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.memberships m where m.user_id = auth.uid() and m.client_id = cid and m.role = 'client_owner')
$$;

-- kind: 'meta' | 'google'. Service role only (called by the OAuth callbacks and the sync job).
create or replace function public.store_ad_token(cid uuid, kind text, val text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  if kind not in ('meta', 'google') then raise exception 'bad kind'; end if;
  insert into public.client_secrets (client_id) values (cid) on conflict (client_id) do nothing;
  select case when kind = 'meta' then meta_token_secret_id else google_refresh_secret_id end
    into sid from public.client_secrets where client_id = cid;
  if sid is null then
    sid := vault.create_secret(val, kind || '_token_' || cid::text);
    if kind = 'meta' then
      update public.client_secrets set meta_token_secret_id = sid, updated_at = now() where client_id = cid;
    else
      update public.client_secrets set google_refresh_secret_id = sid, updated_at = now() where client_id = cid;
    end if;
  else
    perform vault.update_secret(sid, val);
    update public.client_secrets set updated_at = now() where client_id = cid;
  end if;
end $$;

create or replace function public.get_ad_token(cid uuid, kind text)
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret from public.client_secrets cs
  join vault.decrypted_secrets ds
    on ds.id = case when kind = 'meta' then cs.meta_token_secret_id else cs.google_refresh_secret_id end
  where cs.client_id = cid
$$;

create or replace function public.clear_ad_token(cid uuid, kind text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare sid uuid;
begin
  select case when kind = 'meta' then meta_token_secret_id else google_refresh_secret_id end
    into sid from public.client_secrets where client_id = cid;
  if kind = 'meta' then
    update public.client_secrets set meta_token_secret_id = null, updated_at = now() where client_id = cid;
    update public.clients set meta_connected_as = null, meta_token_expires_at = null where id = cid;
  else
    update public.client_secrets set google_refresh_secret_id = null, updated_at = now() where client_id = cid;
    update public.clients set google_connected_as = null where id = cid;
  end if;
  if sid is not null then delete from vault.secrets where id = sid; end if;
end $$;

revoke all on function public.store_ad_token(uuid, text, text) from public, anon, authenticated;
revoke all on function public.get_ad_token(uuid, text) from public, anon, authenticated;
revoke all on function public.clear_ad_token(uuid, text) from public, anon, authenticated;
grant execute on function public.store_ad_token(uuid, text, text) to service_role;
grant execute on function public.get_ad_token(uuid, text) to service_role;
grant execute on function public.clear_ad_token(uuid, text) to service_role;
