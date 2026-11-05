import type { Metadata } from "next";
import Link from "next/link";
import { hostOf, SERVICE_NAME, STATUS_LABEL, TierPill } from "@/components/LeadBits";
import { Empty, PageHeader } from "@/components/ui";
import { concernLabel } from "@/lib/audit-leads";
import { getAuditLeads, requireAdmin } from "@/lib/data";

const countSince = (leads: { created_at: string }[], days: number) => {
  const cutoff = Date.now() - days * 864e5;
  return leads.filter((l) => new Date(l.created_at).getTime() > cutoff).length;
};

export const metadata: Metadata = { title: "Audit leads" };

export default async function LeadsPage({ searchParams }: PageProps<"/admin/leads">) {
  await requireAdmin();
  const sp = await searchParams;
  const all = await getAuditLeads();
  const filter = typeof sp.tier === "string" ? sp.tier : "all";
  const leads = filter === "all" ? all : filter === "open" ? all.filter((l) => l.status === "new") : all.filter((l) => l.lead_tier === filter);
  const stats = [
    { label: "This week", value: countSince(all, 7) },
    { label: "Hot leads", value: all.filter((l) => l.lead_tier === "hot").length },
    { label: "Not contacted yet", value: all.filter((l) => l.status === "new").length },
    { label: "Won", value: all.filter((l) => l.status === "won").length },
  ];
  const tabs = [["all", "All"], ["hot", "Hot"], ["warm", "Warm"], ["cool", "Cool"], ["open", "Not contacted"]];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Audit leads">
        <a className="btn btn-ghost" href="https://gr8hook.com/audit/" target="_blank" rel="noopener">Open the audit page<span className="sr-only"> (opens in a new tab)</span></a>
      </PageHeader>
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-2">Business owners who asked for their full report on gr8hook.com/audit, scored by how well their findings fit what we sell. Hot leads are also emailed to you.</p>

      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card"><span className="text-xs font-semibold text-ink-2">{s.label}</span><p className="font-display text-3xl font-extrabold">{s.value}</p></div>
        ))}
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filter leads">
        {tabs.map(([k, label]) => (
          <Link key={k} href={k === "all" ? "/admin/leads" : `/admin/leads?tier=${k}`} aria-current={filter === k ? "page" : undefined}
            className={`flex min-h-9 items-center rounded-full px-4 text-sm font-semibold ${filter === k ? "bg-ink text-bg" : "border border-line text-ink-2 hover:text-ink"}`}>{label}</Link>
        ))}
      </nav>

      {leads.length === 0 ? (
        <Empty title="No leads here yet">When someone requests their full report on gr8hook.com/audit, they&apos;ll show up here.</Empty>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead className="border-b border-line bg-panel-2">
                <tr><th className="th">Received</th><th className="th">Business</th><th className="th">Website</th><th className="th">Biggest concern</th><th className="th">Lead</th><th className="th">Pitch</th><th className="th">Status</th></tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0 hover:bg-panel-2/60">
                    <td className="td whitespace-nowrap text-ink-2">{new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="td">
                      <Link href={`/admin/leads/${l.id}`} className="font-semibold hover:text-coral hover:underline">{l.business}</Link>
                      <span className="block text-xs text-ink-3">{l.name}</span>
                    </td>
                    <td className="td text-ink-2">{hostOf(l.website)}</td>
                    <td className="td text-ink-2">{concernLabel(l.concern)}</td>
                    <td className="td"><TierPill tier={l.lead_tier} score={l.lead_score} /></td>
                    <td className="td text-ink-2">{SERVICE_NAME[l.suggested_services[0]] ?? "—"}</td>
                    <td className="td">{STATUS_LABEL[l.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
