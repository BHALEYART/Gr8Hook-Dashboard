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
  label: string; // "Jan"
  spend: number;
  leads: number;
  appointments: number;
  revenue: number;
}

export interface CampaignRow {
  platform: Platform;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  leads: number;
  revenue: number;
  service: string | null;
}
