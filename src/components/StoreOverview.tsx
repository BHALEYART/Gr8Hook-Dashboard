"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Ring } from "@/components/Overview";
import { Sparkline } from "@/components/TrendChart";
import { Delta } from "@/components/ui";
import { money, num } from "@/lib/metrics";
import { usePrefs } from "@/lib/prefs";
import { ALL, blankStoreMonth, type StoreData } from "@/lib/store";
import type { Annotation, StoreMonth } from "@/lib/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthIdx = (m: string) => Number(m.slice(5)) - 1;
const thisMonth = () => new Date().toISOString().slice(0, 7);
const mtd = (m: string) => (m === thisMonth() ? " (MTD)" : "");
const fullName = (m: string) => `${FULL[monthIdx(m)]} ${m.slice(0, 4)}${mtd(m)}`;
const shortName = (m: string) => `${MONTHS[monthIdx(m)]} ${m.slice(0, 4)}${mtd(m)}`;
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(0)}%` : "—");
const META = "#FF5A36", GOOGLE = "#4C8DFF";

type Ads = StoreData["ads"][string];
const blankAds = (): Ads => ({ spend: 0, meta_spend: 0, google_spend: 0, meta_reported: 0, meta_reported_orders: 0, google_reported: 0, google_reported_orders: 0 });

export interface StoreOverviewProps extends StoreData {
  client: { id: string; name: string };
  monthsBack: number;
  annotations: Annotation[];
  rangeTabs: ReactNode;
}

export function StoreOverview({ client, monthsBack, current, previous, months, products, store, ads, campaigns, recent, annotations, rangeTabs }: StoreOverviewProps) {
  const [product, setProduct] = useState<string>(ALL);
  const [showPast, setShowPast] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [compare, setCompare] = useState<[string, string] | null>(null);

  const reset = () => { setFocus(null); setPending(false); setCompare(null); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setFocus(null); setPending(false); setCompare(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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

  const monthBefore = (m: string) => months[months.indexOf(m) - 1];
  let cur: string[], base: string[], vs: string, scope: string;
  if (compare) {
    cur = [compare[1]]; base = [compare[0]]; vs = shortName(compare[0]); scope = `${shortName(compare[1])} vs. ${shortName(compare[0])}`;
  } else if (focus) {
    const before = monthBefore(focus);
    cur = [focus]; base = before ? [before] : []; vs = before ? shortName(before) : "prior month"; scope = fullName(focus);
  } else {
    cur = current; base = previous; vs = "prior period"; scope = `last ${monthsBack} months`;
  }

  const isAll = product === ALL;
  const productTitle = isAll ? "All products" : products.find((p) => p.id === product)?.title ?? "Product";
  const sumStore = (keys: string[], key = product): StoreMonth => {
    const out = blankStoreMonth();
    for (const m of keys) { const r = store[m]?.[key]; if (r) for (const f of Object.keys(out) as (keyof StoreMonth)[]) out[f] += r[f]; }
    return out;
  };
  const sumAds = (keys: string[]): Ads => {
    const out = blankAds();
    for (const m of keys) { const r = ads[m]; if (r) for (const f of Object.keys(out) as (keyof Ads)[]) out[f] += r[f]; }
    return out;
  };
  const now = sumStore(cur), was = sumStore(base);
  const adNow = sumAds(cur), adWas = sumAds(base);
  const storeAll = sumStore(cur, ALL);
  const other = (s: StoreMonth) => s.revenue - s.ad_revenue;
  const roas = (rev: number, spend: number) => (spend ? `${(rev / spend).toFixed(1)}×` : "—");
  const d = (n: number, w: number, opts: { neutral?: boolean; goodWhenUp?: boolean } = {}) => <Delta now={n} before={w} vs={vs} {...opts} />;

  // ── Hero: store-verified revenue from ads ──
  const heroChip = isAll
    ? adNow.spend ? `${roas(now.ad_revenue, adNow.spend)} return on ad spend` : null
    : now.revenue ? `${pct(now.ad_revenue, now.revenue)} of this item's sales` : null;

  // ── Tiles ──
  const tiles = isAll
    ? [
        { label: "Ad spend", value: money(adNow.spend), delta: d(adNow.spend, adWas.spend, { neutral: true }) },
        { label: "Orders from ads", value: num(now.ad_orders), delta: d(now.ad_orders, was.ad_orders) },
        { label: "Cost per ad order", value: now.ad_orders ? money(adNow.spend / now.ad_orders, 2) : "—",
          delta: d(now.ad_orders ? adNow.spend / now.ad_orders : 0, was.ad_orders ? adWas.spend / was.ad_orders : 0, { goodWhenUp: false }) },
        { label: "Total store sales", value: money(now.revenue), delta: d(now.revenue, was.revenue) },
      ]
    : [
        { label: "Units sold", value: num(now.units), delta: d(now.units, was.units) },
        { label: "Orders with this item", value: num(now.orders), delta: d(now.orders, was.orders) },
        { label: "Orders from ads", value: num(now.ad_orders), delta: d(now.ad_orders, was.ad_orders) },
        { label: "Total item sales", value: money(now.revenue), delta: d(now.revenue, was.revenue) },
      ];

  // ── Store-verified vs. what the ad platforms report (store-wide only: the pixel counts any purchase) ──
  const verify = [
    { label: "Meta: store-verified", value: money(storeAll.meta_revenue), sub: `${num(storeAll.meta_orders)} orders with Meta UTMs`, color: META },
    { label: "Meta Pixel reported", value: money(adNow.meta_reported), sub: `${num(Math.round(adNow.meta_reported_orders))} purchases`, color: META, faded: true },
    { label: "Google: store-verified", value: money(storeAll.google_revenue), sub: `${num(storeAll.google_orders)} orders with Google UTMs or click IDs`, color: GOOGLE },
    { label: "Google tag reported", value: money(adNow.google_reported), sub: `${num(Math.round(adNow.google_reported_orders))} conversions`, color: GOOGLE, faded: true },
  ];

  // ── Sources ring (orders) ──
  const sources = [
    { key: "Google Ads", n: now.google_orders, color: GOOGLE },
    { key: "Meta Ads", n: now.meta_orders, color: META },
    { key: "Other / unattributed", n: now.orders - now.ad_orders, color: "var(--ink-3)" },
  ];

  // ── Campaigns: store-verified revenue per campaign for the chosen product ──
  const ranked = (() => {
    const merged = new Map<string, { id: string; name: string; platform: string; spend: number; orders: number; revenue: number }>();
    for (const m of cur) for (const c of campaigns[m] ?? []) {
      const row = merged.get(c.campaign_id) ?? { id: c.campaign_id, name: c.campaign_name, platform: c.platform, spend: 0, orders: 0, revenue: 0 };
      const p = c.byProduct[product];
      row.spend += c.spend; row.orders += p?.orders ?? 0; row.revenue += p?.revenue ?? 0;
      merged.set(c.campaign_id, row);
    }
    return [...merged.values()].filter((r) => r.spend > 0 || r.orders > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  })();
  const top = Math.max(...ranked.map((c) => c.revenue), 1);

  // ── Products table for the months in view ──
  const productRows = products
    .map((p) => ({ ...p, s: sumStore(cur, p.id) }))
    .filter((p) => p.s.orders > 0)
    .sort((a, b) => b.s.revenue - a.s.revenue);

  const noteMonths = new Set([...cur, ...(compare ? base : [])]);
  const notes = annotations.filter((a) => noteMonths.has(a.date.slice(0, 7)));
  const curSet = new Set(cur);
  const orders = recent.filter((o) => curSet.has(o.created_at.slice(0, 7))).slice(0, 10);

  // ── Chart ──
  const chartMonths = showPast ? months : current;
  const picked = new Set(compare ?? (focus ? [focus] : []));
  const chartData = chartMonths.map((m) => {
    const s = store[m]?.[product] ?? blankStoreMonth();
    return { month: m, ad: s.ad_revenue, other: Math.round(other(s) * 100) / 100, spend: ads[m]?.spend ?? 0, past: previous.includes(m), picked: picked.has(m) };
  });
  const spansYears = new Set(chartMonths.map((m) => m.slice(0, 4))).size > 1;
  const tickLabel = (m: string) => `${MONTHS[monthIdx(m)]}${spansYears ? ` ’${m.slice(2, 4)}` : ""}${m === thisMonth() ? "*" : ""}`;
  const sliderValue = focus && current.includes(focus) ? current.indexOf(focus) + 1 : 0;

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{client.name}</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-[34px]">Store overview</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-2">
            <span className="sr-only sm:not-sr-only">Item</span>
            <select value={product} onChange={(e) => setProduct(e.target.value)} className="input max-w-[260px]" aria-label="Show sales for">
              <option value={ALL}>All products</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </label>
          {rangeTabs}
        </div>
      </header>

      <section className="card mb-4 flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-3" aria-label="Choose months">
        <div className="min-w-[180px]">
          <p className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">{compare ? "Comparing" : "Showing"} · {productTitle}</p>
          <p className="font-display text-base font-bold" aria-live="polite">{compare ? scope : focus ? fullName(focus) : `All ${monthsBack} months`}</p>
        </div>
        <div className="flex min-w-[240px] flex-1 items-center gap-2">
          <button type="button" className="scrub-btn" aria-label="Previous month" onClick={() => scrub(Math.max(0, sliderValue - 1))} disabled={sliderValue === 0}>‹</button>
          <input type="range" min={0} max={current.length} step={1} value={sliderValue} onChange={(e) => scrub(Number(e.target.value))}
            className="scrub flex-1" aria-label="Scrub months" aria-valuetext={sliderValue === 0 ? `All ${monthsBack} months` : fullName(current[sliderValue - 1])} />
          <button type="button" className="scrub-btn" aria-label="Next month" onClick={() => scrub(Math.min(current.length, sliderValue + 1))} disabled={sliderValue === current.length}>›</button>
        </div>
        {(focus || compare || !isAll) && (
          <div className="flex gap-2">
            {!isAll && <button type="button" className="btn btn-ghost min-h-9 px-4" onClick={() => setProduct(ALL)}>All products</button>}
            {(focus || compare) && <button type="button" className="btn btn-ghost min-h-9 px-4" onClick={reset}>{compare ? "Exit compare" : "Show all months"}</button>}
          </div>
        )}
      </section>

      <div className="board">
        <section className="area-hero card hero-glow flex flex-col justify-between gap-4 p-6" aria-labelledby="hero-label">
          <div>
            <p id="hero-label" className="text-sm font-semibold text-ink-2">{isAll ? "Sales from ads" : `${productTitle} · sales from ads`} · {scope}</p>
            <p className="mt-2 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">{money(now.ad_revenue)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Delta now={now.ad_revenue} before={was.ad_revenue} vs={vs} />
              {heroChip && <span className="rounded-full bg-coral/15 px-2.5 py-1 text-xs font-bold text-coral">{heroChip}</span>}
            </div>
            <p className="mt-3 text-xs text-ink-3">Store-verified: Shopify orders whose visit carried ad UTMs or a Google click ID.</p>
          </div>
          <Sparkline values={current.map((m) => store[m]?.[product]?.ad_revenue ?? 0)} />
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

        <section className="area-funnel card p-0" aria-labelledby="verify-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-5">
            <h2 id="verify-title" className="font-display text-base font-bold">Store-verified vs. platform-reported</h2>
            <p className="text-xs text-ink-3">Whole store{isAll ? "" : " (the pixel can’t split purchases by item)"} · {scope}</p>
          </div>
          <ul className="grid grid-cols-2 lg:grid-cols-4">
            {verify.map((v, i) => (
              <li key={v.label} className={`flex flex-col gap-1 p-5 ${i > 0 ? "lg:border-l lg:border-line" : ""}`}>
                <span className="flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">
                  <span className="h-2 w-2 rounded-full" style={{ background: v.color, opacity: v.faded ? 0.45 : 1 }} />{v.label}
                </span>
                <span className={`font-display text-2xl font-extrabold tracking-tight ${v.faded ? "text-ink-2" : ""}`}>{v.value}</span>
                <span className="text-xs text-ink-3">{v.sub}</span>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
            Platforms count view-through and modeled purchases, so their totals usually run higher than what the store can tie to a click.
            Neither number is complete: some buyers switch devices, block tracking or come back later, so they show up as unattributed.
          </p>
        </section>

        <section className="area-trend card relative flex flex-col p-6" aria-labelledby="trend-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="trend-title" className="font-display text-base font-bold">{isAll ? "Sales by month" : `${productTitle} sales by month`}</h2>
            <div className="flex flex-wrap items-center gap-4 text-xs text-ink-2">
              <ul className="flex flex-wrap gap-4" aria-label="Legend">
                <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-coral" />From ads</li>
                <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--spend)" }} />Other sales</li>
                {isAll && <li className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-ink" />Ad spend</li>}
              </ul>
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input type="checkbox" className="h-4 w-4 accent-[#FF5A36]" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
                Show previous period
              </label>
            </div>
          </div>
          {(pending || compare) && (
            <div role="status" className="pointer-events-auto absolute left-1/2 top-16 z-20 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-bg shadow-lg sm:whitespace-nowrap">
              {compare ? `Comparing ${shortName(compare[0])} → ${shortName(compare[1])} · click any month to exit` : `${shortName(focus!)} selected · Click another data point to compare`}
              <button type="button" onClick={reset} aria-label="Clear selection" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bg/15 hover:bg-bg/25">×</button>
            </div>
          )}
          <div className="trend-chart flex-auto">
            <StoreChart data={chartData} showSpend={isAll} onPick={pick} tickLabel={tickLabel} />
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
            <h2 id="lead-title" className="font-display text-base font-bold">Campaigns by store sales</h2>
            <Link className="text-sm font-semibold text-coral hover:underline" href={`/dashboard/campaigns?client=${client.id}&months=${monthsBack}`}>All campaigns</Link>
          </div>
          {ranked.length === 0 ? <p className="text-sm text-ink-3">No campaign activity in this view.</p> : (
            <ol className="flex flex-col gap-4">
              {ranked.map((c, i) => (
                <li key={c.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                      <span className="font-display text-xs text-ink-3">{i + 1}</span>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.platform === "google" ? GOOGLE : META }} title={c.platform === "google" ? "Google" : "Meta"} />
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="shrink-0 font-display text-sm font-bold tabular-nums">{money(c.revenue)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-coral" style={{ width: `${(c.revenue / top) * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-ink-3">
                    {num(c.orders)} {isAll ? "orders" : "orders with this item"} · {money(c.spend)} spent{isAll ? ` · ${roas(c.revenue, c.spend)} ROAS` : ""}
                  </p>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-xs text-ink-3">Campaign-level matches need utm_campaign set to the campaign ID in the ad’s URL parameters.</p>
        </section>

        <section className="area-attr card p-6" aria-labelledby="attr-title">
          <h2 id="attr-title" className="font-display text-base font-bold">Where orders came from</h2>
          <div className="mt-4 flex items-center gap-5">
            <Ring parts={sources} total={now.orders} />
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
          <p className="mt-4 text-xs text-ink-3">Matched from the visit before checkout. Average order {now.orders ? money(now.revenue / now.orders, 2) : "—"}{isAll ? "" : " (this item’s share)"}.</p>
        </section>

        <section className="area-notes card p-6" aria-labelledby="prod-title">
          <h2 id="prod-title" className="font-display text-base font-bold">Products</h2>
          {productRows.length === 0 ? <p className="mt-3 text-sm text-ink-3">No sales in this view.</p> : (
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Sales by product, {scope}. Choose a product to filter the dashboard.</caption>
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th scope="col" className="pb-2 font-semibold">Item</th>
                  <th scope="col" className="pb-2 text-right font-semibold">Units</th>
                  <th scope="col" className="pb-2 text-right font-semibold">Sales</th>
                  <th scope="col" className="pb-2 text-right font-semibold">From ads</th>
                </tr>
              </thead>
              <tbody>
                {productRows.map((p) => (
                  <tr key={p.id} className={`border-t border-line ${p.id === product ? "bg-panel-2" : ""}`}>
                    <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
                      <button type="button" onClick={() => setProduct(p.id === product ? ALL : p.id)} aria-pressed={p.id === product}
                        className="min-h-8 text-left hover:text-coral hover:underline">{p.title}</button>
                    </th>
                    <td className="py-1.5 text-right tabular-nums">{num(p.s.units)}</td>
                    <td className="py-1.5 text-right tabular-nums">{money(p.s.revenue)}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-2">{pct(p.s.ad_revenue, p.s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="card min-w-0 p-6 lg:col-span-2" aria-labelledby="orders-title">
          <h2 id="orders-title" className="font-display text-base font-bold">Recent orders</h2>
          {orders.length === 0 ? <p className="mt-3 text-sm text-ink-3">No orders in this view.</p> : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <caption className="sr-only">Most recent orders, {scope}</caption>
                <thead>
                  <tr className="text-left text-xs text-ink-3">
                    <th scope="col" className="pb-2 font-semibold">Order</th>
                    <th scope="col" className="pb-2 font-semibold">Date</th>
                    <th scope="col" className="pb-2 font-semibold">Items</th>
                    <th scope="col" className="pb-2 font-semibold">Source</th>
                    <th scope="col" className="pb-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.order_id} className="border-t border-line align-top">
                      <td className="py-2 pr-3 font-semibold">{o.name}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-ink-2">{new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                      <td className="py-2 pr-3 text-ink-2">{o.items}</td>
                      <td className="py-2 pr-3">
                        {o.platform ? (
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.platform === "google" ? GOOGLE : META }} />
                            <span>{o.campaign_name ?? (o.platform === "google" ? "Google Ads" : "Meta Ads")}</span>
                          </span>
                        ) : <span className="text-ink-3">{o.utm_source ? `${o.utm_source}${o.utm_medium ? ` / ${o.utm_medium}` : ""}` : "Unattributed"}</span>}
                      </td>
                      <td className="py-2 text-right tabular-nums">{money(o.total, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card p-6" aria-labelledby="notes-title">
          <h2 id="notes-title" className="font-display text-base font-bold">What changed</h2>
          {notes.length === 0 ? <p className="mt-3 text-sm text-ink-3">No notes for this period.</p> : (
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

type StorePoint = { month: string; ad: number; other: number; spend: number; past: boolean; picked: boolean };

function StoreChart({ data, showSpend, onPick, tickLabel }: { data: StorePoint[]; showSpend: boolean; onPick: (m: string) => void; tickLabel: (m: string) => string }) {
  const { theme } = usePrefs();
  const dark = theme === "dark";
  const c = dark
    ? { grid: "rgba(255,255,255,0.06)", tick: "#6F7E93", other: "#5E7090", line: "#EEF2F7", panel: "#172840", border: "rgba(255,255,255,0.1)", text: "#EEF2F7" }
    : { grid: "#E6E9EE", tick: "#7C899B", other: "#A8B4C5", line: "#0F1B2D", panel: "#FFFFFF", border: "#E0E4EA", text: "#0F1B2D" };
  const picked = data.filter((d) => d.picked).map((d) => d.month);
  const short = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v}`);
  const op = (d: StorePoint) => (d.picked ? 1 : d.past ? 0.4 : picked.length ? 0.6 : 1);
  return (
    <div className="h-full w-full [&_.recharts-surface]:cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 4, left: -6, bottom: 0 }}
          onClick={(s: { activeLabel?: string | number } | null) => { if (s?.activeLabel !== undefined) onPick(String(s.activeLabel)); }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="month" tickFormatter={tickLabel} tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} />
          <YAxis tickFormatter={short} tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} width={56} />
          {picked.map((m) => <ReferenceLine key={m} x={m} stroke="#FF5A36" strokeDasharray="4 4" strokeWidth={1.5} />)}
          <Tooltip
            cursor={{ fill: dark ? "rgba(255,255,255,0.05)" : "rgba(15,27,45,0.05)" }}
            contentStyle={{ borderRadius: 14, border: `1px solid ${c.border}`, background: c.panel, color: c.text, fontSize: 13 }}
            labelStyle={{ color: c.text, fontWeight: 700 }} itemStyle={{ color: c.text }}
            labelFormatter={(m) => tickLabel(String(m))}
            formatter={(value, name) => [`$${Number(value).toLocaleString()}`, name]}
          />
          <Bar dataKey="ad" name="From ads" stackId="s" fill="#FF5A36" maxBarSize={28}>
            {data.map((d) => <Cell key={d.month} fillOpacity={op(d)} />)}
          </Bar>
          <Bar dataKey="other" name="Other sales" stackId="s" fill={c.other} radius={[6, 6, 0, 0]} maxBarSize={28}>
            {data.map((d) => <Cell key={d.month} fillOpacity={op(d)} />)}
          </Bar>
          {showSpend && <Line dataKey="spend" name="Ad spend" stroke={c.line} strokeWidth={2} strokeDasharray="5 4" dot={false} type="monotone" />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
