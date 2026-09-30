import { Recommendation } from "@/lib/types";

// ── Impact aggregation ──────────────────────────────────────────────────────
// Shared by the Recommendations page and the compact pointer strips on the
// Google/Meta pages so counts and totals never diverge across surfaces.
// Uses structured impact_data fields written by the backend (same source as
// HTML reports). Applies 70% moderate-confidence factor — matching
// calculate_total_impact.py.

export const CONFIDENCE_FACTOR = 0.7;

export type PlatformImpact = {
  monthlySavings: number;
  additionalConversions: number;
  additionalRevenue: number;
  netMonthlyBenefit: number;
  autoCount: number;
  manualCount: number;
};

export function computePlatformImpact(recs: Recommendation[]): PlatformImpact {
  let monthlySavings = 0;
  let additionalConversions = 0;
  let additionalRevenue = 0;
  let netMonthlyBenefit = 0;
  let autoCount = 0;
  let manualCount = 0;

  for (const rec of recs) {
    const d = rec.impact_data || {};
    const savings = (d.monthly_savings || 0) * CONFIDENCE_FACTOR;
    const convs = (d.additional_conversions_monthly || 0) * CONFIDENCE_FACTOR;
    const revenue = (d.additional_revenue_monthly || 0) * CONFIDENCE_FACTOR;
    const spend = (d.additional_spend_monthly || 0) * CONFIDENCE_FACTOR;
    const rawNet = d.net_benefit_monthly || 0;
    const net = rawNet !== 0
      ? rawNet * CONFIDENCE_FACTOR
      : (savings + revenue - spend);

    monthlySavings += savings;
    additionalConversions += convs;
    additionalRevenue += revenue;
    netMonthlyBenefit += net;

    if (rec.automation_allowed) autoCount++;
    else manualCount++;
  }

  return {
    monthlySavings: Math.round(monthlySavings),
    additionalConversions: Math.round(additionalConversions * 10) / 10,
    additionalRevenue: Math.round(additionalRevenue),
    netMonthlyBenefit: Math.round(netMonthlyBenefit),
    autoCount,
    manualCount,
  };
}
