// Emails for the website audit funnel: the branded report sent to the business owner,
// and the alert sent to Gr8 Hook when a promising lead comes in. Inline styles for email clients.
import { concernLabel, SERVICES, type LeadScore, type Recommendation } from "@/lib/audit-leads";
import type { AuditResult, Scores } from "@/lib/site-audit";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const NAVY = "#0F1B2D", CORAL = "#E2431F", SLATE = "#4A5568", MIST = "#EEF0F3", LINE = "#D9DEE5";
const BOOK = "https://calendly.com/admin-gr8hook";
const FOOTER_ADDRESS = () => process.env.MAIL_POSTAL_ADDRESS || "Gr8 Hook Marketing · Michigan";
const color = (n: number | null | undefined) => (n == null ? "#8FA0B6" : n >= 90 ? "#1E8E5A" : n >= 50 ? "#B7791F" : "#C53030");
const word = (n: number | null | undefined) => (n == null ? "Not available" : n >= 90 ? "Good" : n >= 50 ? "Needs work" : "Poor");
const btn = (href: string, label: string, primary = true) =>
  `<a href="${esc(href)}" style="display:inline-block;padding:13px 22px;margin:4px 8px 4px 0;border-radius:999px;font:700 14px Arial,sans-serif;text-decoration:none;${primary ? `background:${CORAL};color:#ffffff;` : `background:#ffffff;color:${NAVY};border:2px solid ${NAVY};`}">${esc(label)}</a>`;

