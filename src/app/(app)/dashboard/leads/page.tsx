import type { Metadata } from "next";
import { Empty, PageHeader } from "@/components/ui";
import { getRecentLeads, getRecentOrders, getViewer, resolveClient } from "@/lib/data";
import { money } from "@/lib/metrics";

export const metadata: Metadata = { title: "Leads & Sales" };

const APPT_LABEL: Record<string, string> = { showed: "Showed", noshow: "No-show", booked: "Booked", confirmed: "Confirmed", cancelled: "Cancelled" };

export default async function LeadsPage({ searchParams }: PageProps<"/dashboard/leads">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const client = await resolveClient(viewer, typeof sp.client === "string" ? sp.client : undefined);
  if (!client) return <Empty title="No client yet" />;
  if (client.primary_goal === "ecommerce") return <OrdersView name={client.name} orders={await getRecentOrders(client.id, 50)} />;
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

const GOOGLE = "#4C8DFF", META = "#FF5A36";

/** E-commerce clients: Shopify orders instead of CRM leads. */
function OrdersView({ name, orders }: { name: string; orders: Awaited<ReturnType<typeof getRecentOrders>> }) {
  return (
    <>
      <PageHeader eyebrow={name} title="Orders & sales" />
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-2">
        The 50 most recent Shopify orders, with the ad each one was tied to. Orders without ad tracking show where the visit came from instead.
      </p>
      {orders.length === 0 ? (
        <Empty title="No orders yet">Orders appear here once the Shopify store is connected and synced.</Empty>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-line bg-panel-2">
                <tr>
                  <th className="th">Order</th>
                  <th className="th">Date</th>
                  <th className="th">Items</th>
                  <th className="th">From ads</th>
                  <th className="th">Visit source</th>
                  <th className="th text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.order_id} className="border-b border-line align-top last:border-0">
                    <td className="td font-semibold">
                      {o.name}
                      {o.cancelled && <span className="pill ml-2">Cancelled</span>}
                    </td>
                    <td className="td whitespace-nowrap text-ink-2">{new Date(o.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</td>
                    <td className="td text-ink-2">{o.items || "—"}</td>
                    <td className="td">
                      {o.platform ? (
                        <span className="flex items-start gap-2">
                          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: o.platform === "google" ? GOOGLE : META }} />
                          <span>
                            {o.campaign_name ?? (o.platform === "google" ? "Google Ads" : "Meta Ads")}
                            <span className="block text-xs text-ink-3">{o.match_method === "click_id" ? "Matched by Google click ID" : "Matched by UTM"}</span>
                          </span>
                        </span>
                      ) : <span className="text-ink-3">Unattributed</span>}
                    </td>
                    <td className="td text-ink-2">{o.source}</td>
                    <td className={`td text-right font-semibold tabular-nums ${o.cancelled ? "text-ink-3 line-through" : ""}`}>{money(o.total, 2)}</td>
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
