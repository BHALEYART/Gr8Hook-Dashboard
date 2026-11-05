// Free website audit for gr8hook.com/audit: Google PageSpeed Insights (Lighthouse) scores plus
// a few checks on the page's public HTML (title, description, contact options, forms, tracking, sitemap).
// Only public pages are fetched; private/internal addresses are refused (SSRF protection).
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export type Status = "pass" | "warn" | "fail" | "info";
export interface Check { id: string; group: "seo" | "conversion" | "tracking" | "security"; status: Status; title: string; detail: string }
export interface Scores { performance: number | null; accessibility: number | null; seo: number | null; bestPractices: number | null }
export interface AuditResult {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  mobile: Scores | null;
  desktop: Scores | null;
  metrics: { label: string; value: string; status: Status }[];
  lighthouseIssues: { title: string; category: string; status: Status }[];
  checks: Check[];
  notes: string[];
}

// ───────────── URL safety ─────────────
const PRIVATE_V4 = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const;
const v4num = (ip: string) => ip.split(".").reduce((n, p) => n * 256 + Number(p), 0);
function isPrivate(ip: string): boolean {
  if (isIP(ip) === 4) return PRIVATE_V4.some(([base, bits]) => (v4num(ip) >>> (32 - bits)) === (v4num(base) >>> (32 - bits)));
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivate(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9")
    || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

/** Normalizes what someone typed ("example.com") into a public http(s) URL, or throws a friendly error. */
export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (!s) throw new Error("Enter your website address.");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u: URL;
  try { u = new URL(s); } catch { throw new Error("That doesn't look like a website address."); }
  if (!["http:", "https:"].includes(u.protocol) || u.username || u.password) throw new Error("That doesn't look like a website address.");
  if (u.port && !["80", "443"].includes(u.port)) throw new Error("Only standard web addresses can be checked.");
  const host = u.hostname.toLowerCase();
  if (isIP(host) || !host.includes(".") || host.endsWith(".local") || host.endsWith(".internal") || host === "localhost") {
    throw new Error("Enter a public website address, like yourbusiness.com.");
  }
  u.hash = "";
  return u;
}

async function assertPublic(u: URL) {
  const addrs = await lookup(u.hostname, { all: true }).catch(() => { throw new Error("We couldn't find that website. Check the address and try again."); });
  if (!addrs.length || addrs.some((a) => isPrivate(a.address))) throw new Error("Enter a public website address, like yourbusiness.com.");
}

/** Fetches a public page, following up to 4 redirects and re-checking each hop. Body capped at 2 MB. */
async function safeFetch(start: URL, timeoutMs = 9000): Promise<{ url: URL; status: number; body: string; redirectedFromHttp: boolean } | null> {
  let url = start;
  for (let hop = 0; hop < 5; hop++) {
    await assertPublic(url);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Gr8HookAudit/1.0; +https://gr8hook.com/audit/)", Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
    }).catch(() => null);
    if (!res) return null;
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      const next = new URL(res.headers.get("location")!, url);
      if (!["http:", "https:"].includes(next.protocol)) return null;
      url = next;
      continue;
    }
    const reader = res.body?.getReader();
    let body = "", size = 0;
    if (reader) {
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        body += dec.decode(value, { stream: true });
        if (size > 2_000_000) { await reader.cancel(); break; }
      }
    }
    return { url, status: res.status, body, redirectedFromHttp: start.protocol === "http:" && url.protocol === "https:" };
  }
  return null;
}

// ───────────── PageSpeed Insights ─────────────
interface LhAudit { id: string; title: string; score: number | null; scoreDisplayMode: string; displayValue?: string; numericValue?: number }
export interface PsiBody {
  lighthouseResult?: {
    finalUrl?: string; finalDisplayedUrl?: string;
    categories: Record<string, { score: number | null; auditRefs: { id: string; weight: number; group?: string }[] }>;
    audits: Record<string, LhAudit>;
  };
  error?: { message?: string };
}

