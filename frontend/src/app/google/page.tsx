"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DatePicker } from "@/components/ui/DatePicker";
import { DateRangeSelection } from "@/lib/date-range";
import { fetchDashboardData } from "@/lib/dashboard-refresh";
import React, { useEffect, useState } from "react";

// ─── helpers ────────────────────────────────────────────────────────────────
function fmt(n: number, decimals = 0) {
  return n.toLocaleString("en-MY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtMYR(n: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR" }).format(n);
}
function fmtPct(n: number) {
  return `${n.toFixed(2)}%`;
}
function asPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return n > 1 ? n : n * 100;
}
function fmtMaybeMYR(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? fmtMYR(parsed) : <span className="text-text-muted">-</span>;
}
function fmtMaybePct(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? fmtPct(asPct(parsed)) : <span className="text-text-muted">-</span>;
}
function fmtEnum(value: unknown) {
  return String(value || "-")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
function truncateUrl(value: unknown) {
  const text = String(value || "-");
  if (text.length <= 64) return text;
  return `${text.slice(0, 58)}...`;
}
function isTrendValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// ─── shared components ───────────────────────────────────────────────────────
function SectionCard({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface shadow-sm rounded-2xl border border-border/60 overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        {description && <p className="text-xs text-text-muted mt-0.5">{description}</p>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

type TableRow = Record<string, any>;

function DetailTable({ headers, rows }: {
  headers: { label: string; key: string; align?: "left" | "right"; render?: (v: any, row: TableRow) => React.ReactNode }[];
  rows: TableRow[];
}) {
  if (!rows.length) return <p className="p-6 text-sm text-text-muted italic">No data available.</p>;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border/60">
          {headers.map(h => (
            <th key={h.key} className={`px-4 py-3 font-semibold text-text-muted uppercase tracking-wide bg-surface-hover ${h.align === "right" ? "text-right" : "text-left"}`}>
              {h.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-b border-border/40 hover:bg-surface-hover/50 transition-colors">
            {headers.map(h => (
              <td key={h.key} className={`px-4 py-3 ${h.align === "right" ? "text-right tabular-nums" : ""}`}>
                {h.render ? h.render(row[h.key], row) : row[h.key] ?? "—"}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function KpiStrip({ items }: { items: { label: string; value: string; sub?: string; highlight?: "good" | "warn" | "bad" }[] }) {
  const colorMap = { good: "text-green-600", warn: "text-amber-600", bad: "text-red-500" };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map((item, i) => (
        <div key={i} className="bg-surface rounded-2xl border border-border/60 p-4 text-center">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">{item.label}</p>
          <p className={`text-xl font-bold ${item.highlight ? colorMap[item.highlight] : "text-foreground"}`}>{item.value}</p>
          {item.sub && <p className="text-[10px] text-text-muted mt-0.5">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

function InsightCard({ insight }: { insight: any }) {
  const colorMap: Record<string, string> = {
    warning: "border-l-amber-500 bg-amber-50",
    success: "border-l-green-500 bg-green-50",
    info: "border-l-blue-500 bg-blue-50",
    critical: "border-l-red-500 bg-red-50",
  };
  return (
    <div className={`border-l-4 rounded-r-xl p-4 ${colorMap[insight.type] || colorMap.info}`}>
      <p className="text-sm font-bold text-foreground mb-1">{insight.title}</p>
      <p className="text-xs text-text-muted leading-relaxed">{insight.description}</p>
    </div>
  );
}

function StatusPill({ value }: { value: unknown }) {
  const status = String(value || "UNKNOWN").toUpperCase();
  const isActive = status === "ACTIVE" || status === "ENABLED";
  const isPaused = status === "PAUSED";
  const className = isActive
    ? "bg-green-100 text-green-700"
    : isPaused
    ? "bg-amber-100 text-amber-700"
    : "bg-surface-hover text-text-muted";
  return <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${className}`}>{fmtEnum(status)}</span>;
}

// ─── page ────────────────────────────────────────────────────────────────────
export default function GoogleAdsPage() {
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingRange, setRefreshingRange] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData()
      .then(json => { setD(json); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  async function handleRangeChange(range: DateRangeSelection) {
    if (!d) return;

    setRefreshingRange(true);
    setRefreshError(null);
    const clientName = d.client_name;

    try {
      const nextData = await fetchDashboardData(clientName, range);
      setD(nextData);
      setRefreshError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load Google Ads date range.";
      setRefreshError(
        message.includes("(409)")
          ? "This date range is not available in the fast cache yet. It will become available after the scheduled data sync runs."
          : message,
      );
    } finally {
      setRefreshingRange(false);
    }
  }

  if (loading) return (
    <DashboardLayout>
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-lime border-t-accent-primary" />
          <p className="text-sm text-text-muted">Loading Google Ads data...</p>
        </div>
      </div>
    </DashboardLayout>
  );

  if (error || !d) return (
    <DashboardLayout>
      <div className="flex h-[60vh] items-center justify-center">
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-100 text-center max-w-md">
          <p className="text-sm">{error || "Could not load data."}</p>
          <button onClick={() => window.location.reload()} className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold">Retry</button>
        </div>
      </div>
    </DashboardLayout>
  );

  const googleCampaigns = (d.campaigns || []).filter((c: any) => c.platform === "Google");
  const searchQueries: any[] = d.search_queries || [];
  const geoGoogle: any[] = d.geo_performance || [];
  const keywords: any[] = d.keywords || [];
  const adGroups: any[] = d.ad_groups || [];
  const googleAds: any[] = d.google_ads || [];
  const insights: any[] = d.insights || [];
  const recommendations: any[] = (d.recommendations || []).filter((r: any) => r.platform !== "Meta");
  const budgetPacing = d.budget_pacing || {};
  const landingHeatmap = d.landing_page_heatmap || {};
  const qualityRoadmap = d.quality_score_roadmap || {};
  const searchAnalysis = d.search_query_analysis || {};
  const googleTime = d.google_time_performance || {};
  const googleDevice = d.google_device_performance || {};
  const negativeKeywords: any[] = d.google_negative_keywords || [];
  const trends = d.trends || {};
  const trendItems = [
    { label: "Spend Change", key: "spend_change" },
    { label: "Conversions Change", key: "conversions_change" },
    { label: "CPA Change", key: "cpa_change" },
    { label: "Quality Score Change", key: "quality_score_change" },
  ].filter(t => isTrendValue(trends[t.key]));

  const gSpend = googleCampaigns.reduce((s: number, c: any) => s + (c.spend || 0), 0);
  const gConversions = googleCampaigns.reduce((s: number, c: any) => s + (c.conversions || 0), 0);
  const gCPA = gConversions > 0 ? gSpend / gConversions : 0;
  const gClicks = googleCampaigns.reduce((s: number, c: any) => s + (c.clicks || 0), 0);
  const gImpressions = googleCampaigns.reduce((s: number, c: any) => s + (c.impressions || 0), 0);
  const avgQS = keywords.length > 0
    ? keywords.filter((k: any) => k.quality_score).reduce((s: number, k: any) => s + k.quality_score, 0) / keywords.filter((k: any) => k.quality_score).length
    : null;

  // Performers
  const topPerformers = [...googleCampaigns].filter((c: any) => c.conversions > 0).sort((a, b) => a.cpa - b.cpa).slice(0, 3);
  const underperformers = [...googleCampaigns].filter((c: any) => c.spend > 10 && c.conversions === 0).sort((a, b) => b.spend - a.spend).slice(0, 3);
  const landingRows: any[] = Array.isArray(landingHeatmap.heatmap) ? landingHeatmap.heatmap : [];
  const landingIssues: any[] = Array.isArray(landingHeatmap.issues) ? landingHeatmap.issues : [];
  const qsPlans: any[] = Array.isArray(qualityRoadmap.improvement_plan) ? qualityRoadmap.improvement_plan : [];
  const qsSamples: any[] = Array.isArray(qualityRoadmap.affected_keywords_sample) ? qualityRoadmap.affected_keywords_sample : [];
  const searchWasteRows: any[] = Array.isArray(searchAnalysis.wasted_spend_queries) ? searchAnalysis.wasted_spend_queries : [];
  const negativeSuggestionRows: any[] = Array.isArray(searchAnalysis.negative_keyword_suggestions) ? searchAnalysis.negative_keyword_suggestions : [];
  const hourlyRows: any[] = Array.isArray(googleTime.hourly_performance) ? googleTime.hourly_performance : [];
  const dailyRows: any[] = Array.isArray(googleTime.daily_performance) ? googleTime.daily_performance : [];
  const deviceRows: any[] = Array.isArray(googleDevice.devices) ? googleDevice.devices : [];
  const geoSummary = d.google_geo_analysis?.summary || {};

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">

        {/* Header */}
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Google Ads</h1>
            <p className="text-sm text-text-muted mt-1">
              Search &amp; display performance for <strong className="text-foreground">{d.account_name || d.client_name || "Selected client"}</strong>
              {d.date_range ? ` · ${d.date_range.start_date || ""} to ${d.date_range.end_date || ""}` : ""}
            </p>
          </div>
          <DatePicker
            currentRange={d.date_range}
            loading={refreshingRange}
            onRangeChange={handleRangeChange}
          />
        </div>

        {refreshError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {refreshError}
          </div>
        )}

        {/* ── KPI Strip ── */}
        <KpiStrip items={[
          { label: "Total Spend", value: fmtMYR(gSpend) },
          { label: "Conversions", value: fmt(gConversions), sub: `CPA: ${fmtMYR(gCPA)}` },
          { label: "Clicks", value: fmt(gClicks), sub: `CPC: ${fmtMYR(gClicks > 0 ? gSpend / gClicks : 0)}` },
          { label: "Impressions", value: fmt(gImpressions) },
          { label: "CTR", value: fmtPct(gImpressions > 0 ? (gClicks / gImpressions) * 100 : 0) },
          { label: "Avg Quality Score", value: avgQS ? avgQS.toFixed(1) : "—", highlight: avgQS && avgQS >= 7 ? "good" : avgQS && avgQS >= 5 ? "warn" : "bad" },
        ]} />

        {/* ── Trends ── */}
        {trendItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {trendItems.map(t => (
              <div key={t.key} className="bg-surface rounded-2xl border border-border/60 p-4 text-center">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-1">{t.label}</p>
                <p className={`text-lg font-bold ${trends[t.key] > 0 ? "text-green-600" : trends[t.key] < 0 ? "text-red-500" : "text-foreground"}`}>
                  {trends[t.key] > 0 ? "+" : ""}{trends[t.key].toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── AI Insights ── */}
        {insights.length > 0 && (
          <SectionCard title="AI Insights Summary">
            <div className="flex flex-col gap-3 p-4">
              {insights.map((ins: any, i: number) => <InsightCard key={i} insight={ins} />)}
            </div>
          </SectionCard>
        )}

        {d.conversion_value_alert && (
          <SectionCard title="Conversion Value Tracking">
            <div className="p-4">
              <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">{d.conversion_value_alert.issue}</p>
                <p className="mt-1 text-xs leading-relaxed text-red-700/80">{d.conversion_value_alert.description}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {budgetPacing.days_in_period && (
          <SectionCard title="Budget Pacing" description="Spend rate and projected monthly spend from the selected Google Ads period.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Daily Avg Spend</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmtMYR(budgetPacing.daily_avg_spend || 0)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Projected Monthly</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmtMYR(budgetPacing.projected_monthly_spend || 0)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Days Analysed</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmt(budgetPacing.days_in_period || 0)}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {(searchAnalysis.total_queries || searchWasteRows.length > 0 || negativeSuggestionRows.length > 0) && (
          <SectionCard title="Search Term Intelligence" description="Waste, intent gaps, and negative-keyword opportunities from actual user searches.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Queries Analysed</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmt(searchAnalysis.total_queries || searchQueries.length)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Wasted Spend</p>
                <p className="mt-1 text-xl font-bold text-red-500">{fmtMYR(searchAnalysis.total_wasted_spend || 0)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Negative Ideas</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmt(negativeSuggestionRows.length)}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {(qualityRoadmap.total_low_qs || qsPlans.length > 0 || qsSamples.length > 0) && (
          <SectionCard title="Quality Score Roadmap" description="Where lower ad relevance, expected CTR, or landing-page experience is likely increasing CPC.">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4">
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Low Quality Score Keywords</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmt(qualityRoadmap.total_low_qs || 0)}</p>
                {qualityRoadmap.expected_impact && (
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">{qualityRoadmap.expected_impact}</p>
                )}
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Spend Affected</p>
                <p className="mt-1 text-xl font-bold text-foreground">{fmtMYR(qualityRoadmap.total_spend_low_qs || 0)}</p>
                {qualityRoadmap.avg_quality_score && (
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">Average low QS: {Number(qualityRoadmap.avg_quality_score).toFixed(1)}/10</p>
                )}
              </div>
            </div>
            {qsPlans.length > 0 && (
              <div className="border-t border-border/60">
                <DetailTable
                  headers={[
                    { label: "Issue", key: "issue" },
                    { label: "Priority", key: "priority", render: (v) => <StatusPill value={v} /> },
                    { label: "Keywords", key: "affected_keywords", align: "right", render: (v) => fmt(v) },
                    { label: "Expected Impact", key: "expected_impact" },
                    { label: "Time", key: "estimated_time" },
                  ]}
                  rows={qsPlans}
                />
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Top Performers & Issues ── */}
        {(topPerformers.length > 0 || underperformers.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {topPerformers.length > 0 && (
              <SectionCard title="Top Performers">
                <DetailTable
                  headers={[
                    { label: "Campaign", key: "name" },
                    { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                    { label: "Spend", key: "spend", align: "right", render: (v) => fmtMYR(v) },
                    { label: "CPA", key: "cpa", align: "right", render: (v) => <span className="font-semibold text-green-600">{fmtMYR(v)}</span> },
                  ]}
                  rows={topPerformers}
                />
              </SectionCard>
            )}
            {underperformers.length > 0 && (
              <SectionCard title="Issues & Underperformers" description="High spend, zero conversions.">
                <DetailTable
                  headers={[
                    { label: "Campaign", key: "name" },
                    { label: "Spend", key: "spend", align: "right", render: (v) => <span className="font-semibold text-red-500">{fmtMYR(v)}</span> },
                    { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                    { label: "Conv", key: "conversions", align: "right", render: (v) => <span className="text-red-500 font-bold">{v}</span> },
                  ]}
                  rows={underperformers}
                />
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Campaign Performance ── */}
        <SectionCard title="Campaign Performance">
          <DetailTable
            headers={[
              { label: "Campaign", key: "name" },
              { label: "Status", key: "status", render: (v) => <StatusPill value={v} /> },
              { label: "Daily Budget", key: "daily_budget", align: "right", render: (v) => fmtMaybeMYR(v) },
              { label: "Spend", key: "spend", align: "right", render: (v) => fmtMYR(v) },
              { label: "Impr.", key: "impressions", align: "right", render: (v) => fmt(v) },
              { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
              { label: "CTR", key: "ctr", align: "right", render: (v) => v ? fmtPct(asPct(v)) : "—" },
              { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
              { label: "CPA", key: "cpa", align: "right", render: (v) => v > 0 ? fmtMYR(v) : <span className="text-text-muted">—</span> },
            ]}
            rows={googleCampaigns}
          />
        </SectionCard>

        {adGroups.length > 0 && (
          <SectionCard title={`Ad Group Performance (${adGroups.length})`} description="Ad group evidence for budget, keyword, and ad-copy decisions.">
            <DetailTable
              headers={[
                { label: "Ad Group", key: "ad_group_name" },
                { label: "Campaign", key: "campaign_name" },
                { label: "Status", key: "status", render: (v) => <StatusPill value={v} /> },
                { label: "Spend", key: "spend", align: "right", render: (v) => fmtMYR(v) },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "CTR", key: "ctr", align: "right", render: (v) => fmtMaybePct(v) },
                { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                { label: "CPA", key: "cpa", align: "right", render: (v) => fmtMaybeMYR(v) },
              ]}
              rows={adGroups}
            />
          </SectionCard>
        )}

        {/* ── Keywords ── */}
        {keywords.length > 0 && (
          <SectionCard title={`Keywords (${keywords.length})`} description="Keyword-level performance including Quality Scores.">
            <DetailTable
              headers={[
                { label: "Keyword", key: "keyword" },
                { label: "Campaign", key: "campaign" },
                { label: "Ad Group", key: "ad_group_name" },
                { label: "Status", key: "status", render: (v) => <StatusPill value={v} /> },
                { label: "Impr.", key: "impressions", align: "right", render: (v) => fmt(v) },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "CTR", key: "ctr", align: "right", render: (v) => fmtPct(asPct(v)) },
                { label: "Avg CPC", key: "avg_cpc", align: "right", render: (v) => fmtMYR(v) },
                { label: "Cost", key: "cost", align: "right", render: (v) => fmtMYR(v) },
                { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                { label: "CPA", key: "cpa", align: "right", render: (v) => fmtMaybeMYR(v) },
                { label: "QS", key: "quality_score", align: "right", render: (v) => v != null
                  ? <span className={`font-bold ${v >= 7 ? "text-green-600" : v >= 5 ? "text-amber-600" : "text-red-500"}`}>{v}/10</span>
                  : <span className="text-text-muted">—</span>
                },
              ]}
              rows={keywords}
            />
          </SectionCard>
        )}

        {/* ── Search Query Performance ── */}
        {searchQueries.length > 0 && (
          <SectionCard title={`Search Query Report (${searchQueries.length} queries)`} description="Actual search terms that triggered your ads.">
            <DetailTable
              headers={[
                { label: "Search Query", key: "query" },
                { label: "Campaign", key: "campaign" },
                { label: "Ad Group", key: "ad_group_name" },
                { label: "Match", key: "match_type", render: (v) => fmtEnum(v) },
                { label: "Status", key: "status", render: (v) => <StatusPill value={v} /> },
                { label: "Impr.", key: "impressions", align: "right", render: (v) => fmt(v) },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "CTR", key: "ctr", align: "right", render: (v) => fmtPct(asPct(v)) },
                { label: "Cost", key: "cost", align: "right", render: (v) => fmtMYR(v) },
                { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                { label: "CPA", key: "cpa", align: "right", render: (v, row) => row.conversions > 0 ? fmtMYR(v) : <span className="text-text-muted">—</span> },
              ]}
              rows={searchQueries}
            />
          </SectionCard>
        )}

        {searchWasteRows.length > 0 && (
          <SectionCard title="Wasted Search Terms" description="Searches with zero conversions and enough spend to justify negative-keyword review.">
            <DetailTable
              headers={[
                { label: "Search Term", key: "search_term" },
                { label: "Campaign", key: "campaign_name" },
                { label: "Ad Group", key: "ad_group_name" },
                { label: "Cost", key: "cost", align: "right", render: (v) => <span className="font-semibold text-red-500">{fmtMYR(v)}</span> },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "Impr.", key: "impressions", align: "right", render: (v) => fmt(v) },
              ]}
              rows={searchWasteRows}
            />
          </SectionCard>
        )}

        {negativeSuggestionRows.length > 0 && (
          <SectionCard title="Negative Keyword Candidates" description="Pattern-based negatives detected from wasted search-term evidence.">
            <DetailTable
              headers={[
                { label: "Negative Keyword", key: "negative_keyword" },
                { label: "Match", key: "match_type", render: (v) => fmtEnum(v) },
                { label: "Example Query", key: "example_query" },
                { label: "Campaign", key: "campaign_name" },
                { label: "Wasted Spend", key: "wasted_spend", align: "right", render: (v) => fmtMYR(v) },
              ]}
              rows={negativeSuggestionRows}
            />
          </SectionCard>
        )}

        {/* ── Geographic Performance ── */}
        {geoGoogle.length > 0 && (
          <SectionCard title="Geographic Performance" description="Performance by location targeting radius.">
            <DetailTable
              headers={[
                { label: "Location", key: "location_name" },
                { label: "Campaign", key: "campaign_name" },
                { label: "Impr.", key: "impressions", align: "right", render: (v) => fmt(v) },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "CTR", key: "ctr", align: "right", render: (v) => fmtPct(asPct(v)) },
                { label: "Cost", key: "cost", align: "right", render: (v) => fmtMYR(v) },
                { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
              ]}
              rows={geoGoogle}
            />
          </SectionCard>
        )}

        {(geoSummary.best_location || geoSummary.total_spend || geoSummary.total_conversions) && (
          <SectionCard title="Geographic Summary" description="Aggregated Google location findings used for geo recommendations.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Best Location</p>
                <p className="mt-1 text-lg font-bold text-foreground">{geoSummary.best_location || "-"}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Geo Spend</p>
                <p className="mt-1 text-lg font-bold text-foreground">{fmtMYR(geoSummary.total_spend || 0)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-surface-hover p-4">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Geo Conversions</p>
                <p className="mt-1 text-lg font-bold text-foreground">{fmt(geoSummary.total_conversions || 0)}</p>
              </div>
            </div>
          </SectionCard>
        )}

        {deviceRows.length > 0 && (
          <SectionCard title="Device Performance" description="Mobile, desktop, and tablet performance from Google Ads device segmentation.">
            <DetailTable
              headers={[
                { label: "Device", key: "device", render: (v) => fmtEnum(v) },
                { label: "Campaigns", key: "campaign_count", align: "right", render: (v) => fmt(v) },
                { label: "Impr.", key: "impressions", align: "right", render: (v) => fmt(v) },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "CTR", key: "ctr", align: "right", render: (v) => fmtMaybePct(v) },
                { label: "Cost", key: "cost", align: "right", render: (v) => fmtMYR(v) },
                { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                { label: "Conv Rate", key: "conversion_rate", align: "right", render: (v) => fmtMaybePct(v) },
                { label: "CPA", key: "cost_per_conversion", align: "right", render: (v) => fmtMaybeMYR(v) },
              ]}
              rows={deviceRows}
            />
          </SectionCard>
        )}

        {landingRows.length > 0 && (
          <SectionCard title={`Landing Page Heatmap (${landingHeatmap.total_landing_pages || landingRows.length})`} description="Landing pages mapped to keyword/ad-group traffic, conversion rate, and CPA.">
            {landingIssues.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4">
                {landingIssues.map((issue, i) => (
                  <div key={i} className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-amber-800">{issue.issue}</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-700">{issue.description}</p>
                    <p className="mt-2 text-xs font-semibold text-amber-800">{issue.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
            <DetailTable
              headers={[
                { label: "Landing Page", key: "landing_page", render: (v) => <span title={String(v || "")}>{truncateUrl(v)}</span> },
                { label: "Keywords", key: "keywords_count", align: "right", render: (v) => fmt(v) },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "Cost", key: "cost", align: "right", render: (v) => fmtMYR(v) },
                { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                { label: "Conv Rate", key: "conversion_rate", align: "right", render: (v) => fmtMaybePct(v) },
                { label: "CPA", key: "cost_per_conversion", align: "right", render: (v) => fmtMaybeMYR(v) },
              ]}
              rows={landingRows}
            />
          </SectionCard>
        )}

        {googleAds.length > 0 && (
          <SectionCard title={`Responsive Search Ads (${googleAds.length})`} description="Ad-level performance, status, landing URL, and first headline for copy analysis.">
            <DetailTable
              headers={[
                { label: "Headline", key: "headlines", render: (v) => Array.isArray(v) ? (v[0] || "-") : "-" },
                { label: "Ad Group", key: "ad_group_name" },
                { label: "Campaign", key: "campaign_name" },
                { label: "Status", key: "status", render: (v) => <StatusPill value={v} /> },
                { label: "Final URL", key: "final_urls", render: (v) => <span title={Array.isArray(v) ? v[0] : ""}>{truncateUrl(Array.isArray(v) ? v[0] : "")}</span> },
                { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                { label: "CTR", key: "ctr", align: "right", render: (v) => fmtMaybePct(v) },
                { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
              ]}
              rows={googleAds}
            />
          </SectionCard>
        )}

        {negativeKeywords.length > 0 && (
          <SectionCard title={`Negative Keyword Inventory (${negativeKeywords.length})`} description="Existing campaign and ad-group negatives used to prevent duplicate recommendations.">
            <DetailTable
              headers={[
                { label: "Keyword", key: "keyword" },
                { label: "Level", key: "level", render: (v) => fmtEnum(v) },
                { label: "Match", key: "match_type", render: (v) => fmtEnum(v) },
                { label: "Campaign", key: "campaign_name" },
                { label: "Ad Group", key: "ad_group_name", render: (v) => v || "-" },
                { label: "Status", key: "status", render: (v) => <StatusPill value={v} /> },
              ]}
              rows={negativeKeywords}
            />
          </SectionCard>
        )}

        {(hourlyRows.length > 0 || dailyRows.length > 0) && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {hourlyRows.length > 0 && (
              <SectionCard title="Hour of Day Performance" description="Aggregated by hour across enabled Google campaigns in the selected range.">
                <DetailTable
                  headers={[
                    { label: "Hour", key: "hour_label" },
                    { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                    { label: "Cost", key: "cost", align: "right", render: (v) => fmtMYR(v) },
                    { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                    { label: "Conv Rate", key: "conversion_rate", align: "right", render: (v) => fmtMaybePct(v) },
                    { label: "CPA", key: "cost_per_conversion", align: "right", render: (v) => fmtMaybeMYR(v) },
                  ]}
                  rows={hourlyRows}
                />
              </SectionCard>
            )}
            {dailyRows.length > 0 && (
              <SectionCard title="Day of Week Performance" description="Best and weakest days by conversions and CPA.">
                <DetailTable
                  headers={[
                    { label: "Day", key: "day" },
                    { label: "Clicks", key: "clicks", align: "right", render: (v) => fmt(v) },
                    { label: "Cost", key: "cost", align: "right", render: (v) => fmtMYR(v) },
                    { label: "Conv", key: "conversions", align: "right", render: (v) => fmt(v) },
                    { label: "Conv Rate", key: "conversion_rate", align: "right", render: (v) => fmtMaybePct(v) },
                    { label: "CPA", key: "cost_per_conversion", align: "right", render: (v) => fmtMaybeMYR(v) },
                  ]}
                  rows={dailyRows}
                />
              </SectionCard>
            )}
          </div>
        )}

        {/* ── Recommendations ── */}
        {recommendations.length > 0 && (
          <SectionCard title={`Optimization Recommendations (${recommendations.length})`} description="Actionable recommendations. Apply these to improve performance.">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
              {recommendations.map((rec: any, i: number) => (
                <div key={i} className="border border-border/60 rounded-xl p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-foreground">{rec.title}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      rec.impact === "High" ? "bg-red-100 text-red-600" :
                      rec.impact === "Medium" ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                    }`}>{rec.impact}</span>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">{rec.description}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

      </div>
    </DashboardLayout>
  );
}
