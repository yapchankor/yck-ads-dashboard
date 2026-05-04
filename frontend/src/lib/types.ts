export type Platform = "Google" | "Meta" | "Cross-Platform";

export type Campaign = {
  id: string;
  name: string;
  platform: Platform;
  status: "Active" | "Paused" | "Completed";
  spend: number;
  conversions: number;
  cpa: number;
  roas: number;
  impressions?: number;
  clicks?: number;
  conversion_value?: number;
  daily_budget?: number;
};

export type RecommendationStatus = "Pending" | "Tracking" | "Completed" | "Dismissed";
export type RecommendationQualityLabel = "High confidence" | "Needs review" | "Manual only" | "Insufficient data";
export type RecommendationGuardrailStatus = "eligible" | "manual_only" | "suppressed";

export type Recommendation = {
  id: string;
  recommendation_id?: string;
  title: string;
  description: string;
  platform: Platform;
  impact: string;
  expected_impact?: string;
  expectedImpact?: string | null;
  action_type?: string;
  actionType: string;
  status: RecommendationStatus;
  suggestedAction?: string | null;
  campaignName?: string | null;
  ad_group_name?: string | null;
  isManualOnly?: boolean;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  ad_name?: string;
  target_id?: string;
  normalized_key?: string;
  segment?: string;
  segment_type?: string;
  placement?: string;
  location?: string;
  location_key?: string;
  location_type?: string;
  location_id?: string | number | null;
  negative_keywords?: string[];
  match_type?: string | null;
  formula?: string | null;
  assumptions?: string[];
  current?: string | null;
  suggested?: string | null;
  issue?: string | null;
  headline?: string | null;
  final_url?: string | null;
  image_prompt?: string | null;
  campaign_ids?: Array<string | number>;
  current_cpa?: number | null;
  suggested_adjustment?: string | null;
  time_slot?: string | null;
  current_spend?: number | null;
  current_performance?: string | null;
  how_to_apply?: string | null;
  device?: string | null;
  best_hours?: Array<string | number>;
  wasted_days?: string[];
  current_bid?: number;
  suggested_bid?: number;
  current_budget?: number;
  budget_basis?: string;
  keyword?: string;
  execution_status?: string;
  quality_label?: RecommendationQualityLabel;
  confidence_score?: number;
  guardrail_status?: RecommendationGuardrailStatus;
  guardrail_reasons?: string[];
  evidence?: {
    spend?: number | null;
    clicks?: number | null;
    conversions?: number | null;
    cpa?: number | null;
    date_range_days?: number | null;
    confidence_inputs?: Record<string, unknown>;
  };
  automation_allowed?: boolean;
  impact_data?: {
    monthly_savings?: number;
    additional_conversions_monthly?: number;
    additional_revenue_monthly?: number;
    additional_spend_monthly?: number;
    net_benefit_monthly?: number;
    confidence_pct?: number;
    confidence?: string;
  };
  automation?: {
    is_automatable?: boolean;
    manual_reason?: string;
  };
};

export type DashboardMetrics = {
  totalSpend: number;
  totalConversions: number;
  blendedCPA: number;
  blendedROAS: number;
  spendDelta: number; // Percentage change
  cpaDelta: number;
  dateRange?: { start: string; end: string };
};

export type DashboardData = {
  metrics: DashboardMetrics;
  recommendations: Recommendation[];
  campaigns: Campaign[];
  isLive: boolean;
  client_name?: string;
  account_name?: string;
  customer_id?: string | null;
  facebook_ad_account_id?: string | null;
  date_range?: { days?: number; start_date: string; end_date: string };
  platform_date_ranges?: {
    google?: { days?: number; start_date: string; end_date: string } | null;
    meta?: { days?: number; start_date: string; end_date: string } | null;
  } | null;
  fetched_at?: string | null;
};
