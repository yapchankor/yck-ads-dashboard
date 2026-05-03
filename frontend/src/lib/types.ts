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
  target_id?: string;
  normalized_key?: string;
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
};
