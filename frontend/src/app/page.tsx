"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { UnifiedMetricsCard, AnomalyAlert } from "@/components/ui/UnifiedMetricsCard";
import { DataTable } from "@/components/ui/DataTable";
import { DatePicker } from "@/components/ui/DatePicker";
import React, { useEffect, useState } from "react";
import { DashboardData } from "@/lib/types";
import { mockMetrics, mockRecommendations, mockCampaigns } from "@/lib/mock-data";
import { RefreshCcw } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DateRangeSelection, normalizeDashboardDateRange } from "@/lib/date-range";
import { fetchDashboardData, triggerDashboardRefresh } from "@/lib/dashboard-refresh";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingRange, setRefreshingRange] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<"All" | "Google" | "Meta">("All");

  useEffect(() => {
    async function fetchData() {
      try {
        const jsonData = await fetchDashboardData();
        setData({ ...jsonData, isLive: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        if (message.includes("404")) {
          // Fallback to mock data if live data is still generating
          console.warn("Live data not found, using mock fallback during sync");
          setData({
            metrics: mockMetrics,
            recommendations: mockRecommendations,
            campaigns: mockCampaigns,
            isLive: false,
            client_name: "Mock Client",
            account_name: "Mock Client",
          });
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  async function handleRangeChange(range: DateRangeSelection) {
    if (!data) return;

    setRefreshingRange(true);
    setRefreshError(null);
    const clientName = data.client_name;

    try {
      const nextData = await fetchDashboardData(clientName, range);
      setData({ ...nextData, isLive: true });
      setRefreshError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard date range.";
      setRefreshError(
        message.includes("(409)")
          ? "This date range is not available in the fast cache yet. It will become available after the scheduled data sync runs."
          : message,
      );
    } finally {
      setRefreshingRange(false);
    }
  }

  async function handleSync() {
    if (!data || syncing) return;
    setSyncing(true);
    setSyncWarning(null);
    const clientName = data.client_name;
    const baselineFetchedAt = data.fetched_at ?? null;
    const range: DateRangeSelection = normalizeDashboardDateRange(data.date_range);

    try {
      await triggerDashboardRefresh({ range, clientName });
      setSyncWarning("Sync started — refreshing 90 days of data. Takes 5–10 min. This page will update automatically.");
    } catch {
      setSyncWarning("Could not trigger sync. Try again.");
      setSyncing(false);
      return;
    }

    setSyncing(false);

    // Background poll — silently update when the refresh lands
    (async () => {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 15_000));
        try {
          const fresh = await fetchDashboardData(clientName);
          if (fresh?.fetched_at && fresh.fetched_at !== baselineFetchedAt) {
            setData({ ...fresh, isLive: true });
            setSyncWarning(null);
            return;
          }
        } catch {
          // ignore, keep polling
        }
      }
    })();
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-lime border-t-accent-primary"></div>
            <p className="text-sm font-medium text-text-muted">Connecting to ad accounts...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error || !data) {
    return (
      <DashboardLayout>
        <div className="flex h-[80vh] items-center justify-center">
          <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-100 max-w-md text-center">
            <h2 className="text-lg font-bold mb-2">Error Loading Dashboard</h2>
            <p className="text-sm mb-4">{error || "Could not retrieve data."}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold"
            >
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Dynamic Filtering Calculations
  const filteredCampaigns = platformFilter === "All" 
    ? data.campaigns 
    : data.campaigns.filter(c => c.platform === platformFilter);

  const dynamicMetrics = platformFilter === "All" ? data.metrics : (() => {
    const totalSpend = filteredCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
    const totalConversions = filteredCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);
    return {
      totalSpend,
      totalConversions,
      blendedCPA: totalConversions > 0 ? totalSpend / totalConversions : 0,
      blendedROAS: data.metrics.blendedROAS,
      spendDelta: data.metrics.spendDelta, // Keep global deltas for now
      cpaDelta: data.metrics.cpaDelta,
      dateRange: data.metrics.dateRange,
    };
  })();
  const cpaLabel = platformFilter === "All" ? "Blended CPA" : `${platformFilter} CPA`;

  // Compute blended ROAS from campaign conversion values if available
  const totalConversionValue = filteredCampaigns.reduce((sum, c) => sum + (c.conversion_value ?? 0), 0);
  const totalSpendForROAS = filteredCampaigns.reduce((sum, c) => sum + (c.spend || 0), 0);
  const computedROAS = totalConversionValue > 0 && totalSpendForROAS > 0
    ? totalConversionValue / totalSpendForROAS
    : (dynamicMetrics.blendedROAS ?? 0);
  const metricsWithROAS = { ...dynamicMetrics, blendedROAS: computedROAS };

  // Anomaly detection
  const anomalyAlerts: AnomalyAlert[] = [];
  const activeCampaigns = filteredCampaigns.filter((c) => c.status === "Active");
  const zeroConvWaste = activeCampaigns.filter((c) => c.spend > 50 && c.conversions === 0);
  if (zeroConvWaste.length > 0) {
    const wastedSpend = zeroConvWaste.reduce((sum, c) => sum + c.spend, 0);
    anomalyAlerts.push({
      severity: wastedSpend > 500 ? "critical" : "warn",
      title: `${zeroConvWaste.length} campaign${zeroConvWaste.length > 1 ? "s" : ""} spending with zero conversions`,
      message: `RM ${wastedSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent with no tracked results. Check conversion tracking or pause underperformers.`,
      action: "Review tracking setup or add these campaigns to your negative keyword list.",
    });
  }
  const avgCpa = dynamicMetrics.blendedCPA;
  const highCpaCampaigns = activeCampaigns.filter((c) => c.conversions > 0 && avgCpa > 0 && c.cpa > avgCpa * 2);
  if (highCpaCampaigns.length > 0) {
    anomalyAlerts.push({
      severity: "warn",
      title: `CPA spike: ${highCpaCampaigns.length} campaign${highCpaCampaigns.length > 1 ? "s" : ""} above 2× average`,
      message: `${highCpaCampaigns.map((c) => c.name).join(", ")} — CPA is significantly above blended average (RM ${avgCpa.toFixed(0)}).`,
      action: "Review bids, audience targeting, and landing page quality.",
    });
  }
  const totalConversions = filteredCampaigns.reduce((sum, c) => sum + c.conversions, 0);
  const totalSpend = filteredCampaigns.reduce((sum, c) => sum + c.spend, 0);
  if (totalSpend > 200 && totalConversions === 0) {
    anomalyAlerts.push({
      severity: "critical",
      title: "No conversions tracked across all campaigns",
      message: `RM ${totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent with zero recorded conversions. Conversion tracking may be broken.`,
      action: "Check Google Tag Manager, Meta pixel, and conversion action configurations immediately.",
    });
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        
        {/* Page Title (Emitly Style) */}
        <div className="mt-2 mb-2 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
              {!data.isLive && (
                <span className="flex items-center gap-1.5 bg-accent-lime/20 text-accent-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border border-accent-lime/50 animate-pulse">
                  <RefreshCcw className="w-3 h-3 animate-spin-slow" />
                  Syncing Live Data
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-text-muted mt-1">
              <strong className="text-foreground font-bold">Welcome back</strong>, here is how your ads are performing today.
            </p>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-3">
            {/* Sync Now */}
            <button
              onClick={handleSync}
              disabled={syncing}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-colors",
                syncing
                  ? "bg-accent-lime/20 text-accent-primary border-accent-lime/50 cursor-not-allowed"
                  : "bg-surface border-border/60 text-text-muted hover:text-foreground hover:border-border shadow-sm"
              )}
              title="Pull fresh data from Google Ads and Meta APIs"
            >
              <RefreshCcw className={cn("w-4 h-4", syncing && "animate-spin")} />
              {syncing ? "Syncing…" : "Sync Now"}
            </button>

            {/* Date Picker */}
            <DatePicker
              currentRange={data.date_range}
              loading={refreshingRange}
              onRangeChange={handleRangeChange}
            />

            {/* Platform Toggle */}
            <div className="flex bg-surface border border-border/60 rounded-xl p-1 shadow-sm">
              {(["All", "Google", "Meta"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={cn(
                    "px-4 py-2 text-sm font-bold rounded-lg transition-colors",
                    platformFilter === p
                      ? "bg-accent-lime text-accent-primary shadow-sm"
                      : "text-text-muted hover:text-foreground"
                  )}
                >
                  {p === "All" ? "Combined" : `${p} Ads`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Unified Metrics (Emitly Style) */}
        {syncWarning && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {syncWarning}
          </div>
        )}
        {refreshError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            {refreshError}
          </div>
        )}

        <UnifiedMetricsCard metrics={metricsWithROAS} cpaLabel={cpaLabel} anomalyAlerts={anomalyAlerts} />

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between mb-1">
             <h2 className="text-base font-bold text-foreground">Top Performing Campaigns</h2>
          </div>
          <DataTable data={filteredCampaigns} />
        </div>

      </div>
    </DashboardLayout>
  );
}
