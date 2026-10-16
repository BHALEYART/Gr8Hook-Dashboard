// Shared types. These mirror the tables in supabase/migrations/0001_init.sql.

export type Role = "admin" | "client_owner" | "client_staff";
export type Platform = "google" | "meta";
export type ServiceKey = "meta_ads" | "google_ads" | "ghl" | "callrail";
export type PrimaryGoal = "leads" | "sales" | "appointments";

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
