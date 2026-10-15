import type { Metadata } from "next";
import { Empty, PageHeader, PlatformBadge, RangeTabs, parseMonths } from "@/components/ui";
import { getDashboard, getViewer, resolveClient } from "@/lib/data";
import { money, num } from "@/lib/metrics";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage({ searchParams }: PageProps<"/dashboard/campaigns">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const client = await resolveClient(viewer, typeof sp.client === "string" ? sp.client : undefined);
  if (!client) return <Empty title="No client yet" />;
  const months = parseMonths(sp.months);
  const { campaigns } = await getDashboard(client.id, months);

  return (
    <>
      <PageHeader eyebrow={client.name} title="Campaigns">
        <RangeTabs base="/dashboard/campaigns" clientId={client.id} months={months} />
      </PageHeader>
      {campaigns.length === 0 ? (
        <Empty title="No campaign data yet">Campaign results appear here after the first nightly sync.</Empty>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-line bg-panel-2">
                <tr>
                  <th className="th">Campaign</th>
                  <th className="th">Product / service</th>
                  <th className="th text-right">Spend</th>
                  <th className="th text-right">Clicks</th>
                  <th className="th text-right">Leads</th>
                  <th className="th text-right">Cost / lead</th>
                  <th className="th text-right">Revenue</th>
                  <th className="th text-right">ROAS</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.campaign_id} className="border-b border-line last:border-0">
                    <td className="td"><div className="flex items-center gap-2"><PlatformBadge platform={c.platform} /><span className="font-semibold">{c.campaign_name}</span></div></td>
                    <td className="td text-ink-2">{c.service ?? <span className="text-ink-3">Not paired</span>}</td>
                    <td className="td text-right tabular-nums">{money(c.spend)}</td>
                    <td className="td text-right tabular-nums">{num(c.clicks)}</td>
                    <td className="td text-right tabular-nums">{num(c.leads)}</td>
                    <td className="td text-right tabular-nums">{c.leads ? money(c.spend / c.leads) : "—"}</td>
                    <td className="td text-right font-semibold tabular-nums">{money(c.revenue)}</td>
                    <td className="td text-right tabular-nums">{c.spend ? `${(c.revenue / c.spend).toFixed(1)}×` : "—"}</td>
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
