// Signs audit results so the "full report" request can trust the findings it sends back,
// without storing every audit. Secret: AUDIT_SECRET (falls back to the PageSpeed key, which is server-only).
import { createHmac, timingSafeEqual } from "node:crypto";
import type { AuditResult, SpeedResult } from "@/lib/site-audit";

const secret = () => {
  const s = process.env.AUDIT_SECRET || process.env.PAGESPEED_API_KEY;
  return s ? createHmac("sha256", "gr8hook-audit-v1").update(s).digest() : null;
};

export function signAudit(result: AuditResult | SpeedResult): { signed: string; sig: string } | null {
  const key = secret();
  if (!key) return null;
  const signed = Buffer.from(JSON.stringify(result)).toString("base64url");
  return { signed, sig: createHmac("sha256", key).update(signed).digest("base64url") };
}

/** Returns the payload if the signature matches and it's less than 2 days old. */
export function verifyAudit(signed: unknown, sig: unknown): AuditResult | null { return verifySigned<AuditResult>(signed, sig); }
export function verifySpeed(token: unknown): SpeedResult | null {
  const t = token as { signed?: unknown; sig?: unknown } | null;
  const r = t ? verifySigned<SpeedResult>(t.signed, t.sig) : null;
  return r && (r.strategy === "mobile" || r.strategy === "desktop") ? r : null;
}
function verifySigned<T extends { fetchedAt: string }>(signed: unknown, sig: unknown): T | null {
  const key = secret();
  if (!key || typeof signed !== "string" || typeof sig !== "string" || signed.length > 200_000) return null;
  const expected = Buffer.from(createHmac("sha256", key).update(signed).digest("base64url"));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const result = JSON.parse(Buffer.from(signed, "base64url").toString()) as T;
    if (Date.now() - new Date(result.fetchedAt).getTime() > 2 * 864e5) return null;
    return result;
  } catch {
    return null;
  }
}
