import type { Metadata } from "next";
import { AdConnections, connectMessage } from "@/components/AdConnections";
import { DemoNotice, Empty, Notice, PageHeader } from "@/components/ui";
import { getConnections } from "@/lib/connections";
import { canManageClient, getViewer, resolveClient } from "@/lib/data";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage({ searchParams }: PageProps<"/dashboard/connections">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const client = await resolveClient(viewer, typeof sp.client === "string" ? sp.client : undefined);
  if (!client) return <Empty title="No client yet" />;
  if (!(await canManageClient(viewer, client.id))) {
    return <Empty title="Ask the account owner">Only the account owner (or Gr8 Hook) can connect ad accounts.</Empty>;
  }
  const message = connectMessage(sp.connect);
  return (
    <>
      <PageHeader eyebrow={client.name} title="Connections" />
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-ink-2">
        Connect your ad accounts so the dashboard can read spend and results. It&apos;s read-only: the dashboard can&apos;t change your ads or budgets.
      </p>
      {sp.demo === "1" && <DemoNotice />}
      {message && <Notice>{message}</Notice>}
      <AdConnections clientId={client.id} from="dashboard" connections={await getConnections(client)} />
    </>
  );
}
