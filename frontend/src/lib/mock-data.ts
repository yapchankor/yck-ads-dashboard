import { DashboardMetrics, Recommendation, Campaign } from "./types";

export const mockMetrics: DashboardMetrics = {
  totalSpend: 12450.00,
  totalConversions: 342,
  blendedCPA: 36.40,
  blendedROAS: 2.8,
  spendDelta: 12.5,
  cpaDelta: -8.2, // Negative is good for CPA
};

export const mockRecommendations: Recommendation[] = [
  {
    id: "rec-1",
    title: "Pause Low Performing Keywords",
    description: "3 keywords in 'Brand Search' are consuming budget with $0 CPA. Pausing them will reallocate budget to converting terms.",
    platform: "Google",
    impact: "-$120 wasted spend/week",
    action_type: "pause",
    actionType: "Pause",
    status: "Pending",
  },
  {
    id: "rec-2",
    title: "Creative Fatigue Detected",
    description: "Ad Set 'Retargeting_V2' frequency is > 4 and CTR dropped by 40%. Time to rotate creatives.",
    platform: "Meta",
    impact: "+15% expected CTR",
    action_type: "pause",
    actionType: "Pause",
    status: "Pending",
  },
  {
    id: "rec-3",
    title: "Cross-Platform Budget Shift",
    description: "Meta CPA is currently 20% lower than Google Search CPA for generic terms. Shift $500/day to Meta.",
    platform: "Cross-Platform",
    impact: "-10% blended CPA",
    action_type: "shift_budget",
    actionType: "Shift Budget",
    status: "Pending",
  }
];

export const mockCampaigns: Campaign[] = [
  {
    id: "cmp-1",
    name: "Search - Brand Terms",
    platform: "Google",
    status: "Active",
    spend: 2450,
    conversions: 120,
    cpa: 20.41,
    roas: 4.2,
    clicks: 1450,
  },
  {
    id: "cmp-2",
    name: "Performance Max - Core Products",
    platform: "Google",
    status: "Active",
    spend: 5200,
    conversions: 85,
    cpa: 61.17,
    roas: 1.8,
    clicks: 3200,
  },
  {
    id: "cmp-3",
    name: "Retargeting - All Visitors (30d)",
    platform: "Meta",
    status: "Active",
    spend: 1800,
    conversions: 95,
    cpa: 18.94,
    roas: 3.5,
    impressions: 45000,
  },
  {
    id: "cmp-4",
    name: "Prospecting - Lookalike 1%",
    platform: "Meta",
    status: "Paused",
    spend: 3000,
    conversions: 42,
    cpa: 71.42,
    roas: 1.2,
    impressions: 120000,
  }
];
