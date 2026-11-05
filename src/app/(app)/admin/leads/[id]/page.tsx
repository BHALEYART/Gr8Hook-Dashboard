import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hostOf, SERVICE_NAME, STATUS_LABEL, TierPill } from "@/components/LeadBits";
import { DemoNotice, Notice } from "@/components/ui";
import { concernLabel } from "@/lib/audit-leads";
import { getAuditLead, requireAdmin } from "@/lib/data";
import type { LeadScores } from "@/lib/types";
import { updateLeadAction } from "../actions";

export const metadata: Metadata = { title: "Audit lead" };

const color = (n: number | null | undefined) => (n == null ? "text-ink-3" : n >= 90 ? "text-good" : n >= 50 ? "text-[#B7791F]" : "text-bad");
function ScoreRow({ label, s }: { label: string; s: LeadScores | null }) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      {s ? (
        <div className="grid grid-cols-4 gap-2">
          {([["Performance", s.performance], ["Accessibility", s.accessibility], ["SEO", s.seo], ["Best practices", s.bestPractices]] as const).map(([k, v]) => (
            <div key={k} className="rounded-xl bg-panel-2 p-3 text-center">
              <p className={`font-display text-2xl font-extrabold ${color(v)}`}>{v ?? "–"}</p>
              <p className="text-[11px] text-ink-2">{k}</p>
            </div>
          ))}
        </div>
      ) : <p className="text-sm text-ink-3">Not available</p>}
    </div>
  );
}

export default async function LeadPage({ params, searchParams }: PageProps<"/admin/leads/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const lead = await getAuditLead(id);
  if (!lead) notFound();
  const received = new Date(lead.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

  return (
    <>
      <Link href="/admin/leads" className="mb-3 inline-block text-sm font-semibold text-ink-2 hover:text-ink">← All audit leads</Link>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Audit lead · {received}</p>
          <h1 className="mt-1 flex flex-wrap items-center gap-3 font-display text-3xl font-bold tracking-tight">{lead.business} <TierPill tier={lead.lead_tier} score={lead.lead_score} /></h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-coral" href={`mailto:${lead.email}?subject=${encodeURIComponent(`Your website report for ${hostOf(lead.website)}`)}`}>Email {lead.name.split(" ")[0]}</a>
          {lead.phone && <a className="btn btn-ghost" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>Call</a>}
          <a className="btn btn-ghost" href={lead.website} target="_blank" rel="noopener">Visit site<span className="sr-only"> (opens in a new tab)</span></a>
        </div>
      </header>
      {sp.demo === "1" && <DemoNotice />}
      {sp.saved === "1" && <Notice>Saved.</Notice>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card flex flex-col gap-4 lg:col-span-2" aria-labelledby="pitch-h">
          <div>
            <h2 id="pitch-h" className="font-display text-base font-bold">What to pitch</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {lead.suggested_services.map((s, i) => <span key={s} className={`pill ${i === 0 ? "bg-coral/15 text-coral" : ""}`}>{SERVICE_NAME[s] ?? s}</span>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Biggest concern</p>
            <p className="mt-1 font-semibold">{concernLabel(lead.concern)}</p>
            {lead.concern_detail && <p className="mt-1 text-sm text-ink-2">&ldquo;{lead.concern_detail}&rdquo;</p>}
          </div>
          {lead.score_reasons.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Why this score</p>
              <ul className="mt-1 flex flex-wrap gap-2">{lead.score_reasons.map((r) => <li key={r} className="pill">{r}</li>)}</ul>
            </div>
          )}
          <ScoreRow label="Mobile" s={lead.scores.mobile} />
          <ScoreRow label="Desktop" s={lead.scores.desktop} />
        </section>

        <section className="card flex flex-col gap-3" aria-labelledby="contact-h">
          <h2 id="contact-h" className="font-display text-base font-bold">Contact</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-ink-3">Name</dt><dd className="font-semibold">{lead.name}</dd></div>
            <div><dt className="text-ink-3">Email</dt><dd className="font-semibold break-all">{lead.email}</dd></div>
            {lead.phone && <div><dt className="text-ink-3">Phone</dt><dd className="font-semibold">{lead.phone}</dd></div>}
            <div><dt className="text-ink-3">Website</dt><dd className="font-semibold break-all">{lead.website}</dd></div>
            <div><dt className="text-ink-3">Audited</dt><dd>{new Date(lead.audited_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</dd></div>
            <div><dt className="text-ink-3">Source</dt><dd>{[lead.utm.utm_source, lead.utm.utm_campaign].filter(Boolean).join(" / ") || (lead.referrer ? hostOf(lead.referrer) : "Direct")}</dd></div>
            <div><dt className="text-ink-3">Report emailed</dt><dd>{lead.report_emailed_at ? "Yes" : "No"}</dd></div>
            <div><dt className="text-ink-3">Marketing emails</dt><dd>{lead.consent_marketing ? "Opted in" : "Not opted in"}</dd></div>
          </dl>
          <form action={updateLeadAction} className="mt-2 grid gap-3 border-t border-line pt-4">
            <input type="hidden" name="id" value={lead.id} />
            <div className="field">
              <label className="label" htmlFor="status">Status</label>
              <select className="input" id="status" name="status" defaultValue={lead.status}>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="notes">Notes</label>
              <textarea className="input min-h-24 py-2" id="notes" name="notes" defaultValue={lead.notes ?? ""} />
            </div>
            <div><button className="btn btn-navy" type="submit">Save</button></div>
          </form>
        </section>

        <section className="card lg:col-span-3" aria-labelledby="recs-h">
          <h2 id="recs-h" className="font-display text-base font-bold">Recommendations sent in their report</h2>
          {lead.recommendations.length === 0 ? <p className="mt-2 text-sm text-ink-3">No major issues found.</p> : (
            <ol className="mt-3 grid gap-3 md:grid-cols-2">
              {lead.recommendations.map((r, i) => (
                <li key={i} className="rounded-xl bg-panel-2 p-4">
                  <p className="font-semibold">{i + 1}. {r.title} {r.priority === "high" && <span className="ml-1 text-xs font-bold text-bad">High priority</span>}</p>
                  <p className="mt-1 text-sm text-ink-2">{r.why}</p>
                  <p className="mt-1 text-sm text-ink-2"><strong className="text-ink">Fix:</strong> {r.fix}</p>
                  <p className="mt-1 text-xs text-ink-3">Service: {SERVICE_NAME[r.service] ?? r.service}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </>
  );
}
