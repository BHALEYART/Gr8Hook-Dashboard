import type { Metadata } from "next";
import { Overview } from "@/components/Overview";
import { Empty, RangeTabs, parseMonths } from "@/components/ui";
import { getDashboard, getViewer, resolveClient } from "@/lib/data";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const viewer = await getViewer();
  const client = await resolveClient(viewer, typeof sp.client === "string" ? sp.client : undefined);
  if (!client) {
    return <Empty title="No client yet">Your account isn&apos;t linked to a client. Contact Gr8 Hook to get set up.</Empty>;
  }
  const months = parseMonths(sp.months);
  const data = await getDashboard(client.id, months);

  return (
    <Overview
      key={`${client.id}-${months}`}
      client={{ id: client.id, name: client.name, primary_goal: client.primary_goal, show_reach: client.show_reach, lead_label: client.lead_label }}
      monthsBack={months}
      {...data}
      rangeTabs={<RangeTabs base="/dashboard" clientId={client.id} months={months} />}
    />
  );
}
