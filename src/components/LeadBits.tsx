import type { LeadStatus, LeadTier } from "@/lib/types";

export const TIER_STYLE: Record<LeadTier, string> = {
  hot: "bg-coral/15 text-coral", warm: "bg-[#F5B841]/20 text-[#9A6A00] dark:text-[#F7C866]", cool: "bg-panel-2 text-ink-2",
};
export function TierPill({ tier, score }: { tier: LeadTier; score?: number }) {
  return <span className={`pill ${TIER_STYLE[tier]}`}>{tier[0].toUpperCase() + tier.slice(1)}{score !== undefined ? ` · ${score}` : ""}</span>;
}
export const STATUS_LABEL: Record<LeadStatus, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", won: "Won", lost: "Lost" };
export const SERVICE_NAME: Record<string, string> = {
  marketing: "Marketing & Ads", sales: "Sales & Lead Gen", analytics: "Analytics", web: "Web Design & SEO", crm: "CRM & Automation",
};
export const hostOf = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
