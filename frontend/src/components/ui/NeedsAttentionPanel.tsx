"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ChevronRight, Sparkles, Zap } from "lucide-react";
import { ActionPreview, ApplyResult, DashboardMetrics, Recommendation } from "@/lib/types";
import { recommendationToActionPreview } from "@/lib/action-types";
import { getTopActionableRecommendations } from "@/lib/needs-attention";
import { ActionDrawer } from "./ActionDrawer";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface NeedsAttentionPanelProps {
  recommendations: Recommendation[];
  platformFilter: "All" | "Google" | "Meta";
  clientName?: string;
  baselineMetrics?: DashboardMetrics;
  onRecommendationAction?: (recId: string, status: "applied" | "manual" | "dismissed") => void;
}

export function NeedsAttentionPanel({
  recommendations,
  platformFilter,
  clientName,
  baselineMetrics,
  onRecommendationAction,
}: NeedsAttentionPanelProps) {
  const [selectedAction, setSelectedAction] = useState<ActionPreview | null>(null);
  const [selectedRecId, setSelectedRecId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Filter to actionable, non-suppressed, non-dismissed recommendations
  const activeCandidates = (recommendations || []).filter(
    (r) => r.status !== "Completed" && r.status !== "Dismissed" && r.guardrail_status !== "suppressed"
  );

  const filteredCandidates = platformFilter === "All"
    ? activeCandidates
    : activeCandidates.filter((r) => r.platform === platformFilter);

  // Sort by confidence score descending, then by impact High > Medium > Low, top 3
  const topRecommendations = getTopActionableRecommendations(recommendations, platformFilter, 3);

  function handleOpenDrawer(rec: Recommendation) {
    setSelectedRecId(rec.id);
    setSelectedAction(recommendationToActionPreview(rec));
    setDrawerOpen(true);
  }

  function handleActionComplete(result: ApplyResult, status: "applied" | "manual" | "dismissed") {
    if (selectedRecId && onRecommendationAction) {
      onRecommendationAction(selectedRecId, status);
    }
    setDrawerOpen(false);
    setSelectedAction(null);
    setSelectedRecId(null);
  }

  const allRecommendationsUrl = platformFilter === "All"
    ? "/recommendations"
    : `/recommendations?platform=${platformFilter}`;

  if (topRecommendations.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-surface p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Needs Attention</h2>
              <p className="text-xs font-medium text-text-muted mt-0.5">
                All systems performing smoothly. No urgent recommendations pending for this view.
              </p>
            </div>
          </div>
          <Link
            href="/tracking"
            className="text-xs font-bold text-accent-primary hover:underline flex items-center gap-1 shrink-0"
          >
            View outcome tracking <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-lime/20 text-accent-primary border border-accent-lime/40">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-foreground">Needs Attention</h2>
                <span className="rounded-full bg-accent-lime/30 px-2 py-0.5 text-[10px] font-black uppercase text-accent-primary border border-accent-lime/50">
                  Top {topRecommendations.length}
                </span>
              </div>
            </div>
          </div>
          <Link
            href={allRecommendationsUrl}
            className="text-xs font-bold text-accent-primary hover:underline flex items-center gap-1"
          >
            View all ({filteredCandidates.length}) <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* 3-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topRecommendations.map((rec) => {
            const isGoogle = rec.platform === "Google";
            const isMeta = rec.platform === "Meta";
            const platformBadgeColor = isGoogle
              ? "bg-blue-50 text-blue-700 border-blue-100"
              : isMeta
              ? "bg-purple-50 text-purple-700 border-purple-100"
              : "bg-teal-50 text-teal-700 border-teal-100";

            const impactColor = rec.impact === "High"
              ? "bg-red-50 text-red-700 border-red-100"
              : rec.impact === "Medium"
              ? "bg-amber-50 text-amber-700 border-amber-100"
              : "bg-emerald-50 text-emerald-700 border-emerald-100";

            const confidence = typeof rec.confidence_score === "number"
              ? Math.round(rec.confidence_score)
              : 70;

            const targetName = rec.campaignName || rec.keyword || rec.ad_group_name;
            const expected = rec.expectedImpact || rec.expected_impact || rec.description;

            return (
              <div
                key={rec.id}
                className="flex flex-col justify-between rounded-2xl border border-border/60 bg-surface p-4 shadow-sm hover:shadow-md hover:border-border transition-all"
              >
                <div>
                  {/* Top metadata row */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border", platformBadgeColor)}>
                      {rec.platform}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border", impactColor)}>
                        <Zap className="h-2.5 w-2.5" />
                        {rec.impact}
                      </span>
                      <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold text-text-muted border border-border/40">
                        {confidence}% conf
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-bold text-foreground line-clamp-2 leading-snug">
                    {rec.title}
                  </h3>

                  {/* Target Entity */}
                  {targetName && (
                    <p className="text-[11px] font-medium text-text-muted mt-1.5 truncate">
                      <span className="font-semibold text-foreground/80">Target:</span> {targetName}
                    </p>
                  )}

                  {/* Expected impact pill */}
                  {expected && (
                    <p className="mt-2.5 rounded-xl bg-surface-hover/70 p-2 text-xs font-medium text-text-muted line-clamp-2 border border-border/30">
                      💡 {expected}
                    </p>
                  )}
                </div>

                {/* Bottom Action Button */}
                <div className="mt-4 pt-3 border-t border-border/40">
                  <button
                    onClick={() => handleOpenDrawer(rec)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-accent-primary text-white text-xs font-bold hover:bg-accent-primary/90 transition-colors shadow-sm"
                  >
                    <Zap className="h-3.5 w-3.5" /> Review & Apply
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ActionDrawer
        action={selectedAction}
        clientName={clientName}
        baselineMetrics={baselineMetrics}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedAction(null);
          setSelectedRecId(null);
        }}
        onApplied={(result) => handleActionComplete(result, "applied")}
        onManual={(result) => handleActionComplete(result, "manual")}
        onDismissed={(result) => handleActionComplete(result, "dismissed")}
      />
    </>
  );
}