function scoreRow(s: Scores | null) {
  if (!s) return `<p style="margin:0;color:${SLATE};font:14px Arial,sans-serif;">Google's speed test didn't finish for this device.</p>`;
  const cells = ([["Performance", s.performance], ["Accessibility", s.accessibility], ["SEO", s.seo], ["Best practices", s.bestPractices]] as const)
    .map(([label, n]) => `<td width="25%" align="center" style="padding:14px 4px;background:#ffffff;border:1px solid ${LINE};border-radius:10px;">
      <div style="font:800 30px Arial,sans-serif;color:${color(n)};">${n ?? "–"}</div>
      <div style="font:700 12px Arial,sans-serif;color:${NAVY};margin-top:4px;">${label}</div>
      <div style="font:12px Arial,sans-serif;color:${color(n)};">${word(n)}</div></td>`).join('<td width="8"></td>');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${cells}</tr></table>`;
}

export function reportEmail(opts: { name: string; business: string; concern: string; audit: AuditResult; recs: Recommendation[]; lead: LeadScore }) {
  const { audit, recs, lead } = opts;
  const site = host(audit.finalUrl || audit.url);
  const first = opts.name.split(/\s+/)[0];
  const date = new Date(audit.fetchedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Detroit" });
  const primary = SERVICES[lead.services[0]];
  const quote = `https://gr8hook.com/contact/?service=${lead.services[0]}#quote`;
  const passes = audit.checks.filter((c) => c.status === "pass").map((c) => c.title);
  const top = recs.slice(0, 6);
  const P = (t: string, extra = "") => `<p style="margin:0 0 14px;font:15px/1.6 Arial,sans-serif;color:${SLATE};${extra}">${t}</p>`;
  const H = (t: string) => `<h2 style="margin:30px 0 12px;font:800 18px Arial,sans-serif;color:${NAVY};text-transform:uppercase;letter-spacing:.02em;">${t}</h2>`;

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${MIST};">
<div style="display:none;max-height:0;overflow:hidden;">Your website assessment for ${esc(site)}: scores, top priorities and next steps.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${MIST};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%;">
  <tr><td style="background:${NAVY};padding:22px 28px;border-radius:16px 16px 0 0;">
    <span style="font:800 22px Arial,sans-serif;color:#ffffff;">Gr<span style="color:#FF5A36;">8</span> Hook</span>
    <span style="float:right;font:700 11px Arial,sans-serif;letter-spacing:.2em;color:#FF5A36;line-height:26px;">WEBSITE ASSESSMENT</span>
  </td></tr>
  <tr><td style="background:#ffffff;padding:30px 28px;">
    <h1 style="margin:0 0 10px;font:800 26px/1.2 Arial,sans-serif;color:${NAVY};">Your full report for ${esc(site)}</h1>
    ${P(`Hi ${esc(first)}, thanks for running the Gr8 Hook website audit for ${esc(opts.business)}. Here's what we found on ${date}, what it means for your business, and where we'd start.`)}
    ${opts.concern !== "other" ? P(`You told us your biggest concern is: <strong style="color:${NAVY};">&ldquo;${esc(concernLabel(opts.concern))}.&rdquo;</strong> We've kept that in mind below.`) : ""}
    ${H("Mobile scores")}${scoreRow(audit.mobile)}
    ${H("Desktop scores")}${scoreRow(audit.desktop)}
    ${audit.metrics.length ? `${H("Mobile speed")}<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${audit.metrics.map((m) =>
      `<tr><td style="padding:8px 0;border-bottom:1px solid ${LINE};font:14px Arial,sans-serif;color:${SLATE};">${esc(m.label)}</td><td align="right" style="padding:8px 0;border-bottom:1px solid ${LINE};font:700 14px Arial,sans-serif;color:${m.status === "pass" ? "#1E8E5A" : m.status === "warn" ? "#B7791F" : "#C53030"};">${esc(m.value)}</td></tr>`).join("")}</table>` : ""}
    ${H("Your top priorities")}
    ${top.length ? top.map((r, i) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 12px;background:${MIST};border-radius:12px;"><tr><td style="padding:16px 18px;">
      <div style="font:700 16px Arial,sans-serif;color:${NAVY};">${i + 1}. ${esc(r.title)} ${r.priority === "high" ? `<span style="font:700 11px Arial,sans-serif;color:#C53030;letter-spacing:.06em;">HIGH PRIORITY</span>` : ""}</div>
      <div style="font:14px/1.55 Arial,sans-serif;color:${SLATE};margin-top:6px;"><strong style="color:${NAVY};">Why it matters:</strong> ${esc(r.why)}</div>
      <div style="font:14px/1.55 Arial,sans-serif;color:${SLATE};margin-top:4px;"><strong style="color:${NAVY};">How to fix it:</strong> ${esc(r.fix)}</div>
      <div style="font:13px Arial,sans-serif;color:${SLATE};margin-top:6px;">We can help with this through <a href="${SERVICES[r.service].url}" style="color:${CORAL};">${esc(SERVICES[r.service].name)}</a>.</div>
    </td></tr></table>`).join("") : P("We didn't find any major issues. Nice work!")}
    ${passes.length ? `${H("What's working")}${P(passes.map(esc).join(" · "))}` : ""}
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:26px;background:${NAVY};border-radius:14px;"><tr><td style="padding:24px;">
      <div style="font:700 11px Arial,sans-serif;letter-spacing:.2em;color:#FF5A36;">OUR RECOMMENDATION</div>
      <div style="font:800 20px Arial,sans-serif;color:#ffffff;margin:8px 0;">${esc(primary.name)}</div>
      <p style="margin:0 0 16px;font:15px/1.6 Arial,sans-serif;color:#D5DCE6;">${esc(primary.pitch)} Every client gets a dedicated account manager, and we set everything up for you.</p>
      ${btn(BOOK, "Book a free call to review your results")}
      <a href="${esc(quote)}" style="display:inline-block;padding:13px 22px;margin:4px 0;border-radius:999px;font:700 14px Arial,sans-serif;text-decoration:none;color:#ffffff;border:2px solid #ffffff;">Get a custom quote</a>
    </td></tr></table>
    ${P("Want us to walk you through it? Just reply to this email.", "margin-top:22px;")}
    <p style="margin:18px 0 0;font:12px/1.5 Arial,sans-serif;color:#8A94A6;">Scores come from Google Lighthouse and can vary a little each time it runs. Automated checks can't see everything, such as search rankings, conversion rates or forms that load later.</p>
  </td></tr>
  <tr><td style="padding:18px 28px;font:12px/1.5 Arial,sans-serif;color:#6B7689;" align="center">
    You're receiving this because you requested a website report at gr8hook.com/audit. Don't want emails from us? Reply "unsubscribe."<br>${esc(FOOTER_ADDRESS())} · <a href="https://gr8hook.com/privacy/" style="color:#6B7689;">Privacy Policy</a>
  </td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    `Your full website report for ${site}`, "",
    `Hi ${first}, here's what we found on ${date}.`, "",
    audit.mobile ? `Mobile: Performance ${audit.mobile.performance}, Accessibility ${audit.mobile.accessibility}, SEO ${audit.mobile.seo}, Best practices ${audit.mobile.bestPractices}` : "",
    audit.desktop ? `Desktop: Performance ${audit.desktop.performance}, Accessibility ${audit.desktop.accessibility}, SEO ${audit.desktop.seo}, Best practices ${audit.desktop.bestPractices}` : "", "",
    "Top priorities:", ...top.map((r, i) => `${i + 1}. ${r.title}\n   Why: ${r.why}\n   Fix: ${r.fix}`), "",
    `Our recommendation: ${primary.name}. ${primary.pitch}`,
    `Book a free call: ${BOOK}`, `Get a custom quote: ${quote}`, "",
    `You requested this report at gr8hook.com/audit. Reply "unsubscribe" to stop emails. ${FOOTER_ADDRESS()}`,
  ].filter((l) => l !== undefined).join("\n");

  return { subject: `Your website report for ${site}`, html, text };
}

export function alertEmail(opts: { name: string; business: string; email: string; phone?: string | null; concern: string; concernDetail?: string | null;
  audit: AuditResult; recs: Recommendation[]; lead: LeadScore; leadUrl: string | null; marketingOptIn: boolean }) {
  const { audit, lead } = opts;
  const site = audit.finalUrl || audit.url;
  const tier = lead.tier[0].toUpperCase() + lead.tier.slice(1);
  const rows: [string, string][] = [
    ["Business", opts.business], ["Contact", `${opts.name} · ${opts.email}${opts.phone ? ` · ${opts.phone}` : ""}`], ["Website", site],
    ["Biggest concern", concernLabel(opts.concern) + (opts.concernDetail ? ` (${opts.concernDetail})` : "")],
    ["Lead score", `${tier} (${lead.score})`], ["Why", lead.reasons.join(" · ") || "—"],
    ["Pitch", lead.services.map((s) => SERVICES[s].name).join(", ")],
    ["Mobile scores", audit.mobile ? `Perf ${audit.mobile.performance} · A11y ${audit.mobile.accessibility} · SEO ${audit.mobile.seo} · BP ${audit.mobile.bestPractices}` : "n/a"],
    ["Top issues", opts.recs.slice(0, 5).map((r) => r.title).join(" · ") || "None"],
    ["Marketing emails", opts.marketingOptIn ? "Opted in" : "Not opted in"],
  ];
  const html = `<div style="font:15px/1.5 Arial,sans-serif;color:${NAVY};">
    <h2 style="margin:0 0 12px;">${esc(tier)} lead from the website audit</h2>
    <table cellpadding="6" style="border-collapse:collapse;">${rows.map(([k, v]) => `<tr><td style="color:${SLATE};vertical-align:top;white-space:nowrap;">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`).join("")}</table>
    ${opts.leadUrl ? `<p>${btn(opts.leadUrl, "Open in dashboard")}</p>` : ""}
    <p style="color:${SLATE};font-size:13px;">The prospect was emailed their report automatically. Reply to them directly from ${esc(opts.email)}.</p></div>`;
  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n") + (opts.leadUrl ? `\n\nOpen: ${opts.leadUrl}` : "");
  return { subject: `${tier} lead: ${opts.business} (${host(site)})`, html, text };
}
