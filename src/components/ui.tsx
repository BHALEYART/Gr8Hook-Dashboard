import Link from "next/link";
import type { ReactNode } from "react";
import { pctChange } from "@/lib/metrics";

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight sm:text-[34px]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  );
}

/** Change badge. `goodWhenUp=false` for costs, where a drop is good. */
export function Delta({ now, before, goodWhenUp = true, neutral = false }: { now: number; before: number; goodWhenUp?: boolean; neutral?: boolean }) {
  const pct = pctChange(now, before);
  if (pct === null || !isFinite(pct)) return <span className="text-xs text-ink-3">No prior data</span>;
  const up = pct >= 0;
  const good = up === goodWhenUp;
  const color = neutral ? "text-ink-2" : good ? "text-good" : "text-bad";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color}`}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span>
      {Math.abs(pct).toFixed(0)}% <span className="font-normal text-ink-3">vs. prior period</span>
    </span>
  );
}

export function Kpi({ label, value, delta, hint }: { label: string; value: string; delta?: ReactNode; hint?: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="font-display text-xs font-semibold uppercase tracking-wider text-ink-2">{label}</span>
      <span className="font-display text-3xl font-extrabold tracking-tight">{value}</span>
      {delta}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

export function RangeTabs({ base, clientId, months }: { base: string; clientId: string; months: number }) {
  const opts = [3, 6, 12];
  return (
    <div className="inline-flex rounded-xl border border-line bg-panel p-1" role="group" aria-label="Date range">
      {opts.map((m) => (
        <Link
          key={m}
          href={`${base}?client=${clientId}&months=${m}`}
          aria-current={m === months ? "true" : undefined}
          className={`flex min-h-9 items-center rounded-[10px] px-4 text-sm font-semibold ${m === months ? "bg-coral text-white" : "text-ink-2 hover:text-ink"}`}
        >
          {m} mo
        </Link>
      ))}
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string }) {
  const label = platform === "google" ? "Google" : platform === "meta" ? "Meta" : platform;
  return (
    <span className="pill gap-1.5">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: platform === "google" ? "#4C8DFF" : "#FF5A36" }} aria-hidden="true" />
      {label}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 py-12 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      {children && <div className="max-w-md text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function DemoNotice() {
  return (
    <p className="mb-4 max-w-3xl rounded-lg bg-coral/10 px-4 py-3 text-sm text-coral-dark" role="status">
      Demo mode: changes aren&apos;t saved. Connect Supabase (see README) to make this live.
    </p>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return <p className="mb-4 max-w-3xl rounded-lg bg-good/10 px-4 py-3 text-sm text-good" role="status">{children}</p>;
}

export function parseMonths(v: unknown) {
  const n = Number(v);
  return n === 3 || n === 12 ? n : 6;
}
