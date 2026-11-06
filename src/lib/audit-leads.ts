// Turns an audit + the owner's answers into recommendations, a lead score and the service to pitch.
import type { AuditResult, Check, Status } from "@/lib/site-audit";

export const CONCERNS = [
  { key: "more_customers", label: "Not getting enough leads or customers" },
  { key: "ads_roi", label: "Our ads aren't paying off" },
  { key: "unknown_results", label: "Not sure what's working" },
  { key: "follow_up", label: "Leads aren't turning into sales" },
  { key: "google", label: "Not showing up on Google" },
  { key: "website", label: "Website is slow or outdated" },
  { key: "other", label: "Something else" },
] as const;
export type ConcernKey = (typeof CONCERNS)[number]["key"];
export const concernLabel = (k: string) => CONCERNS.find((c) => c.key === k)?.label ?? k;

export type ServiceKey = "marketing" | "sales" | "analytics" | "web" | "crm";
export const SERVICES: Record<ServiceKey, { name: string; url: string; pitch: string }> = {
  marketing: { name: "Marketing & Ads", url: "https://gr8hook.com/marketing/", pitch: "Meta and Google ads with attribution, so you can see which ads bring in customers." },
  sales: { name: "Sales & Lead Generation", url: "https://gr8hook.com/sales/", pitch: "A dedicated sales team that follows up with and qualifies your leads." },
  analytics: { name: "Analytics & Attribution", url: "https://gr8hook.com/analytics/", pitch: "Tracking across ads, email, forms, calls and print, fed back into your marketing." },
  web: { name: "Web Design & SEO", url: "https://gr8hook.com/services/#web-seo", pitch: "A fast, search-ready website built to turn visitors into leads." },
  crm: { name: "CRM & Automation", url: "https://gr8hook.com/services/#crm", pitch: "Automatic follow-up, booking and reminders so no lead slips through." },
};

export interface Recommendation { title: string; why: string; fix: string; service: ServiceKey; priority: "high" | "medium" | "low" }

const REC: Record<string, Omit<Recommendation, "priority"> & { priority?: Recommendation["priority"] }> = {
  https: { title: "Secure your site with HTTPS", why: "Browsers label the site \"Not secure,\" which drives visitors away and hurts rankings.", fix: "Install an SSL certificate and redirect every page to https.", service: "web", priority: "high" },
  title: { title: "Write a stronger page title", why: "The title is the headline people see in Google before they click.", fix: "Lead with your main service and city, around 30–60 characters.", service: "web" },
  description: { title: "Add a compelling page description", why: "It's the sales pitch under your link in search results.", fix: "Write 120–160 characters with your service, location and a reason to click.", service: "web" },
  h1: { title: "Add a clear main heading", why: "Visitors decide in seconds whether they're in the right place.", fix: "Put one H1 at the top that says exactly what you do and for whom.", service: "web" },
  viewport: { title: "Make the site mobile-friendly", why: "Most local searches happen on phones, and Google ranks mobile-friendly sites higher.", fix: "Add a responsive layout and mobile viewport.", service: "web", priority: "high" },
  social: { title: "Set up social sharing previews", why: "Shared links without a preview get fewer clicks.", fix: "Add Open Graph tags with a title, description and image.", service: "web", priority: "low" },
  schema: { title: "Add structured data", why: "It helps Google and AI assistants understand and recommend your business.", fix: "Add LocalBusiness or ProfessionalService schema with hours, services and area served.", service: "web", priority: "low" },
  sitemap: { title: "Publish a sitemap", why: "It helps Google find and index every important page.", fix: "Generate sitemap.xml, list it in robots.txt and submit it in Search Console.", service: "web", priority: "low" },
  call: { title: "Add a click-to-call button", why: "On phones, one tap to call is often the fastest path to a booked customer.", fix: "Put a tappable phone number in the header and near every call to action.", service: "web" },
  booking: { title: "Let customers book online", why: "People who can schedule on the spot are less likely to shop around.", fix: "Connect an online booking calendar with automatic reminders.", service: "crm", priority: "low" },
  form: { title: "Add a short lead form", why: "Not everyone is ready to call. A form captures them before they leave.", fix: "Add a 3–4 field form that goes straight into a CRM with instant follow-up.", service: "crm", priority: "high" },
  ga: { title: "Install Google Analytics", why: "Without it, you can't see where visitors come from or what they do.", fix: "Install Google Analytics 4 with conversion events for calls, forms and bookings.", service: "analytics", priority: "high" },
  pixel: { title: "Install the Meta Pixel", why: "Facebook and Instagram ads can't optimize for real customers without it.", fix: "Install the Pixel and Conversions API with Lead and Purchase events.", service: "analytics" },
};

const isIssue = (s: Status) => s === "fail" || s === "warn";

