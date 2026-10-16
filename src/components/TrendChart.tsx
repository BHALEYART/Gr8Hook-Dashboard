"use client";

import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefs } from "@/lib/prefs";
import type { MonthRow } from "@/lib/types";

const money = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `$${v}`);
const compact = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`);

function palette(theme: "dark" | "light") {
  return theme === "dark"
    ? { grid: "rgba(255,255,255,0.06)", tick: "#6F7E93", spend: "#5E7090", spendOn: "#9FB2CF", line: "#EEF2F7", panel: "#172840", border: "rgba(255,255,255,0.1)", text: "#EEF2F7" }
    : { grid: "#E6E9EE", tick: "#7C899B", spend: "#A8B4C5", spendOn: "#5E7090", line: "#0F1B2D", panel: "#FFFFFF", border: "#E0E4EA", text: "#0F1B2D" };
}

export interface ChartPoint extends MonthRow {
  /** Month belongs to the previous period (drawn faded). */
  past: boolean;
  /** Month is in view: scrubbed to, or one side of a comparison. */
  picked: boolean;
}

/**
 * Results: revenue from ads (area) against ad spend (bars), with leads as a dashed line.
 * Reach: people reached per month (bars). Clicking a month calls onPick.
 */
export function TrendChart({
  data, mode = "results", leadLabel = "Leads", onPick, tickLabel,
}: {
  data: ChartPoint[];
  mode?: "results" | "reach";
  leadLabel?: string;
  onPick?: (month: string) => void;
  tickLabel: (month: string) => string;
}) {
  const { theme } = usePrefs();
  const c = palette(theme);
  const picked = data.filter((d) => d.picked).map((d) => d.month);
  const click = (s: { activeLabel?: string | number } | null) => {
    if (s?.activeLabel !== undefined && onPick) onPick(String(s.activeLabel));
  };

  return (
    <div className="h-full w-full [&_.recharts-surface]:cursor-pointer">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 4, left: -6, bottom: 0 }} onClick={click}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF5A36" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#FF5A36" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="month" tickFormatter={tickLabel} tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} />
          {picked.map((m) => (
            <ReferenceLine key={m} x={m} yAxisId={mode === "reach" ? "count" : "money"} stroke="#FF5A36" strokeDasharray="4 4" strokeWidth={1.5} />
          ))}
          <Tooltip
            cursor={{ fill: theme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(15,27,45,0.05)" }}
            contentStyle={{ borderRadius: 14, border: `1px solid ${c.border}`, background: c.panel, color: c.text, fontSize: 13 }}
            labelStyle={{ color: c.text, fontWeight: 700 }}
            itemStyle={{ color: c.text }}
            labelFormatter={(m) => tickLabel(String(m))}
            formatter={(value, name) => {
              const v = Number(value);
              return [name === "Ad spend" || name === "Revenue from ads" ? `$${v.toLocaleString()}` : v.toLocaleString(), name];
            }}
          />

          {mode === "reach" ? (
            <>
              <YAxis yAxisId="count" tickFormatter={compact} tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} width={48} />
              <Bar yAxisId="count" dataKey="reach" name="People reached" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {data.map((d) => (
                  <Cell key={d.month} fill="#FF5A36" fillOpacity={d.picked ? 1 : d.past ? 0.35 : picked.length ? 0.55 : 1} />
                ))}
              </Bar>
            </>
          ) : (
            <>
              <YAxis yAxisId="money" tickFormatter={money} tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} width={56} />
              <YAxis yAxisId="count" orientation="right" tickLine={false} axisLine={false} tick={{ fill: c.tick, fontSize: 12 }} width={34} allowDecimals={false} />
              <Bar yAxisId="money" dataKey="spend" name="Ad spend" radius={[6, 6, 0, 0]} maxBarSize={18}>
                {data.map((d) => (
                  <Cell key={d.month} fill={d.picked ? c.spendOn : c.spend} fillOpacity={d.past && !d.picked ? 0.45 : 1} />
                ))}
              </Bar>
              <Area yAxisId="money" dataKey="revenue" name="Revenue from ads" type="monotone" stroke="#FF5A36" strokeWidth={2.5} fill="url(#revFill)" />
              <Line yAxisId="count" dataKey="leads" name={leadLabel} stroke={c.line} strokeWidth={2} strokeDasharray="5 4" dot={false} type="monotone" />
            </>
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Tiny trend for the hero panel. */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 220, h = 64, max = Math.max(...values, 1);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - (v / max) * (h - 8)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FF5A36" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#FF5A36" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#sparkFill)" />
      <path d={line} fill="none" stroke="#FF5A36" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
