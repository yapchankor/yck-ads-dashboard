"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import React, { useEffect, useState } from "react";
import { DashboardMetrics, Recommendation } from "@/lib/types";

type TrackedRecommendation = {
  recommendation_id?: string;
  action_type?: string;
  platform?: string;
  keyword?: string;
  target_id?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  ad_name?: string;
  segment?: string;
  placement?: string;
  location?: string;
  normalized_key?: string;
  status?: string;
};

function normalizeMatchValue(value: unknown) {
  return String(value || "")
    .replace(/["']/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function recommendationMatchKey(rec: Recommendation | TrackedRecommendation) {
  const actionType = normalizeMatchValue("actionType" in rec ? rec.actionType : rec.action_type);
  const platform = normalizeMatchValue(rec.platform);
  const subject = normalizeMatchValue(rec.keyword || rec.segment || rec.placement || rec.location || rec.ad_id || rec.ad_name);
  const target = normalizeMatchValue(
    "ad_group_name" in rec
      ? rec.target_id || rec.adset_id || rec.ad_id || rec.ad_group_name
      : rec.target_id || rec.adset_id || rec.ad_id,
  );
  const campaign = normalizeMatchValue("campaignName" in rec ? rec.campaign_id || rec.campaignName : rec.campaign_id);

  if (actionType && subject) return `${platform}|${actionType}|subject:${subject}|target:${target}|campaign:${campaign}`;
  if (actionType && target) return `${platform}|${actionType}|target:${target}|campaign:${campaign}`;
  if (actionType && campaign) return `${platform}|${actionType}|campaign:${campaign}`;
  return "";
}

function recommendationFallbackKey(rec: Recommendation | TrackedRecommendation) {
  const actionType = normalizeMatchValue("actionType" in rec ? rec.actionType : rec.action_type);
  const platform = normalizeMatchValue(rec.platform);
  const subject = normalizeMatchValue(rec.keyword || rec.segment || rec.placement || rec.location || rec.ad_id || rec.ad_name);
  return actionType && subject ? `${platform}|${actionType}|subject:${subject}` : "";
}

function removeTrackedRecommendations(recommendations: Recommendation[], trackedItems: TrackedRecommendation[]) {
  const activeTrackedItems = trackedItems.filter((item) => item.status !== "Failed");
  const trackedIds = new Set(activeTrackedItems.map((item) => item.recommendation_id).filter(Boolean));
  const trackedKeys = new Set(
    activeTrackedItems
      .flatMap((item) => [item.normalized_key, recommendationMatchKey(item), recommendationFallbackKey(item)])
      .filter(Boolean),
  );

  return recommendations.filter((rec) => (
    rec.guardrail_status !== "suppressed" &&
    !trackedIds.has(rec.recommendation_id || rec.id) &&
    !trackedKeys.has(rec.normalized_key || "") &&
    !trackedKeys.has(recommendationMatchKey(rec)) &&
    !trackedKeys.has(recommendationFallbackKey(rec))
  ));
}

// ── Impact aggregation ──────────────────────────────────────────────────────
// Uses structured impact_data fields written by the backend (same source as HTML reports).
// Applies 70% moderate-confidence factor — matching calculate_total_impact.py.

const CONFIDENCE_FACTOR = 0.7;

type PlatformImpact = {
  monthlySavings: number;
  additionalConversions: number;
  additionalRevenue: number;
  netMonthlyBenefit: number;
  autoCount: number;
  manualCount: number;
};

function computePlatformImpact(recs: Recommendation[]): PlatformImpact {
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

// ── Platform icons ──────────────────────────────────────────────────────────

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MetaIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" xmlns="http://www.w3.org/2000/svg" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

// ── Total Impact Card ───────────────────────────────────────────────────────

function TotalImpactCard({ impact, recCount }: { impact: PlatformImpact; recCount: number }) {
  const items = [
    impact.monthlySavings > 0 && {
      label: "Monthly Savings",
      value: `RM ${impact.monthlySavings.toLocaleString()}`,
      sub: "From eliminating waste",
    },
    impact.additionalConversions > 0 && {
      label: "Additional Conversions",
      value: impact.additionalConversions.toLocaleString(),
      sub: "Monthly projection",
    },
    impact.additionalRevenue > 0 && {
      label: "Additional Revenue",
      value: `RM ${impact.additionalRevenue.toLocaleString()}`,
      sub: "From scaling winners",
    },
    impact.netMonthlyBenefit > 0 && {
      label: "Net Monthly Benefit",
      value: `RM ${impact.netMonthlyBenefit.toLocaleString()}`,
      sub: "Total value unlock",
    },
  ].filter(Boolean) as { label: string; value: string; sub: string }[];

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl p-5 mb-5">
      <div className="flex items-start justify-between flex-wrap gap-2 border-b border-white/20 pb-3 mb-4">
        <div>
          <h3 className="text-sm font-bold text-white">Total Expected Impact</h3>
          <p className="text-xs text-white/75 mt-0.5">
            {recCount} recommendation{recCount !== 1 ? "s" : ""} · moderate confidence (70%)
          </p>
        </div>
        <p className="text-xs text-white/80 bg-white/10 rounded-lg px-3 py-1.5 font-medium whitespace-nowrap">
          {impact.autoCount} auto-actionable · {impact.manualCount} manual required
        </p>
      </div>
      <div className={`grid gap-3 ${items.length <= 2 ? "grid-cols-2" : items.length === 3 ? "grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
        {items.map((item) => (
          <div key={item.label} className="bg-white/15 rounded-xl p-3">
            <p className="text-[11px] text-white/70 mb-1 leading-tight">{item.label}</p>
            <p className="text-xl font-bold text-white leading-tight">{item.value}</p>
            <p className="text-[10px] text-white/60 mt-1">{item.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function RecommendationsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [clientName, setClientName] = useState<string | undefined>();
  const [baselineMetrics, setBaselineMetrics] = useState<DashboardMetrics | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [response, trackingResponse] = await Promise.all([
          fetch("/api/data"),
          fetch("/api/tracking"),
        ]);
        if (!response.ok) throw new Error("Failed to fetch recommendations");
        const data = await response.json();
        const trackedItems = trackingResponse.ok ? await trackingResponse.json() : [];
        setRecommendations(removeTrackedRecommendations(data.recommendations || [], trackedItems));
        setClientName(data.client_name);
        setBaselineMetrics(data.metrics);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-lime border-t-accent-primary"></div>
            <p className="text-sm font-medium text-text-muted">Analyzing your ad performance...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const allRecs = recommendations || [];
  const googleRecs = allRecs.filter(r => r.platform === "Google");
  const metaRecs = allRecs.filter(r => r.platform === "Meta");
  const googleImpact = computePlatformImpact(googleRecs);
  const metaImpact = computePlatformImpact(metaRecs);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-8 pb-10">

        {/* Header */}
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Recommendations Engine</h1>
          <p className="text-sm font-medium text-text-muted mt-1">
            AI-driven actionable insights across your ad accounts.
            {allRecs.length > 0 && (
              <span className="ml-2 text-foreground font-semibold">{allRecs.length} total recommendations</span>
            )}
          </p>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-100 text-center">
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* ── Google Ads Section ── */}
            <section className="flex flex-col gap-0">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                  <GoogleIcon />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">Google Ads</h2>
                  <p className="text-xs text-text-muted">
                    {googleRecs.length} recommendation{googleRecs.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {googleRecs.length > 0 ? (
                <>
                  <TotalImpactCard impact={googleImpact} recCount={googleRecs.length} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {googleRecs.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        recommendation={rec}
                        clientName={clientName}
                        baselineMetrics={baselineMetrics}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl">
                  <p className="text-text-muted font-medium text-sm">No Google Ads recommendations right now.</p>
                </div>
              )}
            </section>

            {/* ── Meta Ads Section ── */}
            <section className="flex flex-col gap-0">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                  <MetaIcon />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground leading-tight">Meta Ads</h2>
                  <p className="text-xs text-text-muted">
                    {metaRecs.length} recommendation{metaRecs.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {metaRecs.length > 0 ? (
                <>
                  <TotalImpactCard impact={metaImpact} recCount={metaRecs.length} />
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {metaRecs.map((rec) => (
                      <RecommendationCard
                        key={rec.id}
                        recommendation={rec}
                        clientName={clientName}
                        baselineMetrics={baselineMetrics}
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-border rounded-2xl">
                  <p className="text-text-muted font-medium text-sm">No Meta Ads recommendations right now.</p>
                </div>
              )}
            </section>

            {allRecs.length === 0 && (
              <div className="py-20 text-center border-2 border-dashed border-border rounded-3xl">
                <p className="text-text-muted font-medium">No recommendations available right now.</p>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
