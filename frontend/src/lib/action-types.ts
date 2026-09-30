import { formatCurrency } from "@/lib/client-config";
import { ActionPreview, ApplyResult, DashboardMetrics, Recommendation } from "@/lib/types";

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

export function recommendationToActionPreview(rec: Recommendation): ActionPreview {
  return {
    id: rec.id,
    title: rec.title,
    platform: rec.platform,
    actionType: rec.actionType,
    impact: rec.impact,
    targetLabel: rec.keyword || rec.ad_name || rec.segment || rec.placement || rec.location || rec.campaignName,
    targetId: rec.target_id || rec.campaign_id || rec.adset_id || rec.ad_id || null,
    targetType: rec.keyword ? "Keyword" : rec.ad_name ? "Ad" : rec.adset_id ? "Ad Set" : rec.campaignName ? "Campaign" : "Target",
    campaignName: rec.campaignName,
    campaignId: rec.campaign_id,
    adGroupName: rec.ad_group_name,
    adsetId: rec.adset_id,
    adName: rec.ad_name,
    adId: rec.ad_id,
    keyword: rec.keyword,
    negativeKeywords: rec.negative_keywords,
    matchType: rec.match_type,
    segment: rec.segment,
    segmentType: rec.segment_type,
    placement: rec.placement,
    location: rec.location,
    locationKey: rec.location_key,
    locationType: rec.location_type,
    locationId: rec.location_id,
    device: rec.device,
    timeSlot: rec.time_slot,
    bestHours: rec.best_hours,
    wastedDays: rec.wasted_days,
    campaignIds: rec.campaign_ids,
    currentValue: rec.current || (rec.current_bid ? formatCurrency(rec.current_bid) : rec.current_budget ? formatCurrency(rec.current_budget) : null),
    proposedValue: rec.suggested || rec.suggestedAction || (rec.suggested_bid ? formatCurrency(rec.suggested_bid) : rec.suggested_adjustment),
    currentBid: rec.current_bid,
    suggestedBid: rec.suggested_bid,
    currentBudget: rec.current_budget,
    budgetBasis: rec.budget_basis,
    suggestedAdjustment: rec.suggested_adjustment,
    currentCpa: rec.current_cpa,
    currentSpend: rec.current_spend,
    currentPerformance: rec.current_performance,
    reason: rec.description,
    suggestedAction: rec.suggestedAction,
    expectedImpact: rec.expectedImpact,
    formula: rec.formula,
    manualPath: rec.how_to_apply,
    normalizedKey: rec.normalized_key,
    qualityLabel: rec.quality_label,
    confidenceScore: rec.confidence_score,
    guardrailStatus: rec.guardrail_status,
    guardrailReasons: rec.guardrail_reasons,
    evidence: rec.evidence,
    automationAllowed: rec.automation_allowed,
    manualOnly: rec.isManualOnly,
  };
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
