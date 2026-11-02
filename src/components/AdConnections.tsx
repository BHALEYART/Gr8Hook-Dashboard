import { chooseAdAccountAction, disconnectAdAction } from "@/app/(app)/dashboard/connections/actions";
import type { Connection } from "@/lib/connections";

const INFO = {
  meta: { name: "Facebook & Instagram", button: "Connect Facebook", color: "#1877F2", noun: "ad account",
    help: "Sign in with a Facebook profile that can see the ad account in Business Manager." },
  google: { name: "Google Ads", button: "Connect Google", color: "#4C8DFF", noun: "Ads account",
    help: "Sign in with a Google account that has access to the Ads account, or to the manager account above it." },
} as const;

const RESULT: Record<string, string> = {
  connected: "Connected. Now pick the account below.",
  saved: "Saved. The next nightly sync will pull this account's data.",
  removed: "Disconnected.",
  cancelled: "Sign-in was cancelled. Nothing changed.",
  expired: "The sign-in took too long. Try again.",
  error: "The platform didn't return a token. Try again, or check the app's redirect URL settings.",
  pick: "That account isn't available to this connection. Pick one from the list.",
  setup: "This connection isn't set up yet. Add the app keys in Vercel (see README).",
};

/** Message for ?connect=meta-connected etc. */
export function connectMessage(param: unknown): string | null {
  if (param === "denied") return "Only an admin or the account owner can change connections.";
  if (typeof param !== "string") return null;
  const [platform, result] = param.split("-");
  const p = INFO[platform as keyof typeof INFO];
  return p && RESULT[result] ? `${p.name}: ${RESULT[result]}` : null;
}

export function AdConnections({ clientId, from, connections }: { clientId: string; from: "admin" | "dashboard"; connections: Connection[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {connections.map((c) => {
        const i = INFO[c.platform];
        const hidden = (
          <>
            <input type="hidden" name="client" value={clientId} />
            <input type="hidden" name="platform" value={c.platform} />
            <input type="hidden" name="from" value={from} />
          </>
        );
        return (
          <section key={c.platform} className="card flex min-w-0 flex-col gap-4 p-6" aria-labelledby={`conn-${c.platform}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id={`conn-${c.platform}`} className="flex items-center gap-2 font-display text-base font-bold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} aria-hidden="true" />{i.name}
                </h3>
                <p className="mt-1 text-sm text-ink-2">
                  {c.connected ? <>Connected{c.connectedAs ? <> as <strong>{c.connectedAs}</strong></> : null}.</> : i.help}
                </p>
                {c.connected && c.expiresAt && (
                  <p className={`mt-1 text-xs ${c.expiresSoon ? "font-semibold text-bad" : "text-ink-3"}`}>
                    Sign-in renews by {new Date(c.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}. Reconnect before then to keep syncing.
                  </p>
                )}
              </div>
              <span className={`pill shrink-0 ${c.connected ? "bg-good/15 text-good" : ""}`}>{c.connected ? "Connected" : "Not connected"}</span>
            </div>

            {c.connected && (c.error ? <p className="text-sm text-bad" role="alert">{c.error}</p> : (
              <form action={chooseAdAccountAction} className="grid gap-2">
                {hidden}
                <label className="label" htmlFor={`acct-${c.platform}`}>{i.noun[0].toUpperCase() + i.noun.slice(1)} for this dashboard</label>
                {c.accounts.length === 0 ? (
                  <p className="text-sm text-ink-3">No {i.noun}s are visible to this sign-in.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <select className="input min-w-0 flex-1 basis-56" id={`acct-${c.platform}`} name="account" defaultValue={c.selected} required>
                      <option value="" disabled>Choose an {i.noun}…</option>
                      {c.accounts.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                    <button className="btn btn-navy" type="submit">Use this account</button>
                  </div>
                )}
              </form>
            ))}

            <div className="mt-auto flex flex-wrap gap-2">
              <a className={`btn ${c.connected ? "btn-ghost" : "btn-coral"}`}
                href={`/api/connect/${c.platform}?client=${encodeURIComponent(clientId)}${from === "admin" ? "&from=admin" : ""}`}>
                {c.connected ? "Reconnect" : i.button}
              </a>
              {c.connected && (
                <form action={disconnectAdAction}>
                  {hidden}
                  <button className="btn btn-ghost text-bad" type="submit">Disconnect</button>
                </form>
              )}
            </div>
            {!c.configured && <p className="text-xs text-ink-3">Setup needed: the app keys for this platform aren&apos;t in Vercel yet.</p>}
          </section>
        );
      })}
    </div>
  );
}
