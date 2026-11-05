// Shared types. These mirror the tables in supabase/migrations/0001_init.sql.

export type Role = "admin" | "client_owner" | "client_staff";
export type Platform = "google" | "meta";
export type ServiceKey = "meta_ads" | "google_ads" | "ghl" | "callrail" | "shopify";
export type PrimaryGoal = "leads" | "sales" | "appointments" | "ecommerce";

export interface Client {
  id: string;
  name: string;
  status: "active" | "inactive";
  primary_goal: PrimaryGoal;
  brand_color: string | null;
  google_ads_customer_id: string | null;
  meta_ad_account_id: string | null;
  ghl_location_id: string | null;
  ghl_calendar_ids?: string[];
  /** Offer the Reach view (impressions, reach, engagement) on the Overview. */
  show_reach?: boolean;
  /** What this client calls a lead, e.g. "Consults" or "Signups". Defaults to "Leads". */
  lead_label?: string | null;
  /** Shopify store, e.g. "lakeshore-candle.myshopify.com" (E-commerce mode). */
  shopify_shop?: string | null;
  /** Client ID of the Shopify app installed on that store (not secret). */
  shopify_client_id?: string | null;
  google_login_customer_id?: string | null;
  meta_connected_as?: string | null;
  google_connected_as?: string | null;
  meta_token_expires_at?: string | null;
  created_at: string;
}

export interface ClientService {
  client_id: string;
  service: ServiceKey;
  enabled: boolean;
}

export interface AdMetricDaily {
  client_id: string;
  platform: Platform;
  campaign_id: string;
  campaign_name: string;
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value: number;
  // Attention metrics (optional; Meta fills these, Google search campaigns usually don't)
  reach?: number;
  engagements?: number;
  video_views?: number;
  landing_page_views?: number;
}

export interface Lead {
  id: string;
  client_id: string;
  ghl_contact_id: string;
  name: string;
  created_at: string;
  source: string | null; // e.g. "facebook", "google", "direct"
  utm_campaign: string | null; // campaign ID when UTM templates are set up
  campaign_id: string | null; // resolved campaign match
  gclid: string | null;
  fbclid: string | null;
}

export interface Opportunity {
  id: string;
  client_id: string;
  contact_id: string;
  pipeline: string;
  stage: string;
  status: "open" | "won" | "lost" | "abandoned";
  value: number;
  service: string | null;
  updated_at: string;
}

export interface Appointment {
  id: string;
  client_id: string;
  contact_id: string;
  starts_at: string;
  status: "booked" | "confirmed" | "showed" | "noshow" | "cancelled";
}

export interface CampaignMapping {
  client_id: string;
  campaign_id: string;
  product_or_service: string;
}

export interface Annotation {
  id: string;
  client_id: string;
  date: string;
  note: string;
}

export interface Viewer {
  userId: string;
  email: string;
  isAdmin: boolean;
  clientIds: string[];
}

export interface MonthRow {
  month: string; // YYYY-MM
  label: string; // "Jan" or "Jan (MTD)"
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  engagements: number;
  video_views: number;
  landing_page_views: number;
  leads: number; // paid, attributed leads
  appointments: number;
  sales: number;
  revenue: number;
  google_leads: number;
  meta_leads: number;
  unattributed: number;
}

export interface CampaignRow {
  platform: Platform;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  engagements: number;
  landing_page_views: number;
  leads: number;
  revenue: number;
  service: string | null;
}

/** A Shopify order with the ad source we could tie it to. */
export interface StoreOrder {
  client_id: string;
  order_id: string;
  name: string; // "#1042"
  created_at: string;
  total: number;
  currency: string;
  cancelled: boolean;
  platform: Platform | null; // ad platform the order came from, if any
  campaign_id: string | null; // matched campaign, when utm_campaign carries the campaign ID
  match_method: "utm" | "click_id" | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  landing_page: string | null;
  referrer: string | null;
}

export interface StoreOrderLine {
  client_id: string;
  order_id: string;
  line_id: string;
  product_id: string | null;
  product_title: string;
  variant_title: string | null;
  quantity: number;
  amount: number; // line total after discounts
}

/** Store numbers for one month, either for the whole store or for one product. */
export interface StoreMonth {
  orders: number;
  units: number;
  revenue: number;
  ad_orders: number;
  ad_revenue: number;
  meta_orders: number;
  meta_revenue: number;
  google_orders: number;
  google_revenue: number;
}

export interface LeadScores { performance: number | null; accessibility: number | null; seo: number | null; bestPractices: number | null }
export type LeadTier = "hot" | "warm" | "cool";
export type LeadStatus = "new" | "contacted" | "qualified" | "won" | "lost";
export interface AuditLead {
  id: string;
  created_at: string;
  status: LeadStatus;
  name: string;
  business: string;
  email: string;
  phone: string | null;
  concern: string;
  concern_detail: string | null;
  website: string;
  audited_at: string;
  scores: { mobile: LeadScores | null; desktop: LeadScores | null };
  issues: { title: string; detail?: string; status: string; group: string }[];
  recommendations: { title: string; why: string; fix: string; service: string; priority: string }[];
  lead_score: number;
  lead_tier: LeadTier;
  suggested_services: string[];
  score_reasons: string[];
  notes: string | null;
  source: string;
  referrer: string | null;
  utm: Record<string, string>;
  consent_marketing: boolean;
  report_emailed_at: string | null;
}
