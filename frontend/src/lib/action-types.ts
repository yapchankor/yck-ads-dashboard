import { ActionPreview, ApplyResult, DashboardMetrics } from "@/lib/types";

export const ACTION_TYPE_LABELS: Record<string, string> = {
  add_negative_keyword: "Add Negative Keyword",
  budget_adjustment: "Budget Adjustment",
  bid_adjustment: "Bid Adjustment",
  budget_scaling: "Budget Scaling",
  campaign_action: "Campaign Status",
  creative_refresh: "Creative Refresh",
  objective_mismatch: "Objective Mismatch",
  audience_fatigue: "Audience Fatigue",
  schedule_adjustment: "Schedule Adjustment",
  day_schedule: "Day Schedule",
  placement_exclusion: "Placement Exclusion",
  audience_exclusion: "Audience Exclusion",
  geo_exclusion: "Geo Exclusion",
  geo_scaling: "Geo Scaling",
  campaign_review: "Campaign Review",
  a_b_test: "A/B Test",
  keyword_action: "Keyword Action",
  schedule_bid_adjustment: "Schedule Bid Adjustment",
  geo_bid_adjustment: "Geo Bid Adjustment",
  device_bid_adjustment: "Device Bid Adjustment",
  quality_improvement: "Quality Improvement",
  ad_copy: "Ad Copy",
  pause: "Pause",
  review: "Review",
  switch_objective: "Switch Objective",
  review_overspend: "Review Overspend",
};

export function actionTypeLabel(actionType: string) {
  return ACTION_TYPE_LABELS[actionType] || actionType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getApplyErrorMessage(result: unknown) {
  if (!result || typeof result !== "object") return "Failed to apply action";

  const response = result as ApplyResult;
  if (response.error) return response.error;
  if (response.execution_status) return response.execution_status;
  if (response.message) return response.message;
  if (typeof response.detail === "string") return response.detail;
  if (Array.isArray(response.detail)) {
    const details = response.detail
      .map((item) => {
        const location = item.loc?.slice(1).join(".");
        return location && item.msg ? `${location}: ${item.msg}` : item.msg;
      })
      .filter(Boolean)
      .join("; ");
    if (details) return details;
  }

  return "Failed to apply action";
}

export function actionPayload(
  action: ActionPreview,
  clientName: string,
  baselineMetrics?: DashboardMetrics,
  options?: { manual?: boolean; status?: "Dismissed" },
) {
  return {
    client_name: clientName,
    recommendation_id: action.id,
    title: action.title,
    action_type: action.actionType,
    platform: action.platform,
    impact: action.impact || "Medium",
    suggested_action: action.suggestedAction || action.proposedValue || action.title,
    target_id: action.targetId,
    campaign_id: action.campaignId,
    adset_id: action.adsetId,
    ad_id: action.adId,
    ad_name: action.adName,
    segment: action.segment,
    segment_type: action.segmentType,
    placement: action.placement,
    location: action.location,
    location_key: action.locationKey,
    location_id: action.locationId,
    location_type: action.locationType,
    best_hours: action.bestHours,
    wasted_days: action.wastedDays,
    campaign_ids: action.campaignIds,
    device: action.device,
    suggested_adjustment: action.suggestedAdjustment,
    time_slot: action.timeSlot,
    current_cpa: action.currentCpa,
    current_spend: action.currentSpend,
    current_performance: action.currentPerformance,
    keyword: action.keyword,
    negative_keywords: action.negativeKeywords,
    match_type: action.matchType,
    suggested_bid: action.suggestedBid,
    current_budget: action.currentBudget,
    budget_basis: action.budgetBasis,
    manual: Boolean(options?.manual),
    status: options?.status,
    baseline_metrics: {
      expected_outcome: action.expectedImpact || "Improved performance",
      total_spend: baselineMetrics?.totalSpend,
      total_conversions: baselineMetrics?.totalConversions,
      blended_cpa: baselineMetrics?.blendedCPA,
      blended_roas: baselineMetrics?.blendedROAS,
      spend_delta: baselineMetrics?.spendDelta,
      cpa_delta: baselineMetrics?.cpaDelta,
    },
    normalized_key: action.normalizedKey,
    quality_label: action.qualityLabel,
    confidence_score: action.confidenceScore,
    guardrail_status: action.guardrailStatus,
    guardrail_reasons: action.guardrailReasons,
    evidence: action.evidence,
    expected_impact: action.expectedImpact,
  };
}
