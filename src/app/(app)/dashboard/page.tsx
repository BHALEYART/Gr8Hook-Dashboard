import type { Metadata } from "next";
import Link from "next/link";
import { Sparkline, TrendChart } from "@/components/TrendChart";
import { Delta, Empty, PageHeader, RangeTabs, parseMonths } from "@/components/ui";
import { getDashboard, getViewer, resolveClient } from "@/lib/data";
import { money, num } from "@/lib/metrics";

export const metadata: Metadata = { title: "Overview" };

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default async function OverviewPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const client = await resolveClient(viewer, typeof sp.client === "string" ? sp.client : undefined);
  if (!client) {
    return <Empty title="No client yet">Your account isn&apos;t linked to a client. Contact Gr8 Hook to get set up.</Empty>;
  }
  const months = parseMonths(sp.months);
  const { months: rows, kpis: k, funnel, bySource, campaigns, annotations } = await getDashboard(client.id, months);
  const apptGoal = client.primary_goal === "appointments";
  const topRevenue = Math.max(...campaigns.map((c) => c.revenue), 1);

  const steps = [
    { label: "Ad spend", value: money(funnel.spend), rate: null as string | null },
    { label: "Clicks", value: num(funnel.clicks), rate: null },
    { label: "Leads", value: num(funnel.leads), rate: `${pct(funnel.leads, funnel.clicks)} of clicks` },
    { label: "Appointments", value: num(funnel.appointments), rate: `${pct(funnel.appointments, funnel.leads)} of leads` },
    { label: "Sales", value: num(funnel.sales), rate: `${pct(funnel.sales, funnel.leads)} of leads` },
  ];
  const totalLeads = bySource.google + bySource.meta + bySource.unattributed;
  const sources = [
    { key: "Google Ads", n: bySource.google, color: "#4C8DFF" },
    { key: "Meta Ads", n: bySource.meta, color: "#FF5A36" },
    { key: "Unattributed", n: bySource.unattributed, color: "var(--ink-3)" },
  ];

  return (
    <>
      <PageHeader eyebrow={client.name} title="Overview">
        <RangeTabs base="/dashboard" clientId={client.id} months={months} />
      </PageHeader>

      <div className="board">
        {/* Hero: the number that matters */}
        <section className="area-hero card hero-glow flex flex-col justify-between gap-4 p-6" aria-labelledby="hero-label">
          <div>
            <p id="hero-label" className="text-sm font-semibold text-ink-2">Revenue from ads · last {months} months</p>
            <p className="mt-2 font-display text-5xl font-extrabold tracking-tight sm:text-6xl">{money(k.revenue)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Delta now={k.revenue} before={k.prev.revenue} />
              {k.roas && <span className="rounded-full bg-coral/15 px-2.5 py-1 text-xs font-bold text-coral">{k.roas.toFixed(1)}× return on ad spend</span>}
            </div>
          </div>
          <Sparkline values={rows.map((r) => r.revenue)} />
        </section>

        {/* KPI tiles */}
        <section className="area-kpis kpi-grid grid grid-cols-2 gap-4" aria-label="Key numbers">
          <Tile label="Ad spend" value={money(k.spend)} delta={<Delta now={k.spend} before={k.prev.spend} neutral />} />
          <Tile label={apptGoal ? "Appointments" : "Leads from ads"} value={num(apptGoal ? k.appointments : k.leads)}
            delta={apptGoal ? <Delta now={k.appointments} before={k.prev.appointments} /> : <Delta now={k.leads} before={k.prev.leads} />} />
          <Tile label={apptGoal ? "Cost / appointment" : "Cost / lead"}
            value={(apptGoal ? k.costPerAppointment : k.costPerLead) ? money((apptGoal ? k.costPerAppointment : k.costPerLead)!) : "—"}
            delta={apptGoal
              ? <Delta now={k.costPerAppointment ?? 0} before={k.prev.appointments ? k.prev.spend / k.prev.appointments : 0} goodWhenUp={false} />
              : <Delta now={k.costPerLead ?? 0} before={k.prev.leads ? k.prev.spend / k.prev.leads : 0} goodWhenUp={false} />} />
          <Tile label={apptGoal ? "Leads from ads" : "Appointments"} value={num(apptGoal ? k.leads : k.appointments)}
            delta={apptGoal ? <Delta now={k.leads} before={k.prev.leads} /> : <Delta now={k.appointments} before={k.prev.appointments} />} />
        </section>

        {/* Funnel */}
        <section className="area-funnel card p-0" aria-labelledby="funnel-title">
          <h2 id="funnel-title" className="sr-only">From ad spend to sales</h2>
          <ol className="funnel-row grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.label} className={`relative flex flex-col gap-1 p-5 ${i > 0 ? "md:border-l md:border-line" : ""}`}>
                <span className="font-display text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
                  <span className="mr-2 text-coral">0{i + 1}</span>{s.label}
                </span>
                <span className="font-display text-2xl font-extrabold tracking-tight">{s.value}</span>
                <span className="text-xs text-ink-3">{s.rate ?? " "}</span>
                {i < steps.length - 1 && (
                  <span className="absolute right-[-9px] top-1/2 z-10 hidden h-[18px] w-[18px] -translate-y-1/2 items-center justify-center rounded-full border border-line bg-panel text-ink-3 md:flex" aria-hidden="true">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 6l6 6-6 6" /></svg>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        {/* Trend */}
        <section className="area-trend card flex flex-col p-6" aria-labelledby="trend-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="trend-title" className="font-display text-base font-bold">Spend vs. revenue</h2>
            <ul className="flex flex-wrap gap-4 text-xs text-ink-2" aria-label="Legend">
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--spend)" }} />Ad spend</li>
              <li className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-coral" />Revenue from ads</li>
              <li className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-ink" />{apptGoal ? "Leads" : "Leads from ads"}</li>
            </ul>
          </div>
          <div className="trend-chart flex-auto">
            <TrendChart data={rows} leadLabel={apptGoal ? "Leads" : "Leads from ads"} />
          </div>
        </section>

        {/* Campaign leaderboard */}
        <section className="area-lead card p-6" aria-labelledby="lead-title">
          <div className="mb-4 flex items-center justify-between">
            <h2 id="lead-title" className="font-display text-base font-bold">Campaign leaderboard</h2>
            <Link className="text-sm font-semibold text-coral hover:underline" href={`/dashboard/campaigns?client=${client.id}&months=${months}`}>All campaigns</Link>
          </div>
          <ol className="flex flex-col gap-4">
            {[...campaigns].sort((a, b) => b.revenue - a.revenue).slice(0, 6).map((c, i) => (
              <li key={c.campaign_id}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                    <span className="font-display text-xs text-ink-3">{i + 1}</span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.platform === "google" ? "#4C8DFF" : "#FF5A36" }} title={c.platform === "google" ? "Google" : "Meta"} />
                    <span className="truncate">{c.campaign_name}</span>
                  </span>
                  <span className="shrink-0 font-display text-sm font-bold tabular-nums">{money(c.revenue)}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2">
                  <div className="h-full rounded-full bg-coral" style={{ width: `${(c.revenue / topRevenue) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  {money(c.spend)} spent · {num(c.leads)} leads · {c.spend ? `${(c.revenue / c.spend).toFixed(1)}×` : "—"} ROAS{c.service ? ` · ${c.service}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Attribution ring */}
        <section className="area-attr card p-6" aria-labelledby="attr-title">
          <h2 id="attr-title" className="font-display text-base font-bold">Where leads came from</h2>
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

        {/* Notes */}
        <section className="area-notes card p-6" aria-labelledby="notes-title">
          <h2 id="notes-title" className="font-display text-base font-bold">What changed</h2>
          {annotations.length === 0 ? (
            <p className="mt-3 text-sm text-ink-3">No notes for this period.</p>
          ) : (
            <ol className="mt-4 flex flex-col gap-4 border-l border-line pl-4">
              {annotations.map((a) => (
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

function Tile({ label, value, delta }: { label: string; value: string; delta: React.ReactNode }) {
  return (
    <div className="card flex flex-col justify-between gap-2">
      <span className="text-xs font-semibold text-ink-2">{label}</span>
      <span className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{value}</span>
      {delta}
    </div>
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
