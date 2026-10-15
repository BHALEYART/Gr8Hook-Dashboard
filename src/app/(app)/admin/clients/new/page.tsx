import type { Metadata } from "next";
import Link from "next/link";
import { ClientFields } from "@/components/ClientFields";
import { DemoNotice, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/data";
import { createClientAction } from "../../actions";

export const metadata: Metadata = { title: "Add client" };

export default async function NewClientPage({ searchParams }: PageProps<"/admin/clients/new">) {
  await requireAdmin();
  const sp = await searchParams;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Add client" />
      {sp.demo === "1" && <DemoNotice />}
      {sp.error && <p className="mb-4 rounded-lg bg-bad/10 px-4 py-3 text-sm text-bad" role="alert">Couldn&apos;t save the client. Check the name and try again.</p>}
      <form action={createClientAction} className="card grid max-w-3xl gap-8 p-6 sm:p-8">
        <ClientFields />
        <fieldset className="grid gap-4">
          <legend className="mb-3 font-display text-base font-bold">Invite the client</legend>
          <div className="field">
            <label className="label" htmlFor="invite_email">Client owner email (optional)</label>
            <input className="input" id="invite_email" name="invite_email" type="email" placeholder="owner@business.com" />
            <span className="text-xs text-ink-3">They&apos;ll get an email to set up their login.</span>
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-coral" type="submit">Create client</button>
          <Link className="btn btn-ghost" href="/admin">Cancel</Link>
        </div>
      </form>
    </>
  );
}
