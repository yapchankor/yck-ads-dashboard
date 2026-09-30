import Link from "next/link";
import { Recommendation } from "@/lib/types";
import { computePlatformImpact } from "@/lib/recommendation-impact";
import { currencySymbol } from "@/lib/client-config";

// Compact strip that points from the Google/Meta pages to the single
// Recommendations page. Filters by exact platform and drops suppressed recs,
// so its count matches the Recommendations page exactly.
export function RecommendationsPointer({
  platform,
  recommendations,
}: {
  platform: "Google" | "Meta";
  recommendations?: Recommendation[];
}) {
  const recs = (recommendations || [])
    .filter((r) => r.guardrail_status !== "suppressed")
    .filter((r) => r.platform === platform);
  const impact = computePlatformImpact(recs);
  const count = recs.length;
  const href = `/recommendations?platform=${platform}`;

  if (count === 0) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface px-6 py-4 shadow-sm">
        <p className="text-sm text-text-muted">No {platform} recommendations right now.</p>
        <Link
          href={href}
          className="whitespace-nowrap text-xs font-bold text-text-muted transition-colors hover:text-foreground"
        >
          View recommendations →
        </Link>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-surface px-6 py-4 shadow-sm transition-colors hover:border-accent-primary"
    >
      <div>
        <p className="text-sm font-bold text-foreground">
          {count} {platform} recommendation{count !== 1 ? "s" : ""}
        </p>
        {impact.netMonthlyBenefit > 0 && (
          <p className="mt-0.5 text-xs text-text-muted">
            {currencySymbol()}{impact.netMonthlyBenefit.toLocaleString()} net monthly benefit
            {impact.autoCount > 0 ? ` · ${impact.autoCount} auto-actionable` : ""}
          </p>
        )}
      </div>
      <span className="whitespace-nowrap text-xs font-bold text-accent-primary">
        View recommendations →
      </span>
    </Link>
  );
}