async function psi(url: string, strategy: "mobile" | "desktop"): Promise<PsiBody["lighthouseResult"] | null> {
  const q = new URLSearchParams({ url, strategy });
  for (const c of ["performance", "accessibility", "seo", "best-practices"]) q.append("category", c);
  if (process.env.PAGESPEED_API_KEY) q.set("key", process.env.PAGESPEED_API_KEY);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${q}`, { signal: AbortSignal.timeout(55_000) }).catch(() => null);
  if (!res || !res.ok) return null;
  const body = (await res.json().catch(() => ({}))) as PsiBody;
  return body.lighthouseResult ?? null;
}
const pct = (s: number | null | undefined) => (typeof s === "number" ? Math.round(s * 100) : null);
const scoresOf = (lh: NonNullable<PsiBody["lighthouseResult"]>): Scores => ({
  performance: pct(lh.categories.performance?.score), accessibility: pct(lh.categories.accessibility?.score),
  seo: pct(lh.categories.seo?.score), bestPractices: pct(lh.categories["best-practices"]?.score),
});
const metricStatus = (score: number | null): Status => (score === null ? "info" : score >= 0.9 ? "pass" : score >= 0.5 ? "warn" : "fail");

// ───────────── HTML checks ─────────────
const BOOKING = /(calendly\.com|acuityscheduling\.com|squareup\.com\/appointments|book\.squareup|setmore\.com|vagaro\.com|booksy\.com|opentable\.com|resy\.com|leadconnectorhq\.com|msgsndr\.com|meetings\.hubspot\.com|schedulista|mindbodyonline|glossgenius|fresha\.com|housecallpro|jobber\.com|servicetitan|tidycal\.com|cal\.com\/)/i;
const FORM_EMBEDS = /(hsforms|hs-scripts|typeform\.com|jotform|wufoo|leadconnectorhq|msgsndr|formstack|cognitoforms|gravityforms|wpforms|ninja-forms|contact-form-7|wpcf7|formsubmit\.co|mailchimp|klaviyo|forms\.gle|docs\.google\.com\/forms|squarespace-form|wixforms|elementor-form)/i;
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? null;
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };
const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const text = (html: string) => decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export function htmlChecks(html: string): Check[] {
  const checks: Check[] = [];
  const head = html.slice(0, html.search(/<\/head>/i) >= 0 ? html.search(/<\/head>/i) : 200_000);
  const metaTags = head.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (key: string, val: string) => metaTags.find((t) => (attr(t, key) ?? "").toLowerCase() === val);

  const title = text(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  checks.push(!title
    ? { id: "title", group: "seo", status: "fail", title: "Missing page title", detail: "Search results show your page title first. Without one, Google has to guess." }
    : title.length < 15 || title.length > 65
      ? { id: "title", group: "seo", status: "warn", title: "Page title could be stronger", detail: `Your title is ${title.length} characters. Around 30–60 characters with your service and location usually works best.` }
      : { id: "title", group: "seo", status: "pass", title: "Page title found", detail: `"${title.slice(0, 70)}"` });

  const desc = decode(attr(meta("name", "description") ?? "", "content")?.trim() ?? "");
  checks.push(!desc
    ? { id: "description", group: "seo", status: "warn", title: "Missing page description", detail: "A meta description wasn't detected. It's the summary people read in search results before they click." }
    : desc.length < 70 || desc.length > 170
      ? { id: "description", group: "seo", status: "warn", title: "Page description could be stronger", detail: `It's ${desc.length} characters. Roughly 120–160 characters with a clear reason to click works best.` }
      : { id: "description", group: "seo", status: "pass", title: "Page description found", detail: "Search results have a summary to show." });

  const h1 = (html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi) ?? []).map(text).filter(Boolean);
  checks.push(h1.length
    ? { id: "h1", group: "seo", status: "pass", title: "Main heading found", detail: `"${h1[0].slice(0, 70)}"` }
    : { id: "h1", group: "seo", status: "warn", title: "No main heading (H1) detected", detail: "A clear main heading helps visitors and search engines understand the page at a glance." });

  checks.push(meta("name", "viewport")
    ? { id: "viewport", group: "seo", status: "pass", title: "Mobile-friendly setup", detail: "The page is set up to scale on phones." }
    : { id: "viewport", group: "seo", status: "fail", title: "Not set up for mobile", detail: "No mobile viewport was found, so phones may show a shrunken desktop page." });

  const og = meta("property", "og:title") || meta("property", "og:image");
  checks.push(og
    ? { id: "social", group: "seo", status: "pass", title: "Social sharing preview set", detail: "Links shared on Facebook, LinkedIn and texts show a proper preview." }
    : { id: "social", group: "seo", status: "warn", title: "No social sharing preview", detail: "Links shared on social media and in texts may show a blank or random preview." });

  checks.push(/application\/ld\+json/i.test(html)
    ? { id: "schema", group: "seo", status: "pass", title: "Structured data found", detail: "Search engines and AI assistants get extra details about your business." }
    : { id: "schema", group: "seo", status: "warn", title: "No structured data found", detail: "Business details (hours, services, location) in structured data help Google and AI search recommend you." });

  // Conversion: how a visitor gets in touch
  const links = (html.match(/<a\b[^>]*href\s*=\s*["'][^"']*["'][^>]*>/gi) ?? []).map((t) => attr(t, "href") ?? "");
  const tel = links.some((h) => /^tel:/i.test(h));
  const mail = links.some((h) => /^mailto:/i.test(h));
  const booking = BOOKING.test(html);
  const ways = [tel && "click-to-call", mail && "email", booking && "online booking"].filter(Boolean) as string[];
  checks.push(tel
    ? { id: "call", group: "conversion", status: "pass", title: "Click-to-call link found", detail: "Mobile visitors can call you with one tap." }
    : { id: "call", group: "conversion", status: "warn", title: "No click-to-call link found", detail: "On phones, a tappable number is often the fastest way a customer reaches you." });
  checks.push(booking
    ? { id: "booking", group: "conversion", status: "pass", title: "Online booking found", detail: "Visitors can schedule without waiting for a reply." }
    : { id: "booking", group: "conversion", status: "info", title: "No online booking detected", detail: "If you take appointments, letting people book on the spot can turn more visits into customers." });

  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) ?? [];
  const leadForm = forms.some((f) => /type\s*=\s*["'](email|tel)["']|<textarea/i.test(f) && !/type\s*=\s*["']search["']/i.test(f)) || FORM_EMBEDS.test(html);
  checks.push(leadForm
    ? { id: "form", group: "conversion", status: "pass", title: "Contact or lead form found", detail: "Visitors can send their details from the page." }
    : { id: "form", group: "conversion", status: "warn", title: "No lead form detected on this page", detail: `A short form captures people who aren't ready to call.${ways.length ? ` Found: ${ways.join(", ")}.` : ""} Forms that load later with JavaScript may not be detected.` });

  // Tracking: can this business measure what its marketing produces?
  const ga = /googletagmanager\.com\/gtag|gtag\(|google-analytics\.com|googletagmanager\.com\/gtm|GTM-[A-Z0-9]+/i.test(html);
  const pixel = /connect\.facebook\.net\/[^"']*fbevents|fbq\(/i.test(html);
  checks.push(ga
    ? { id: "ga", group: "tracking", status: "pass", title: "Google tag detected", detail: "Google Analytics or Tag Manager appears to be installed." }
    : { id: "ga", group: "tracking", status: "warn", title: "No Google tag detected", detail: "Without analytics, it's hard to know where visitors come from or what they do." });
  checks.push(pixel
    ? { id: "pixel", group: "tracking", status: "pass", title: "Meta Pixel detected", detail: "Facebook and Instagram ads can measure and optimize for results." }
    : { id: "pixel", group: "tracking", status: "info", title: "No Meta Pixel detected", detail: "If you run (or plan to run) Facebook or Instagram ads, the Pixel lets them optimize for real customers. It may also load through Tag Manager." });
  return checks;
}

async function sitemapCheck(origin: string): Promise<Check> {
  const robots = await safeFetch(new URL("/robots.txt", origin), 6000).catch(() => null);
  const declared = robots && robots.status === 200 ? [...robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
  for (const candidate of [...declared.slice(0, 2), new URL("/sitemap.xml", origin).toString(), new URL("/sitemap_index.xml", origin).toString()]) {
    let u: URL; try { u = new URL(candidate); } catch { continue; }
    const r = await safeFetch(u, 6000).catch(() => null);
    if (r && r.status === 200 && /<(urlset|sitemapindex)\b/i.test(r.body)) {
      return { id: "sitemap", group: "seo", status: "pass", title: "Sitemap found", detail: "Search engines have a map of your pages to crawl." };
    }
  }
  return { id: "sitemap", group: "seo", status: "warn", title: "No sitemap found", detail: "A sitemap helps Google find and index every important page." };
}

// ───────────── Run ─────────────
const ISSUE_CATEGORIES: Record<string, string> = { performance: "Speed", accessibility: "Accessibility", seo: "SEO", "best-practices": "Best practices" };
const COVERED = new Set(["document-title", "meta-description", "viewport", "is-on-https"]);
// Speed audits in plain language. Speed audits not listed here are technical diagnostics and aren't shown.
const SPEED_PLAIN: Record<string, string> = {
  "render-blocking-insight": "Files are delaying your page from showing", "render-blocking-resources": "Files are delaying your page from showing",
  "image-delivery-insight": "Images are larger than they need to be", "uses-optimized-images": "Images are larger than they need to be",
  "modern-image-formats": "Images are larger than they need to be", "uses-responsive-images": "Images are larger than they need to be",
  "offscreen-images": "Images load before they're needed",
  "cache-insight": "Returning visitors re-download the same files", "uses-long-cache-ttl": "Returning visitors re-download the same files",
  "unused-javascript": "Extra code is slowing the page down", "unused-css-rules": "Extra code is slowing the page down",
  "unminified-javascript": "Extra code is slowing the page down", "unminified-css": "Extra code is slowing the page down",
  "legacy-javascript": "Extra code is slowing the page down", "legacy-javascript-insight": "Extra code is slowing the page down",
  "server-response-time": "The server is slow to respond", "document-latency-insight": "The server is slow to respond",
  "font-display-insight": "Text is hidden while fonts load", "font-display": "Text is hidden while fonts load",
  "third-party-summary": "Outside scripts (chat, widgets, ads) slow the page", "third-parties-insight": "Outside scripts (chat, widgets, ads) slow the page",
  "lcp-discovery-insight": "The main image is found and loaded late", "prioritize-lcp-image": "The main image is found and loaded late",
  "redirects": "Extra redirects slow down the first visit", "total-byte-size": "The page is heavy to download on mobile data",
  "bootup-time": "The page takes a lot of processing on phones", "mainthread-work-breakdown": "The page takes a lot of processing on phones",
  "dom-size": "The page structure is very large", "dom-size-insight": "The page structure is very large",
  "layout-shifts": "Content jumps around while loading", "cls-culprits-insight": "Content jumps around while loading",
};
const SKIP = new Set(["errors-in-console", "inspector-issues", "valid-source-maps", "network-dependency-tree-insight", "interactive", "max-potential-fid"]);

/** Speed metrics and the most impactful failing audits from a mobile Lighthouse run. */
export function lighthouseSummary(mobile: NonNullable<PsiBody["lighthouseResult"]>) {
  const metrics: AuditResult["metrics"] = [];
  const issues: AuditResult["lighthouseIssues"] = [];
  for (const [id, label] of [["largest-contentful-paint", "Main content loads (mobile)"], ["first-contentful-paint", "First content appears (mobile)"],
    ["total-blocking-time", "Time page is unresponsive"], ["cumulative-layout-shift", "Layout shifting"]] as const) {
    const a = mobile.audits[id];
    if (a?.displayValue) metrics.push({ label, value: a.displayValue.replace(/\u00a0/g, " "), status: metricStatus(a.score) });
  }
  // Most impactful failing Lighthouse audits (by category weight), skipping ones our own checks already explain.
  const seen = new Set<string>();
  const ranked: { title: string; category: string; status: Status; weight: number }[] = [];
  for (const [cat, label] of Object.entries(ISSUE_CATEGORIES)) {
    for (const ref of mobile.categories[cat]?.auditRefs ?? []) {
      const a = mobile.audits[ref.id];
      if (!a || seen.has(a.id) || COVERED.has(a.id) || a.score === null || a.score >= 0.9) continue;
      if (!["binary", "numeric", "metricSavings"].includes(a.scoreDisplayMode)) continue;
      if (ref.group === "metrics") continue; // speed metrics are shown above
      if (SKIP.has(a.id) || (cat === "performance" && !SPEED_PLAIN[a.id])) continue;
      const title = cat === "performance" ? SPEED_PLAIN[a.id] : a.title.replace(/`/g, "");
      if (seen.has(title)) continue;
      seen.add(a.id); seen.add(title);
      ranked.push({ title, category: label, status: a.score < 0.5 ? "fail" : "warn", weight: ref.weight + (cat === "performance" ? 0.5 : 0) });
    }
  }
  issues.push(...ranked.sort((x, y) => y.weight - x.weight).slice(0, 8).map(({ title, category, status }) => ({ title, category, status })));
  return { metrics, issues };
}

export async function runAudit(input: string): Promise<AuditResult> {
  const start = normalizeUrl(input);
  await assertPublic(start);
  const page = await safeFetch(start);
  if (!page) throw new Error("We couldn't reach that website. Check the address and try again.");
  if (page.status >= 400) throw new Error(`That page returned an error (${page.status}). Check the address and try again.`);
  const finalUrl = page.url.toString();

  const [mobile, desktop, sitemap] = await Promise.all([psi(finalUrl, "mobile"), psi(finalUrl, "desktop"), sitemapCheck(page.url.origin)]);

  const checks: Check[] = [];
  checks.push(page.url.protocol === "https:"
    ? { id: "https", group: "security", status: "pass", title: "HTTPS enabled", detail: "The website uses an encrypted connection." }
    : { id: "https", group: "security", status: "fail", title: "Not secure (no HTTPS)", detail: "Browsers label the site \"Not secure\", which scares visitors away and hurts search rankings." });
  checks.push(...htmlChecks(page.body), sitemap);

  const notes: string[] = [];
  const { metrics, issues } = mobile ? lighthouseSummary(mobile) : { metrics: [], issues: [] };
  if (!mobile) {
    notes.push("Google's speed test didn't finish for this site, so speed scores aren't shown. Try again in a minute.");
  }
  notes.push("Scores come from Google Lighthouse and can vary a little each time it runs.");

  return {
    url: input, finalUrl, fetchedAt: new Date().toISOString(),
    mobile: mobile ? scoresOf(mobile) : null, desktop: desktop ? scoresOf(desktop) : null,
    metrics, lighthouseIssues: issues, checks, notes,
  };
}
