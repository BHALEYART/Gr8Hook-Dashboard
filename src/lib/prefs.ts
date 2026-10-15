"use client";

import { useCallback, useEffect, useState } from "react";

// Theme and layout preferences live on <html data-theme / data-layout> and in localStorage.
// Components subscribe through this hook so charts can recolor when the theme flips.

export type Theme = "dark" | "light";
export type Layout = "bento" | "focus";
const EVENT = "g8-prefs";

function read(): { theme: Theme; layout: Layout } {
  if (typeof document === "undefined") return { theme: "dark", layout: "bento" };
  const d = document.documentElement.dataset;
  return { theme: d.theme === "light" ? "light" : "dark", layout: d.layout === "focus" ? "focus" : "bento" };
}

export function usePrefs() {
  const [prefs, setPrefs] = useState<{ theme: Theme; layout: Layout }>({ theme: "dark", layout: "bento" });

  useEffect(() => {
    const sync = () => setPrefs(read());
    sync();
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);

  const set = useCallback((key: "theme" | "layout", value: string, fallback: string) => {
    const d = document.documentElement;
    if (value === fallback) delete d.dataset[key];
    else d.dataset[key] = value;
    try { localStorage.setItem(`g8-${key}`, value); } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return {
    ...prefs,
    setTheme: (t: Theme) => set("theme", t, "dark"),
    setLayout: (l: Layout) => set("layout", l, "bento"),
  };
}
