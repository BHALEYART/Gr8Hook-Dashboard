-- Leads from the free website audit on gr8hook.com/audit.
-- Rows are written by the /api/audit-lead endpoint (service role). Only admins can read or change them.

create table if not exists public.audit_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
  -- Contact
  name text not null,
  business text not null,
  email text not null,
  phone text,
  concern text not null,
  concern_detail text,
  -- Website and what the audit found
  website text not null,
  audited_at timestamptz not null,
  scores jsonb not null default '{}'::jsonb,        -- { mobile: {...}, desktop: {...} }
  issues jsonb not null default '[]'::jsonb,        -- failing / warning checks and Lighthouse findings
  recommendations jsonb not null default '[]'::jsonb,
  audit jsonb not null,                             -- the full audit result
  -- Sales
  lead_score int not null default 0,
  lead_tier text not null default 'cool' check (lead_tier in ('hot', 'warm', 'cool')),
  suggested_services text[] not null default '{}',
  score_reasons text[] not null default '{}',
  notes text,
  -- Source and consent
  source text not null default 'website-audit',
  referrer text,
  utm jsonb not null default '{}'::jsonb,
  consent_report boolean not null default true,     -- asked for the report by email
  consent_marketing boolean not null default false, -- opted in to occasional marketing emails
  consent_text text,
  report_emailed_at timestamptz,
  alerted_at timestamptz
);

create index if not exists audit_leads_created_idx on public.audit_leads (created_at desc);
create index if not exists audit_leads_email_idx on public.audit_leads (lower(email));

alter table public.audit_leads enable row level security;
create policy "audit_leads admin read" on public.audit_leads for select using (public.is_admin());
create policy "audit_leads admin write" on public.audit_leads for all using (public.is_admin()) with check (public.is_admin());
