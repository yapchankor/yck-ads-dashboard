import { Recommendation } from "@/lib/types";

// ── Impact aggregation ──────────────────────────────────────────────────────
// Shared by the Recommendations page and the compact pointer strips on the
// Google/Meta pages so counts and totals never diverge across surfaces.
// Uses structured impact_data fields written by the backend (same source as
// HTML reports). Discounts each recommendation by its individual confidence_pct,
// defaulting to moderate 70% confidence when absent.

export const DEFAULT_CONFIDENCE_FACTOR = 0.7;

export type PlatformImpact = {
  monthlySavings: number;
  additionalConversions: number;
  additionalRevenue: number;
  netMonthlyBenefit: number;
  autoCount: number;
  manualCount: number;
  avgConfidencePct: number;
};

export function computePlatformImpact(recs: Recommendation[]): PlatformImpact {
  let monthlySavings = 0;
  let additionalConversions = 0;
  let additionalRevenue = 0;
  let netMonthlyBenefit = 0;
  let autoCount = 0;
  let manualCount = 0;
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const rec of recs) {
    const d = rec.impact_data || {};
    // Discount by this rec's own confidence; default to moderate 0.7 when absent.
    const factor = typeof d.confidence_pct === "number" ? d.confidence_pct / 100 : DEFAULT_CONFIDENCE_FACTOR;
    const savings = (d.monthly_savings || 0) * factor;
    const convs = (d.additional_conversions_monthly || 0) * factor;
    const revenue = (d.additional_revenue_monthly || 0) * factor;
    const spend = (d.additional_spend_monthly || 0) * factor;
    const rawNet = d.net_benefit_monthly || 0;
    const net = rawNet !== 0
      ? rawNet * factor
      : (savings + revenue - spend);

    monthlySavings += savings;
    additionalConversions += convs;
    additionalRevenue += revenue;
    netMonthlyBenefit += net;
    confidenceSum += factor * 100;
    confidenceCount++;

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
    avgConfidencePct: confidenceCount > 0 ? Math.round(confidenceSum / confidenceCount) : 70,
  };
}
