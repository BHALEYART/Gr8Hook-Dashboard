"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isDemo } from "@/lib/env";

function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}

export async function signInWithPassword(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (isDemo) redirect(next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect(`/login?error=${encodeURIComponent("That email and password didn't match.")}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function sendMagicLink(formData: FormData) {
  const next = safeNext(formData.get("next"));
  if (isDemo) redirect(next);
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await supabase.auth.signInWithOtp({
    email: String(formData.get("email") ?? ""),
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false },
  });
  if (error) redirect(`/login?error=${encodeURIComponent("We couldn't send a link to that email.")}`);
  redirect("/login?sent=1");
}

export async function signOut() {
  if (!isDemo) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
