import type { Metadata } from "next";
import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { getServices, listClients, requireAdmin } from "@/lib/data";

export const metadata: Metadata = { title: "Clients" };

const SERVICE_LABEL: Record<string, string> = { meta_ads: "Meta", google_ads: "Google", ghl: "GoHighLevel", callrail: "CallRail" };
const GOAL_LABEL: Record<string, string> = { leads: "Leads", sales: "Sales", appointments: "Appointments" };

export default async function AdminPage() {
  await requireAdmin();
  const clients = await listClients();
  const services = await Promise.all(clients.map((c) => getServices(c.id)));

  return (
    <>
      <PageHeader eyebrow="Admin" title="Clients">
        <Link className="btn btn-coral" href="/admin/clients/new">Add client</Link>
      </PageHeader>
      {clients.length === 0 ? (
        <Empty title="No clients yet">Add your first client to start syncing their ad and CRM data.</Empty>
      ) : (
        <section className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-line bg-panel-2">
                <tr><th className="th">Client</th><th className="th">Goal</th><th className="th">Connected</th><th className="th">Status</th><th className="th"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="td font-semibold">{c.name}</td>
                    <td className="td">{GOAL_LABEL[c.primary_goal]}</td>
                    <td className="td">
                      <div className="flex flex-wrap gap-1.5">
                        {services[i].filter((s) => s.enabled).map((s) => (
                          <span key={s.service} className="rounded-full bg-panel-2 px-2.5 py-0.5 text-xs font-semibold text-ink-2">{SERVICE_LABEL[s.service]}</span>
                        ))}
                      </div>
                    </td>
                    <td className="td">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.status === "active" ? "bg-good/10 text-good" : "bg-panel-2 text-ink-3"}`}>
                        {c.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-3 text-sm font-semibold">
                        <Link className="text-coral hover:underline" href={`/dashboard?client=${c.id}`}>View dashboard</Link>
                        <Link className="text-ink hover:underline" href={`/admin/clients/${c.id}`}>Settings</Link>
                      </div>
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
