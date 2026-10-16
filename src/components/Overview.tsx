"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Sparkline, TrendChart, type ChartPoint } from "@/components/TrendChart";
import { Delta } from "@/components/ui";
import { money, num } from "@/lib/metrics";
import type { Annotation, CampaignRow, MonthRow, PrimaryGoal } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthIdx = (m: string) => Number(m.slice(5)) - 1;
const thisMonth = () => new Date().toISOString().slice(0, 7);
const mtd = (m: string) => (m === thisMonth() ? " (MTD)" : "");
const fullName = (m: string) => `${FULL[monthIdx(m)]} ${m.slice(0, 4)}${mtd(m)}`;
const shortName = (m: string) => `${MONTHS[monthIdx(m)]} ${m.slice(0, 4)}${mtd(m)}`;
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const ratio = (a: number, b: number) => (b ? a / b : null);
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 10_000 ? `${(v / 1000).toFixed(0)}k` : num(v));

type Agg = Omit<MonthRow, "month" | "label">;
const FIELDS: (keyof Agg)[] = ["spend", "clicks", "impressions", "reach", "engagements", "video_views", "landing_page_views",
  "leads", "appointments", "sales", "revenue", "google_leads", "meta_leads", "unattributed"];

export interface OverviewProps {
  client: { id: string; name: string; primary_goal: PrimaryGoal; show_reach?: boolean; lead_label?: string | null };
  monthsBack: number;
  rows: MonthRow[];
  current: string[];
  previous: string[];
  campaignsByMonth: Record<string, CampaignRow[]>;
  annotations: Annotation[];
  rangeTabs: ReactNode;
}