export function recommendations(audit: AuditResult): Recommendation[] {
  const recs: Recommendation[] = [];
  const perf = audit.mobile?.performance ?? null;
  const speed = audit.lighthouseIssues.filter((i) => i.category === "Speed").map((i) => i.title);
  if ((perf !== null && perf < 90) || speed.length) {
    recs.push({
      title: "Speed up your mobile site",
      why: `${perf !== null ? `Your mobile speed score is ${perf}/100. ` : ""}Slow pages lose visitors before they ever see your offer, and Google favors fast sites.`,
      fix: speed.length ? `Start with: ${speed.slice(0, 4).join("; ")}.` : "Compress images, remove unused code and add caching.",
      service: "web", priority: perf !== null && perf < 50 ? "high" : "medium",
    });
  }
  const a11y = audit.lighthouseIssues.filter((i) => i.category === "Accessibility").map((i) => i.title);
  if (a11y.length) recs.push({ title: "Fix accessibility issues", why: "Every visitor should be able to use your site, and accessible sites tend to rank and convert better.", fix: `Start with: ${a11y.slice(0, 3).join("; ")}.`, service: "web", priority: "medium" });
  const bp = audit.lighthouseIssues.filter((i) => i.category === "Best practices").map((i) => i.title);
  if (bp.length) recs.push({ title: "Fix behind-the-scenes problems", why: "Browser errors and outdated features can break parts of the site and hurt trust and rankings.", fix: `Start with: ${bp.slice(0, 3).join("; ")}.`, service: "web", priority: "medium" });
  const seo = audit.lighthouseIssues.filter((i) => i.category === "SEO").map((i) => i.title);
  if (seo.length) recs.push({ title: "Clean up search engine issues", why: "Small technical problems make it harder for Google to understand and rank your pages.", fix: `Start with: ${seo.slice(0, 3).join("; ")}.`, service: "web", priority: "medium" });
  for (const c of audit.checks) {
    const r = REC[c.id];
    if (!r) continue;
    if (isIssue(c.status) || (c.status === "info" && (c.id === "booking" || c.id === "pixel"))) {
      recs.push({ ...r, priority: r.priority ?? (c.status === "fail" ? "high" : "medium") });
    }
  }
  const order = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority] - order[b.priority]);
}

const FREE_MAIL = /@(gmail|yahoo|hotmail|outlook|live|aol|icloud|me|msn|proton|protonmail|gmx|mail|ymail|comcast)\./i;

export interface LeadInput { email: string; phone?: string | null; concern: string }
export interface LeadScore { score: number; tier: "hot" | "warm" | "cool"; services: ServiceKey[]; reasons: string[] }

/** A rough fit score: how much the findings and the owner's concern line up with what Gr8 Hook sells. */
export function scoreLead(audit: AuditResult, lead: LeadInput): LeadScore {
  let score = 0;
  const reasons: string[] = [];
  const weight: Record<ServiceKey, number> = { marketing: 0, sales: 0, analytics: 0, web: 0, crm: 0 };
  const has = (id: string) => audit.checks.find((c: Check) => c.id === id);
  const issue = (id: string) => { const c = has(id); return Boolean(c && isIssue(c.status)); };

  const perf = audit.mobile?.performance;
  if (typeof perf === "number" && perf < 50) { score += 2; weight.web += 2; reasons.push(`Slow mobile site (${perf}/100)`); }
  else if (typeof perf === "number" && perf < 90) { score += 1; weight.web += 1; }
  if (issue("https") || issue("viewport")) { score += 2; weight.web += 3; reasons.push("Basic website problems (HTTPS or mobile)"); }
  if (issue("title") || issue("description")) { score += 1; weight.web += 1; }
  const noGa = issue("ga"), noPixel = has("pixel")?.status !== "pass";
  if (noGa && noPixel) { score += 2; weight.analytics += 3; reasons.push("No analytics or ad tracking installed"); }
  else if (noGa || noPixel) { score += 1; weight.analytics += 1; }
  if (issue("form")) { score += 2; weight.crm += 2; weight.web += 1; reasons.push("No lead form"); }
  if (issue("call")) { score += 1; weight.web += 1; }

  const concernWeights: Record<string, [number, Partial<Record<ServiceKey, number>>, string]> = {
    ads_roi: [3, { marketing: 4, analytics: 3 }, "Unhappy with ad results"],
    follow_up: [3, { sales: 5, crm: 2 }, "Leads aren't converting to sales"],
    more_customers: [2, { marketing: 3, sales: 2 }, "Wants more customers"],
    unknown_results: [2, { analytics: 5 }, "Doesn't know what's working"],
    google: [1, { web: 3 }, "Wants to rank on Google"],
    website: [1, { web: 3 }, "Website concerns"],
  };
  const cw = concernWeights[lead.concern];
  if (cw) { score += cw[0]; for (const [k, v] of Object.entries(cw[1])) weight[k as ServiceKey] += v!; reasons.push(cw[2]); }
  if (!FREE_MAIL.test(lead.email)) { score += 1; reasons.push("Business email address"); }
  if (lead.phone && lead.phone.replace(/\D/g, "").length >= 10) { score += 1; reasons.push("Left a phone number"); }

  const services = (Object.entries(weight) as [ServiceKey, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  if (!services.length) services.push("marketing");
  return { score, tier: score >= 7 ? "hot" : score >= 4 ? "warm" : "cool", services: services.slice(0, 3), reasons };
}
