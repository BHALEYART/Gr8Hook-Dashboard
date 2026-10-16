-- Attention metrics for the Reach view, and per-client display options.

alter table public.ad_metrics_daily
  add column if not exists reach bigint not null default 0,
  add column if not exists engagements bigint not null default 0,
  add column if not exists video_views bigint not null default 0,
  add column if not exists landing_page_views bigint not null default 0;

alter table public.clients
  add column if not exists show_reach boolean not null default false,
  add column if not exists lead_label text;
