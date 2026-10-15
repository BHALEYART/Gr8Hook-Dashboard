import { Suspense, type ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { getViewer, listClients } from "@/lib/data";
import { isDemo } from "@/lib/env";

// Everything here is per-user, so the shell streams in behind Suspense boundaries.
async function TopBarLoader() {
  const viewer = await getViewer();
  const clients = (await listClients()).filter((c) => c.status === "active");
  return <TopBar email={viewer.email} isAdmin={viewer.isAdmin} clients={clients.map((c) => ({ id: c.id, name: c.name }))} isDemo={isDemo} />;
}

function TopBarSkeleton() {
  return <div className="h-16 border-b border-line bg-bg" aria-hidden="true" />;
}

function PageLoading() {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="h-8 w-64 rounded-lg bg-panel-2" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[20px] bg-panel" />)}
      </div>
      <div className="mt-4 h-96 rounded-[20px] bg-panel" />
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <Suspense fallback={<TopBarSkeleton />}>
        <TopBarLoader />
      </Suspense>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:py-8">
        <Suspense fallback={<PageLoading />}>{children}</Suspense>
      </main>
    </div>
  );
}