export function Overview({ client, monthsBack, rows, current, previous, campaignsByMonth, annotations, rangeTabs }: OverviewProps) {
  const byMonth = useMemo(() => new Map(rows.map((r) => [r.month, r])), [rows]);
  const all = useMemo(() => [...previous, ...current], [previous, current]);

  const [view, setView] = useState<"results" | "reach">("results");
  const [showPast, setShowPast] = useState(false);
  // focus: one month in view (scrubbed or first click). pending: waiting for a second click to compare.
  const [focus, setFocus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [compare, setCompare] = useState<[string, string] | null>(null);

  const reset = () => { setFocus(null); setPending(false); setCompare(null); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setFocus(null); setPending(false); setCompare(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Click a month: view it and wait for a second pick; the second pick compares; any pick after that resets. */
  const pick = (m: string) => {
    if (compare) return reset();
    if (pending && focus) {
      if (m === focus) return reset();
      const [a, b] = [focus, m].sort();
      setCompare([a, b]); setFocus(null); setPending(false);
      return;
    }
    setFocus(m); setPending(true);
  };
  const scrub = (i: number) => { setCompare(null); setPending(false); setFocus(i === 0 ? null : current[i - 1]); };

  // What's in view, and what it's measured against.
  const monthBefore = (m: string) => all[all.indexOf(m) - 1];
  let cur: string[], base: string[], vs: string, scope: string;
  if (compare) {
    cur = [compare[1]]; base = [compare[0]]; vs = shortName(compare[0]);
    scope = `${shortName(compare[1])} vs. ${shortName(compare[0])}`;
  } else if (focus) {
    const before = monthBefore(focus);
    cur = [focus]; base = before ? [before] : []; vs = before ? shortName(before) : "prior month";
    scope = fullName(focus);
  } else {
    cur = current; base = previous; vs = "prior period"; scope = `last ${monthsBack} months`;
  }

  const sum = (keys: string[]): Agg => {
    const out = Object.fromEntries(FIELDS.map((f) => [f, 0])) as Agg;
    for (const k of keys) { const r = byMonth.get(k); if (r) for (const f of FIELDS) out[f] += r[f]; }
    return out;
  };
  const now = sum(cur);
  const was = sum(base);

  const campaigns = (() => {
    const merged = new Map<string, CampaignRow>();
    for (const m of cur) {
      for (const c of campaignsByMonth[m] ?? []) {
        const row = merged.get(c.campaign_id);
        if (!row) { merged.set(c.campaign_id, { ...c }); continue; }
        for (const f of ["spend", "clicks", "impressions", "reach", "engagements", "landing_page_views", "leads", "revenue"] as const) row[f] += c[f];
      }
    }
    return [...merged.values()];
  })();

  const reach = view === "reach";
  const goal = client.primary_goal;
  const leadNoun = client.lead_label?.trim() || "Leads";
  const hasAppts = rows.some((r) => r.appointments > 0);

  // ── Hero ──
  const hero = reach
    ? { label: "People reached", value: compact(now.reach), nowV: now.reach, wasV: was.reach,
        chip: ratio(now.spend * 1000, now.impressions) !== null ? `${money(ratio(now.spend * 1000, now.impressions)!, 2)} CPM` : null,
        spark: current.map((m) => byMonth.get(m)?.reach ?? 0) }
    : goal === "leads"
      ? { label: `${leadNoun} from ads`, value: num(now.leads), nowV: now.leads, wasV: was.leads,
          chip: now.leads ? `${money(now.spend / now.leads, 2)} per ${leadNoun.toLowerCase().replace(/s$/, "")}` : null,
          spark: current.map((m) => byMonth.get(m)?.leads ?? 0) }
      : { label: "Revenue from ads", value: money(now.revenue), nowV: now.revenue, wasV: was.revenue,
          chip: now.spend ? `${(now.revenue / now.spend).toFixed(1)}× return on ad spend` : null,
          spark: current.map((m) => byMonth.get(m)?.revenue ?? 0) };

  // ── KPI tiles ──
  type T = { label: string; value: string; delta: ReactNode };
  const cost = (a: number, b: number) => (b ? money(a / b, 2) : "—");
  const costDelta = (n: number, nd: number, w: number, wd: number) => <Delta now={nd ? n / nd : 0} before={wd ? w / wd : 0} goodWhenUp={false} vs={vs} />;
  const d = (n: number, w: number, neutral = false) => <Delta now={n} before={w} neutral={neutral} vs={vs} />;
  const spendTile: T = { label: "Ad spend", value: money(now.spend), delta: d(now.spend, was.spend, true) };
  let tiles: T[];
  if (reach) {
    tiles = [
      spendTile,
      { label: "Impressions", value: compact(now.impressions), delta: d(now.impressions, was.impressions) },
      { label: "Engagements", value: compact(now.engagements), delta: d(now.engagements, was.engagements) },
      { label: "Landing page views", value: compact(now.landing_page_views), delta: d(now.landing_page_views, was.landing_page_views) },
    ];
  } else if (goal === "leads") {
    tiles = [
      spendTile,
      { label: `Cost per ${leadNoun.toLowerCase().replace(/s$/, "")}`, value: cost(now.spend, now.leads), delta: costDelta(now.spend, now.leads, was.spend, was.leads) },
      hasAppts
        ? { label: "Booked consults", value: num(now.appointments), delta: d(now.appointments, was.appointments) }
        : { label: "Sales", value: num(now.sales), delta: d(now.sales, was.sales) },
      { label: "Revenue from ads", value: money(now.revenue), delta: d(now.revenue, was.revenue) },
    ];
  } else if (goal === "sales") {
    tiles = [
      spendTile,
      { label: "Sales from ads", value: num(now.sales), delta: d(now.sales, was.sales) },
      { label: "Cost per sale", value: cost(now.spend, now.sales), delta: costDelta(now.spend, now.sales, was.spend, was.sales) },
      { label: `${leadNoun} from ads`, value: num(now.leads), delta: d(now.leads, was.leads) },
    ];
  } else {
    tiles = [
      spendTile,
      { label: "Appointments", value: num(now.appointments), delta: d(now.appointments, was.appointments) },
      { label: "Cost / appointment", value: cost(now.spend, now.appointments), delta: costDelta(now.spend, now.appointments, was.spend, was.appointments) },
      { label: `${leadNoun} from ads`, value: num(now.leads), delta: d(now.leads, was.leads) },
    ];
  }

  // ── Funnel ──
  const steps = reach
    ? [
        { label: "Impressions", value: compact(now.impressions), rate: now.reach ? `${(now.impressions / now.reach).toFixed(1)} per person` : null },
        { label: "People reached", value: compact(now.reach), rate: null as string | null },
        { label: "Engagements", value: compact(now.engagements), rate: `${pct(now.engagements, now.impressions)} of impressions` },
        { label: "Landing page views", value: compact(now.landing_page_views), rate: `${pct(now.landing_page_views, now.reach)} of people reached` },
        { label: "Sales", value: num(now.sales), rate: `${pct(now.sales, now.landing_page_views)} of page views` },
      ]
    : [
        { label: "Ad spend", value: money(now.spend), rate: null as string | null },
        { label: "Clicks", value: num(now.clicks), rate: null },
        { label: leadNoun, value: num(now.leads), rate: `${pct(now.leads, now.clicks)} of clicks` },
        ...(hasAppts ? [{ label: "Appointments", value: num(now.appointments), rate: `${pct(now.appointments, now.leads)} of ${leadNoun.toLowerCase()}` }] : []),
        { label: "Sales", value: num(now.sales), rate: `${pct(now.sales, now.leads)} of ${leadNoun.toLowerCase()}` },
      ];

  // ── Sources, leaderboard, notes ──
  const totalLeads = now.google_leads + now.meta_leads + now.unattributed;
  const sources = [
    { key: "Google Ads", n: now.google_leads, color: "#4C8DFF" },
    { key: "Meta Ads", n: now.meta_leads, color: "#FF5A36" },
    { key: "Unattributed", n: now.unattributed, color: "var(--ink-3)" },
  ];
  const rankBy = reach ? "reach" : goal === "leads" ? "leads" : "revenue";
  const ranked = [...campaigns].sort((a, b) => b[rankBy] - a[rankBy]).slice(0, 6);
  const top = Math.max(...ranked.map((c) => c[rankBy]), 1);
  const noteMonths = new Set([...cur, ...(compare ? base : [])]);
  const notes = annotations.filter((a) => noteMonths.has(a.date.slice(0, 7)));

  // ── Chart ──
  const chartMonths = showPast ? all : current;
  const picked = new Set(compare ?? (focus ? [focus] : []));
  const chartData: ChartPoint[] = chartMonths.map((m) => ({ ...byMonth.get(m)!, past: previous.includes(m), picked: picked.has(m) }));
  const spansYears = new Set(chartMonths.map((m) => m.slice(0, 4))).size > 1;
  const tickLabel = (m: string) => `${MONTHS[monthIdx(m)]}${spansYears ? ` ’${m.slice(2, 4)}` : ""}${m === thisMonth() ? "*" : ""}`;
  const sliderValue = focus && current.includes(focus) ? current.indexOf(focus) + 1 : 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{client.name}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-[34px]">Overview</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {client.show_reach && (
            <div className="inline-flex rounded-xl border border-line bg-panel p-1" role="group" aria-label="Metrics view">
              {(["results", "reach"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
                  className={`flex min-h-9 items-center rounded-[10px] px-4 text-sm font-semibold ${view === v ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}>
                  {v === "results" ? "Results" : "Reach"}
                </button>
              ))}
            </div>
          )}
          {rangeTabs}
        </div>
      </header>

      {/* Month scrubber + selection status */}
      <section className="card mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3" aria-label="Choose months">
        <div className="min-w-[180px]">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">{compare ? "Comparing" : "Showing"}</p>
          <p className="font-display text-base font-bold" aria-live="polite">{compare ? scope : focus ? fullName(focus) : `All ${monthsBack} months`}</p>
        </div>
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <button type="button" className="scrub-btn" aria-label="Previous month" onClick={() => scrub(Math.max(0, sliderValue - 1))} disabled={sliderValue === 0}>‹</button>
          <input type="range" min={0} max={current.length} step={1} value={sliderValue} onChange={(e) => scrub(Number(e.target.value))}
            className="scrub flex-1" aria-label="Scrub months"
            aria-valuetext={sliderValue === 0 ? `All ${monthsBack} months` : fullName(current[sliderValue - 1])} />
          <button type="button" className="scrub-btn" aria-label="Next month" onClick={() => scrub(Math.min(current.length, sliderValue + 1))} disabled={sliderValue === current.length}>›</button>
        </div>
        {(focus || compare) && (
          <button type="button" className="btn btn-ghost min-h-9 px-4" onClick={reset}>{compare ? "Exit compare" : "Show all months"}</button>
        )}
      </section>

      <div className="board">
        <section className="area-hero card hero-glow flex flex-col justify-between gap-4 p-6" aria-labelledby="hero-label">
          <div>
            <p id="hero-label" className="text-sm font-semibold text-ink-2">{hero.label} · {scope}</p>
            <p className="mt-2 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">{hero.value}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Delta now={hero.nowV} before={hero.wasV} vs={vs} />
              {hero.chip && <span className="rounded-full bg-coral/15 px-2.5 py-1 text-xs font-bold text-coral">{hero.chip}</span>}
            </div>
          </div>
          <Sparkline values={hero.spark} />
        </section>

        <section className="area-kpis kpi-grid grid grid-cols-2 gap-4" aria-label="Key numbers">
          {tiles.map((t) => (
            <div key={t.label} className="card flex flex-col justify-between gap-2">
              <span className="text-xs font-semibold text-ink-2">{t.label}</span>
              <span className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{t.value}</span>
              {t.delta}
            </div>
          ))}
        </section>

        <section className="area-funnel card p-0" aria-labelledby="funnel-title">
          <h2 id="funnel-title" className="sr-only">{reach ? "From attention to sales" : "From ad spend to sales"}</h2>
          <ol className="funnel-row grid grid-cols-2 sm:grid-cols-3" style={{ "--steps": steps.length } as React.CSSProperties}>
            {steps.map((s, i) => (
              <li key={s.label} className={`relative flex flex-col gap-1 p-5 ${i > 0 ? "md:border-l md:border-line" : ""}`}>
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                  <span className="mr-2 text-coral">0{i + 1}</span>{s.label}
                </span>
                <span className="font-display text-2xl font-extrabold tracking-tight">{s.value}</span>
                <span className="text-xs text-ink-3">{s.rate ?? " "}</span>
                {i < steps.length - 1 && (
                  <span className="absolute right-[-9px] top-1/2 z-10 hidden h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-line bg-panel text-ink-3 md:flex" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 6l6 6-6 6" /></svg>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="area-trend card relative flex flex-col p-6" aria-labelledby="trend-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="trend-title" className="font-display text-base font-bold">{reach ? "People reached by month" : "Spend vs. revenue"}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-2">
              {!reach && (
                <ul className="flex flex-wrap gap-4" aria-label="Legend">
                  <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--spend)" }} />Ad spend</li>
                  <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-coral" />Revenue from ads</li>
                  <li className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-ink" />{leadNoun}</li>
                </ul>
              )}
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" className="h-4 w-4 accent-[#FF5A36]" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
                Show previous period
              </label>
            </div>
          </div>

          {(pending || compare) && (
            <div role="status" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex -translate-x-1/2 items-center gap-3 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg shadow-lg">
              {compare ? `Comparing ${shortName(compare[0])} → ${shortName(compare[1])} · click any month to exit` : `${shortName(focus!)} selected · Click another data point to compare`}
              <button type="button" onClick={reset} aria-label="Clear selection" className="flex h-6 w-6 items-center justify-center rounded-full bg-bg/15 hover:bg-bg/25">×</button>
            </div>
          )}

          <div className="trend-chart flex-auto">
            <TrendChart data={chartData} mode={reach ? "reach" : "results"} leadLabel={leadNoun} onPick={pick} tickLabel={tickLabel} />
          </div>

          <p className="mt-3 text-xs text-ink-3">Click a month to view it, then another to compare. * Month to date.</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Pick a month to view, then another to compare">
            {chartMonths.map((m) => (
              <button key={m} type="button" onClick={() => pick(m)} aria-pressed={picked.has(m)}
                className={`min-h-8 rounded-lg px-2.5 text-xs font-semibold transition ${picked.has(m) ? "bg-coral text-white" : previous.includes(m) ? "text-ink-3 hover:bg-panel-2" : "text-ink-2 hover:bg-panel-2"}`}>
                {tickLabel(m)}
              </button>
            ))}
          </div>
        </section>

        <section className="area-lead card p-6" aria-labelledby="lead-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="lead-title" className="font-display text-base font-bold">Campaign leaderboard</h2>
            <Link className="text-sm font-semibold text-coral hover:underline" href={`/dashboard/campaigns?client=${client.id}&months=${monthsBack}`}>All campaigns</Link>
          </div>
          {ranked.length === 0 ? <p className="text-sm text-ink-3">No campaign activity in this view.</p> : (
            <ol className="flex flex-col gap-4">
              {ranked.map((c, i) => (
                <li key={c.campaign_id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <span className="font-display text-xs text-ink-3">{i + 1}</span>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.platform === "google" ? "#4C8DFF" : "#FF5A36" }} title={c.platform === "google" ? "Google" : "Meta"} />
                      <span className="truncate">{c.campaign_name}</span>
                    </span>
                    <span className="shrink-0 font-display text-sm font-bold tabular-nums">
                      {rankBy === "revenue" ? money(c.revenue) : rankBy === "reach" ? compact(c.reach) : num(c.leads)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-coral" style={{ width: `${(c[rankBy] / top) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-3">
                    {rankBy === "reach"
                      ? `${money(c.spend)} spent · ${c.impressions ? money((c.spend * 1000) / c.impressions, 2) : "—"} CPM · ${compact(c.landing_page_views)} page views`
                      : rankBy === "leads"
                        ? `${money(c.spend)} spent · ${c.leads ? money(c.spend / c.leads, 2) : "—"} per ${leadNoun.toLowerCase().replace(/s$/, "")} · ${money(c.revenue)} revenue`
                        : `${money(c.spend)} spent · ${num(c.leads)} ${leadNoun.toLowerCase()} · ${c.spend ? `${(c.revenue / c.spend).toFixed(1)}×` : "—"} ROAS`}
                    {c.service ? ` · ${c.service}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="area-attr card p-6" aria-labelledby="attr-title">
          <h2 id="attr-title" className="font-display text-base font-bold">Where {leadNoun.toLowerCase()} came from</h2>
          <div className="mt-4 flex items-center gap-5">
            <Ring parts={sources} total={totalLeads} />
            <ul className="flex flex-col gap-2 text-sm">
              {sources.map((s) => (
                <li key={s.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-ink-2">{s.key}</span>
                  <span className="font-semibold tabular-nums">{num(s.n)}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-4 text-xs text-ink-3">Matched when a lead arrives with campaign tracking (UTMs, gclid/fbclid) or a tracked call.</p>
        </section>

        <section className="area-notes card p-6" aria-labelledby="notes-title">
          <h2 id="notes-title" className="font-display text-base font-bold">What changed</h2>
          {notes.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">No notes for this period.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-4 border-l border-line pl-4">
              {notes.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-coral ring-4 ring-panel" aria-hidden="true" />
                  <p className="font-display text-xs font-semibold uppercase tracking-wider text-ink-3">
                    {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                  </p>
                  <p className="text-sm">{a.note}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}

function Ring({ parts, total }: { parts: { key: string; n: number; color: string }[]; total: number }) {
  const r = 34, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" role="img" aria-label={parts.map((p) => `${p.key}: ${p.n}`).join(", ")} className="shrink-0">
      <circle cx="48" cy="48" r={r} fill="none" strokeWidth="12" style={{ stroke: "var(--panel-2)" }} />
      {total > 0 && parts.map((p) => {
        const len = (p.n / total) * c;
        const el = (
          <circle key={p.key} cx="48" cy="48" r={r} fill="none" strokeWidth="12" strokeDasharray={`${Math.max(len - 2, 0)} ${c}`}
            strokeDashoffset={-offset} transform="rotate(-90 48 48)" style={{ stroke: p.color }} />
        );
        offset += len;
        return el;
      })}
      <text x="48" y="46" textAnchor="middle" className="font-display" style={{ fill: "var(--ink)", fontSize: 18, fontWeight: 800 }}>{total ? Math.round(((total - parts[parts.length - 1].n) / total) * 100) : 0}%</text>
      <text x="48" y="62" textAnchor="middle" style={{ fill: "var(--ink-3)", fontSize: 10 }}>from ads</text>
    </svg>
  );
}
