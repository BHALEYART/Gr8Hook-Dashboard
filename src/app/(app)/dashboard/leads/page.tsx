import type { Metadata } from "next";
import { Empty, PageHeader } from "@/components/ui";
import { getRecentLeads, getViewer, resolveClient } from "@/lib/data";
import { money } from "@/lib/metrics";

export const metadata: Metadata = { title: "Leads & Sales" };

const APPT_LABEL: Record<string, string> = { showed: "Showed", noshow: "No-show", booked: "Booked", confirmed: "Confirmed", cancelled: "Cancelled" };

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const client = await resolveClient(viewer, typeof sp.client === "string" ? sp.client : undefined);
  if (!client) return <Empty title="No client yet" />;
  const leads = await getRecentLeads(client.id, 50);

  return (
    <>
      <PageHeader eyebrow={client.name} title="Leads & sales" />
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-2">The 50 most recent leads from your CRM, with the ad that brought them in and what happened next.</p>
      {leads.length === 0 ? (
        <Empty title="No leads yet">Leads appear here once your CRM is connected.</Empty>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-line bg-panel-2">
                <tr>
                  <th className="th">Lead</th>
                  <th className="th">Date</th>
                  <th className="th">Source</th>
                  <th className="th">Campaign</th>
                  <th className="th">Appointment</th>
                  <th className="th text-right">Sale</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="td font-semibold">{l.name}</td>
                    <td className="td text-ink-2">{new Date(l.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="td capitalize">{l.source ?? "Unknown"}</td>
                    <td className="td">{l.campaign_name ?? <span className="text-ink-3">Unattributed</span>}</td>
                    <td className="td">{l.appointment ? APPT_LABEL[l.appointment] ?? l.appointment : <span className="text-ink-3">—</span>}</td>
                    <td className="td text-right font-semibold tabular-nums">
                      {l.won_value ? <>{money(l.won_value)}<span className="block text-xs font-normal text-ink-3">{l.service}</span></> : <span className="font-normal text-ink-3">—</span>}
                    </td>
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
