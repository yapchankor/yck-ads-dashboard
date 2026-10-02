import { describe, it, expect } from "vitest";
import { getTopActionableRecommendations } from "./needs-attention";
import { Recommendation } from "./types";

const mockRecommendations: Recommendation[] = [
  {
    id: "rec-1",
    title: "Pause Low ROAS Ad Set",
    description: "CPA is 3x target",
    platform: "Meta",
    impact: "High",
    actionType: "pause_adset",
    status: "Pending",
    confidence_score: 95,
    guardrail_status: "eligible",
  },
  {
    id: "rec-2",
    title: "Add Negative Keywords",
    description: "Waste on competitor terms",
    platform: "Google",
    impact: "Medium",
    actionType: "add_negative_keyword",
    status: "Pending",
    confidence_score: 90,
    guardrail_status: "eligible",
  },
  {
    id: "rec-3",
    title: "Scale Top Performing Search Campaign",
    description: "ROAS is 4.5x with budget headroom",
    platform: "Google",
    impact: "High",
    actionType: "budget_adjustment",
    status: "Pending",
    confidence_score: 85,
    guardrail_status: "eligible",
  },
  {
    id: "rec-4",
    title: "Lower Priority Recommendation",
    description: "Minor device bid tweak",
    platform: "Google",
    impact: "Low",
    actionType: "device_bid_adjustment",
    status: "Pending",
    confidence_score: 60,
    guardrail_status: "eligible",
  },
  {
    id: "rec-suppressed",
    title: "Suppressed Item",
    description: "Guardrails triggered",
    platform: "Meta",
    impact: "High",
    actionType: "budget_scaling",
    status: "Pending",
    confidence_score: 99,
    guardrail_status: "suppressed",
  },
  {
    id: "rec-dismissed",
    title: "Dismissed Item",
    description: "Operator dismissed",
    platform: "Google",
    impact: "High",
    actionType: "pause_keyword",
    status: "Dismissed",
    confidence_score: 98,
    guardrail_status: "eligible",
  },
  {
    id: "rec-completed",
    title: "Completed Item",
    description: "Already executed",
    platform: "Meta",
    impact: "High",
    actionType: "pause_ad",
    status: "Completed",
    confidence_score: 97,
    guardrail_status: "eligible",
  },
];

describe("getTopActionableRecommendations", () => {
  it("selects top 3 actionable recommendations sorted by confidence and impact", () => {
    const top = getTopActionableRecommendations(mockRecommendations, "All", 3);

    expect(top).toHaveLength(3);
    // Suppressed, Dismissed, and Completed items must be excluded
    expect(top.find((r) => r.id === "rec-suppressed")).toBeUndefined();
    expect(top.find((r) => r.id === "rec-dismissed")).toBeUndefined();
    expect(top.find((r) => r.id === "rec-completed")).toBeUndefined();

    // Top 3 should be rec-1 (95%), rec-2 (90%), rec-3 (85%)
    expect(top[0].id).toBe("rec-1");
    expect(top[1].id).toBe("rec-2");
    expect(top[2].id).toBe("rec-3");
  });

  it("filters correctly by platform toggle", () => {
    const metaTop = getTopActionableRecommendations(mockRecommendations, "Meta", 3);
    expect(metaTop).toHaveLength(1);
    expect(metaTop[0].id).toBe("rec-1");

    const googleTop = getTopActionableRecommendations(mockRecommendations, "Google", 3);
    expect(googleTop).toHaveLength(3);
    expect(googleTop[0].id).toBe("rec-2");
    expect(googleTop[1].id).toBe("rec-3");
    expect(googleTop[2].id).toBe("rec-4");
  });

  it("returns empty array when all items are inactive or suppressed", () => {
    const top = getTopActionableRecommendations([], "All", 3);
    expect(top).toEqual([]);
  });
});
