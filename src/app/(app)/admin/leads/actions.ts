"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/data";
import { isDemo } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

export async function updateLeadAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (isDemo) redirect(`/admin/leads/${id}?demo=1`);
  const status = String(formData.get("status") ?? "");
  const notes = String(formData.get("notes") ?? "").slice(0, 5000);
  const supabase = await createClient();
  await supabase.from("audit_leads").update({ status: STATUSES.includes(status) ? status : "new", notes: notes || null }).eq("id", id);
  revalidatePath("/admin/leads");
  redirect(`/admin/leads/${id}?saved=1`);
}
