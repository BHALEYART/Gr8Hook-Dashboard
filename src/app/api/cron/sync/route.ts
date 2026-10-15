import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { syncClient } from "@/lib/sync";
import type { Client } from "@/lib/types";

export const maxDuration = 300; // seconds; raise on Vercel Pro if syncs grow

// Vercel Cron calls this nightly (see vercel.json) with `Authorization: Bearer $CRON_SECRET`.
// Optional query params: ?client=<id> to sync one client, &backfill=1 for a 400-day pull.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const only = request.nextUrl.searchParams.get("client");
  const backfill = request.nextUrl.searchParams.get("backfill") === "1";

  let query = db.from("clients").select("*").eq("status", "active");
  if (only) query = query.eq("id", only);
  const { data: clients, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const report: Record<string, Record<string, string>> = {};
  for (const client of (clients ?? []) as Client[]) {
    report[client.name] = await syncClient(db, client, { backfill });
  }
  return NextResponse.json({ ok: true, report });
}
