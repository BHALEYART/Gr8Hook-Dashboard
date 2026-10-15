import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientFields } from "@/components/ClientFields";
import { DemoNotice, Notice, PageHeader, PlatformBadge } from "@/components/ui";
import { getClient, getMappings, getServices, requireAdmin } from "@/lib/data";
import { addAnnotationAction, inviteUserAction, saveMappingsAction, setStatusAction, updateClientAction } from "../../actions";

export const metadata: Metadata = { title: "Client settings" };

export default async function ClientSettingsPage({ params, searchParams }: PageProps<"/admin/clients/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const client = await getClient(id);
  if (!client) notFound();
  const [services, mappings] = await Promise.all([getServices(id), getMappings(id)]);

  return (
    <>
      <PageHeader eyebrow="Client settings" title={client.name}>
        <Link className="btn btn-ghost" href={`/dashboard?client=${id}`}>View dashboard</Link>
      </PageHeader>
      {sp.demo === "1" && <DemoNotice />}
      {sp.saved === "1" && <Notice>Saved.</Notice>}
      {sp.created === "1" && <Notice>Client created. The first data sync runs tonight.</Notice>}
      {sp.invited === "1" && <Notice>Invite sent.</Notice>}

      <div className="grid max-w-4xl gap-6">
        <form action={updateClientAction} className="card grid gap-8 p-6 sm:p-8">
          <input type="hidden" name="id" value={id} />
          <ClientFields client={client} services={services} />
          <div><button className="btn btn-coral" type="submit">Save settings</button></div>
        </form>

        <section id="mappings" className="card p-6 sm:p-8" aria-labelledby="map-title">
          <h2 id="map-title" className="font-display text-lg font-bold">Campaign → product pairing</h2>
          <p className="mt-1 text-sm text-ink-2">Tell the dashboard which product or service each campaign is selling, so revenue can be paired with the right campaign.</p>
          {mappings.length === 0 ? (
            <p className="mt-4 text-sm text-ink-3">Campaigns appear here after the first ad sync.</p>
          ) : (
            <form action={saveMappingsAction} className="mt-5 grid gap-3">
              <input type="hidden" name="id" value={id} />
              {mappings.map((m) => (
                <div key={m.id} className="grid items-center gap-2 sm:grid-cols-[1fr_260px]">
                  <label htmlFor={`map_${m.id}`} className="flex items-center gap-2 text-sm font-semibold">
                    <PlatformBadge platform={m.platform} /> {m.name}
                  </label>
                  <input className="input" id={`map_${m.id}`} name={`map_${m.id}`} defaultValue={m.service} placeholder="e.g. Roof Repair" />
                </div>
              ))}
              <div className="mt-2"><button className="btn btn-navy" type="submit">Save pairings</button></div>
            </form>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section id="notes" className="card p-6" aria-labelledby="notes-title">
            <h2 id="notes-title" className="font-display text-lg font-bold">Add a chart note</h2>
            <p className="mt-1 text-sm text-ink-2">Notes show under the client&apos;s chart, so they can see why numbers moved.</p>
            <form action={addAnnotationAction} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={id} />
              <div className="field">
                <label className="label" htmlFor="date">Date</label>
                <input className="input" id="date" name="date" type="date" required />
              </div>
              <div className="field">
                <label className="label" htmlFor="note">Note</label>
                <input className="input" id="note" name="note" placeholder="Launched spring offer" required />
              </div>
              <div><button className="btn btn-navy" type="submit">Add note</button></div>
            </form>
          </section>

          <section id="users" className="card p-6" aria-labelledby="users-title">
            <h2 id="users-title" className="font-display text-lg font-bold">Invite a user</h2>
            <p className="mt-1 text-sm text-ink-2">They&apos;ll only see this client&apos;s data.</p>
            <form action={inviteUserAction} className="mt-4 grid gap-3">
              <input type="hidden" name="id" value={id} />
              <div className="field">
                <label className="label" htmlFor="invite">Email</label>
                <input className="input" id="invite" name="email" type="email" required />
              </div>
              <div className="field">
                <label className="label" htmlFor="role">Role</label>
                <select className="input" id="role" name="role" defaultValue="client_staff">
                  <option value="client_owner">Owner</option>
                  <option value="client_staff">Staff</option>
                </select>
              </div>
              <div><button className="btn btn-navy" type="submit">Send invite</button></div>
            </form>
          </section>
        </div>

        <section className="card border-bad/30 p-6" aria-labelledby="status-title">
          <h2 id="status-title" className="font-display text-lg font-bold">Client status</h2>
          <p className="mt-1 text-sm text-ink-2">
            {client.status === "active"
              ? "Deactivating stops nightly syncs. History is kept, so you can reactivate later."
              : "This client is inactive. Syncs are paused."}
          </p>
          <form action={setStatusAction} className="mt-4">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="status" value={client.status === "active" ? "inactive" : "active"} />
            <button className={`btn ${client.status === "active" ? "btn-ghost text-bad" : "btn-coral"}`} type="submit">
              {client.status === "active" ? "Deactivate client" : "Reactivate client"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
