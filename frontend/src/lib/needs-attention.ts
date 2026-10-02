import { Recommendation } from "./types";

export function getTopActionableRecommendations(
  recommendations: Recommendation[],
  platformFilter: "All" | "Google" | "Meta",
  limit = 3
): Recommendation[] {
  const activeCandidates = (recommendations || []).filter(
    (r) => r.status !== "Completed" && r.status !== "Dismissed" && r.guardrail_status !== "suppressed"
  );

  const filteredCandidates = platformFilter === "All"
    ? activeCandidates
    : activeCandidates.filter((r) => r.platform === platformFilter);

  return [...filteredCandidates]
    .sort((a, b) => {
      const confA = typeof a.confidence_score === "number" ? a.confidence_score : 70;
      const confB = typeof b.confidence_score === "number" ? b.confidence_score : 70;
      if (confB !== confA) return confB - confA;
      const impactWeight = (imp: string) => (imp === "High" ? 3 : imp === "Medium" ? 2 : 1);
      return impactWeight(b.impact) - impactWeight(a.impact);
    })
    .slice(0, limit);
}
