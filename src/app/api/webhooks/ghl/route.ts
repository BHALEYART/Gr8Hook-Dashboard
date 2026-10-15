import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeContact } from "@/lib/integrations/gohighlevel";

// GoHighLevel workflow webhook → near-real-time updates between nightly syncs.
// In GHL, add a Workflow with a "Webhook" action pointing to:
//   https://app.gr8hook.com/api/webhooks/ghl?secret=YOUR_GHL_WEBHOOK_SECRET
// The nightly sync still reconciles everything, so a missed webhook is never lost.
export async function POST(request: NextRequest) {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  if (!secret || request.nextUrl.searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: "bad payload" }, { status: 400 });

  const locationId = (payload.locationId ?? (payload.location as { id?: string } | undefined)?.id) as string | undefined;
  if (!locationId) return NextResponse.json({ ok: true, skipped: "no location" });

  const db = createServiceClient();
  const { data: client } = await db.from("clients").select("id").eq("ghl_location_id", locationId).maybeSingle();
  if (!client) return NextResponse.json({ ok: true, skipped: "unknown location" });

  // Contact created/updated: payload shapes differ by trigger; normalize what's there.
  const contactId = (payload.contact_id ?? payload.contactId ?? payload.id) as string | undefined;
  if (contactId) {
    const c = normalizeContact({
      id: contactId,
      contactName: payload.full_name as string | undefined,
      email: payload.email as string | undefined,
      phone: payload.phone as string | undefined,
      dateAdded: (payload.date_created ?? payload.dateAdded) as string | undefined,
      attributionSource: (payload.attributionSource ?? payload.contact_source) as Record<string, string> | undefined,
    });
    await db.from("leads").upsert({ client_id: client.id, ...c, synced_at: new Date().toISOString() }, { onConflict: "client_id,ghl_contact_id" });
  }

  // TODO: handle opportunity status changes and appointment events the same way once the
  // workflow payloads are confirmed in GHL (send a test webhook and log `payload`).
  return NextResponse.json({ ok: true });
}
