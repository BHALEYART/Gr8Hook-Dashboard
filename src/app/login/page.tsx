import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { isDemo } from "@/lib/env";
import { sendMagicLink, signInWithPassword } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-navy" />}>
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/dashboard";
  const error = typeof sp.error === "string" ? sp.error : null;
  const sent = sp.sent === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo dark />
        </div>
        <div className="rounded-[20px] border border-white/10 bg-panel p-8 shadow-2xl">
          <p className="eyebrow">Client dashboard</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-ink-2">See how your marketing turns into leads, appointments and sales.</p>

          {isDemo && (
            <p className="mt-4 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral-dark">
              Demo mode: any email works. Supabase isn&apos;t connected yet.
            </p>
          )}
          {error && <p className="mt-4 rounded-lg bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">{error}</p>}
          {sent && <p className="mt-4 rounded-lg bg-good/10 px-3 py-2 text-sm text-good" role="status">Check your email for a sign-in link.</p>}

          <form action={signInWithPassword} className="mt-6 flex flex-col gap-4">
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label className="label" htmlFor="email">Email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <input className="input" id="password" name="password" type="password" autoComplete="current-password" />
            </div>
            <button className="btn btn-coral w-full" type="submit">Sign in</button>
            <button className="btn btn-ghost w-full" type="submit" formAction={sendMagicLink} formNoValidate>
              Email me a sign-in link
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-sm text-white/60">
          Need access? Contact <a className="text-white underline" href="mailto:hello@gr8hook.com">hello@gr8hook.com</a>
        </p>
      </div>
    </main>
  );
}
