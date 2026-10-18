"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { signOut } from "@/app/login/actions";
import { usePrefs } from "@/lib/prefs";

interface Props {
  email: string;
  isAdmin: boolean;
  clients: { id: string; name: string }[];
  isDemo: boolean;
}

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/campaigns", label: "Campaigns" },
  { href: "/dashboard/leads", label: "Leads & Sales" },
];

function Svg({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICON = {
  sun: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  bento: "M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z",
  focus: "M3 3h13v18H3zM18 3h3v8h-3zM18 13h3v8h-3z",
  chevron: "M6 9l6 6 6-6",
};

export function TopBar({ email, isAdmin, clients, isDemo }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { theme, layout, setTheme, setLayout } = usePrefs();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const clientId = params.get("client") ?? clients[0]?.id ?? "";
  const keep = (href: string) => {
    const q = new URLSearchParams();
    if (clientId) q.set("client", clientId);
    const months = params.get("months");
    if (months) q.set("months", months);
    const s = q.toString();
    return s ? `${href}?${s}` : href;
  };
  const onOverview = pathname === "/dashboard";
  const inAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [menuOpen]);

  const tab = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-11 shrink-0 items-center px-3 text-sm font-semibold transition ${active ? "text-ink" : "text-ink-3 hover:text-ink"}`}
    >
      {label}
      {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-coral" aria-hidden="true" />}
    </Link>
  );

  const iconBtn = "flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 transition hover:bg-panel-2 hover:text-ink";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-4 px-4 sm:px-6">
        <a href="https://gr8hook.com" aria-label="Gr8 Hook website" className="rounded-lg"><Logo /></a>

        <nav aria-label="Dashboard" className="ml-4 hidden h-16 items-stretch md:flex">
          {TABS.map((t) => tab(keep(t.href), t.label, pathname === t.href))}
          {isAdmin && tab("/admin", "Admin", inAdmin)}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          {clients.length > 1 && (
            <div className="relative hidden sm:block">
              <label htmlFor="client-switch" className="sr-only">Viewing client</label>
              <select
                id="client-switch"
                value={clientId}
                onChange={(e) => router.push(`${inAdmin ? "/dashboard" : pathname}?client=${e.target.value}`)}
                className="h-10 max-w-[240px] appearance-none truncate rounded-xl border border-line bg-panel pl-3 pr-9 text-sm font-semibold text-ink"
              >
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"><Svg d={ICON.chevron} size={16} /></span>
            </div>
          )}

          {onOverview && (
            <div className="hidden items-center rounded-xl border border-line p-0.5 lg:flex" role="group" aria-label="Panel layout">
              {(["bento", "focus"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayout(l)}
                  aria-pressed={layout === l}
                  title={l === "bento" ? "Grid layout" : "Focus layout"}
                  className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${layout === l ? "bg-panel-2 text-coral" : "text-ink-3 hover:text-ink"}`}
                >
                  <Svg d={ICON[l]} />
                  <span className="sr-only">{l === "bento" ? "Grid layout" : "Focus layout"}</span>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className={iconBtn}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            <Svg d={theme === "dark" ? ICON.sun : ICON.moon} />
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-coral font-display text-sm font-bold uppercase text-white"
            >
              {email.slice(0, 1) || "G"}
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
                <div className="border-b border-line px-4 py-3">
                  <p className="truncate text-sm font-semibold">{email}</p>
                  {isDemo && <p className="mt-1 text-xs font-semibold text-coral">Demo mode · sample data</p>}
                </div>
                {isAdmin && (
                  <div className="border-b border-line py-1">
                    <Link role="menuitem" href="/admin" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center px-4 text-sm hover:bg-panel-2">All clients</Link>
                    <Link role="menuitem" href="/admin/clients/new" onClick={() => setMenuOpen(false)} className="flex min-h-11 items-center px-4 text-sm hover:bg-panel-2">Add client</Link>
                  </div>
                )}
                <form action={signOut} className="py-1">
                  <button role="menuitem" type="submit" className="flex min-h-11 w-full items-center px-4 text-left text-sm hover:bg-panel-2">Sign out</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: tabs + client switcher on a second row */}
      <div className="flex items-center gap-2 overflow-x-auto border-t border-line px-2 md:hidden">
        <nav aria-label="Dashboard (mobile)" className="flex items-stretch">
          {TABS.map((t) => tab(keep(t.href), t.label, pathname === t.href))}
          {isAdmin && tab("/admin", "Admin", inAdmin)}
        </nav>
      </div>
      {clients.length > 1 && (
        <div className="border-t border-line px-4 py-2 sm:hidden">
          <label htmlFor="client-switch-m" className="sr-only">Viewing client</label>
          <select
            id="client-switch-m"
            value={clientId}
            onChange={(e) => router.push(`${inAdmin ? "/dashboard" : pathname}?client=${e.target.value}`)}
            className="h-10 w-full rounded-xl border border-line bg-panel px-3 text-sm font-semibold text-ink"
          >
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
    </header>
  );
}
