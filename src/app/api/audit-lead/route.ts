import { NextResponse, type NextRequest } from "next/server";
import { alertEmail, reportEmail } from "@/lib/audit-email";
import { CONCERNS, recommendations, scoreLead } from "@/lib/audit-leads";
import { verifyAudit, verifySpeed } from "@/lib/audit-sign";
import { mergeAudit } from "@/lib/site-audit";
import { emailConfigured, sendEmail } from "@/lib/email";
import { allowOrigin, clientIp, cors, rateLimited } from "@/lib/public-api";
import { createServiceClient } from "@/lib/supabase/server";

// "Get my full report" on gr8hook.com/audit: saves the lead, emails the owner their report,
// and alerts Gr8 Hook about promising prospects. If nothing is configured yet, the page falls back to FormSubmit.
export const maxDuration = 30;

const CONSENT_TEXT = "Requested a website report by email at gr8hook.com/audit.";
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const dbConfigured = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);

export function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { status: 204, headers: cors(request.headers.get("origin")) });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const headers = cors(origin);
  if (!allowOrigin(origin)) return NextResponse.json({ error: "Not allowed." }, { status: 403, headers });
  if (rateLimited(`lead:${clientIp(request)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later or email Sales@Gr8Hook.com." }, { status: 429, headers });
  }

  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (str(b.fax, 50)) return NextResponse.json({ ok: true, emailed: false }, { headers }); // honeypot: quietly ignore bots
  const lead = {
    name: str(b.name, 100), business: str(b.business, 150), email: str(b.email, 200).toLowerCase(), phone: str(b.phone, 40) || null,
    concern: str(b.concern, 40), concernDetail: str(b.concernDetail, 1000) || null, marketingOptIn: b.marketingOptIn === true,
  };
  if (!lead.name || !lead.business || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lead.email) || !CONCERNS.some((c) => c.key === lead.concern)) {
    return NextResponse.json({ error: "Please fill in your name, business, a valid email and your biggest concern." }, { status: 400, headers });
  }
  const base = verifyAudit(b.signed, b.sig);
  const speed = (b.speed && typeof b.speed === "object" ? b.speed : {}) as Record<string, unknown>;
  const hostOf = (u: string) => { try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, ""); } catch { return ""; } };
  const sameSite = (r: ReturnType<typeof verifySpeed>) => (r && base && hostOf(r.url) === hostOf(base.url) ? r : null);
  const audit = base ? mergeAudit(base, sameSite(verifySpeed(speed.mobile)), sameSite(verifySpeed(speed.desktop))) : null;
  if (!audit) return NextResponse.json({ error: "Your results have expired. Please run the audit again.", fallback: true }, { status: 400, headers });

  const recs = recommendations(audit);
  const score = scoreLead(audit, lead);
  const src = (b.source && typeof b.source === "object" ? b.source : {}) as Record<string, unknown>;
  const utm = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].map((k) => [k, str(src[k], 200)]).filter(([, v]) => v));

  // 1. Save the lead
  let leadId: string | null = null;
  if (dbConfigured()) {
    const db = createServiceClient();
    const { data, error } = await db.from("audit_leads").insert({
      name: lead.name, business: lead.business, email: lead.email, phone: lead.phone, concern: lead.concern, concern_detail: lead.concernDetail,
      website: audit.finalUrl || audit.url, audited_at: audit.fetchedAt, scores: { mobile: audit.mobile, desktop: audit.desktop },
      issues: [
        ...audit.checks.filter((c) => c.status === "fail" || c.status === "warn").map(({ title, detail, status, group }) => ({ title, detail, status, group })),
        ...audit.lighthouseIssues.map((i) => ({ title: i.title, status: i.status, group: i.category })),
      ],
      recommendations: recs, audit, lead_score: score.score, lead_tier: score.tier, suggested_services: score.services, score_reasons: score.reasons,
      source: str(src.source, 60) || "website-audit", referrer: str(src.referrer, 500) || null, utm,
      consent_report: true, consent_marketing: lead.marketingOptIn, consent_text: CONSENT_TEXT,
    }).select("id").single();
    if (error) console.error("audit_leads insert failed", error.message);
    leadId = (data?.id as string | undefined) ?? null;
  }

  // 2. Email the owner their report
  let emailed = false;
  if (emailConfigured()) {
    try {
      await sendEmail({ to: lead.email, ...reportEmail({ name: lead.name, business: lead.business, concern: lead.concern, audit, recs, lead: score }) });
      emailed = true;
    } catch (e) { console.error("report email failed", e); }
  }

  // 3. Alert Gr8 Hook: always for hot leads, and for every lead when it isn't being saved to the database
  let alerted = false;
  if (emailConfigured() && (score.tier === "hot" || !leadId || process.env.AUDIT_NOTIFY_ALL === "true")) {
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://app.gr8hook.com";
    try {
      await sendEmail({
        to: (process.env.AUDIT_NOTIFY_EMAIL || "Admin@gr8hook.com").split(",").map((s) => s.trim()),
        replyTo: lead.email,
        ...alertEmail({ ...lead, audit, recs, lead: score, leadUrl: leadId ? `${site}/admin/leads/${leadId}` : null }),
      });
      alerted = true;
    } catch (e) { console.error("lead alert failed", e); }
  }

  if (leadId && (emailed || alerted)) {
    await createServiceClient().from("audit_leads").update({
      report_emailed_at: emailed ? new Date().toISOString() : null, alerted_at: alerted ? new Date().toISOString() : null,
    }).eq("id", leadId);
  }

  // Not saved and nobody was told about it: let the page send it another way so the lead isn't lost.
  if (!leadId && !alerted) return NextResponse.json({ error: "Lead capture isn't set up yet.", fallback: true, emailed }, { status: 503, headers });
  return NextResponse.json({ ok: true, emailed }, { headers });
}
