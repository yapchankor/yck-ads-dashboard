"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Layers, Loader2, Target, TrendingUp, Wrench, XCircle, Zap } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ActionDrawer } from "@/components/ui/ActionDrawer";
import { ACTION_TYPE_LABELS, actionPayload, getApplyErrorMessage, recommendationToActionPreview } from "@/lib/action-types";
import { formatCurrency } from "@/lib/client-config";
import { DashboardMetrics, Recommendation } from "@/lib/types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CardStatus = "pending" | "applied" | "manual_confirmed" | "dismissed";

const QUALITY_STYLES: Record<string, string> = {
  "High confidence": "bg-green-50 text-green-700 border-green-100",
  "Needs review": "bg-amber-50 text-amber-700 border-amber-100",
  "Manual only": "bg-amber-50 text-amber-700 border-amber-100",
  "Insufficient data": "bg-gray-50 text-gray-600 border-gray-100",
};

function formatMyr(value: number) {
  return formatCurrency(value);
}

export function RecommendationCard({
  recommendation: rec,
  clientName,
  baselineMetrics,
}: {
  recommendation: Recommendation;
  clientName?: string;
  baselineMetrics?: DashboardMetrics;
}) {
  const [cardStatus, setCardStatus] = useState<CardStatus>(
    rec.status === "Completed" ? "applied" : rec.status === "Dismissed" ? "dismissed" : "pending"
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);

  const isGoogle = rec.platform === "Google";
  const isMeta = rec.platform === "Meta";
  const qualityLabel = rec.quality_label || (rec.isManualOnly ? "Manual only" : "High confidence");
  const canAutoApply = rec.automation_allowed === true && rec.guardrail_status === "eligible" && !rec.isManualOnly;
  const actionStatusLabel = canAutoApply ? "Auto" : qualityLabel === "Needs review" ? "Needs review" : "Manual";
  const isDone = cardStatus === "applied" || cardStatus === "manual_confirmed" || cardStatus === "dismissed";
  const actionLabel = ACTION_TYPE_LABELS[rec.actionType] || rec.actionType;
  const targetGroupLabel = isMeta ? "Ad Set" : "Ad Group";
  const bidChangePct = rec.current_bid && rec.suggested_bid
    ? ((rec.suggested_bid - rec.current_bid) / rec.current_bid) * 100
    : null;
  const actionPreview = recommendationToActionPreview(rec);

  const impactColor = rec.impact === "High"
    ? "bg-red-100 text-red-600"
    : rec.impact === "Medium"
    ? "bg-amber-100 text-amber-700"
    : "bg-green-100 text-green-700";

  const platformColor = isGoogle
    ? "border-l-blue-500"
    : isMeta
    ? "border-l-purple-500"
    : "border-l-teal-500";

  const platformBadgeColor = isGoogle
    ? "bg-blue-50 text-blue-700"
    : isMeta
    ? "bg-purple-50 text-purple-700"
    : "bg-teal-50 text-teal-700";

  async function handleInlineDismiss() {
    setIsDismissing(true);
    setDismissError(null);
    try {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionPayload(actionPreview, clientName || "", baselineMetrics, { manual: true, status: "Dismissed" })),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(getApplyErrorMessage(result));
      }
      setCardStatus("dismissed");
      setConfirmDismiss(false);
    } catch (err) {
      setDismissError(err instanceof Error ? err.message : "Failed to dismiss");
    } finally {
      setIsDismissing(false);
    }
  }

  return (
    <>
      <div className={cn(
        "flex flex-col rounded-2xl border border-border/40 border-l-4 bg-surface shadow-sm transition-all",
        platformColor,
        isDone ? "opacity-55 grayscale-[0.3]" : "hover:-translate-y-0.5 hover:shadow-md",
      )}>
        <div className="px-5 pb-3 pt-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className={cn("shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", platformBadgeColor)}>
              {rec.platform}
            </span>
            <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", impactColor)}>
              <Zap className="h-3 w-3" /> {rec.impact}
            </span>
          </div>

          <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            <Wrench className="h-3 w-3" /> {actionLabel}
          </p>

          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
              QUALITY_STYLES[qualityLabel] || QUALITY_STYLES["Needs review"],
            )}>
              <AlertCircle className="h-3 w-3" />
              {actionStatusLabel}
              {typeof rec.confidence_score === "number" ? ` - ${Math.round(rec.confidence_score)}%` : ""}
            </span>
          </div>

          <h3 className="line-clamp-3 wrap-break-word text-sm font-bold leading-snug text-foreground">
            {rec.title}
          </h3>
        </div>

        <div className="flex flex-1 flex-col gap-2.5 px-5 pb-4">
          {rec.campaignName && (
            <div className="flex items-start gap-2">
              <Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
              <p className="wrap-break-word text-xs leading-snug text-text-muted">
                <span className="font-semibold text-foreground">Campaign: </span>{rec.campaignName}
              </p>
            </div>
          )}

          {rec.ad_group_name && rec.ad_group_name !== "Unknown" && (
            <div className="flex items-start gap-2">
              <Layers className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
              <p className="wrap-break-word text-xs leading-snug text-text-muted">
                <span className="font-semibold text-foreground">{targetGroupLabel}: </span>{rec.ad_group_name}
              </p>
            </div>
          )}

          {rec.keyword && (
            <div className="rounded-lg bg-surface-hover px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Keyword</p>
              <p className="break-all text-xs font-medium text-foreground">&ldquo;{rec.keyword}&rdquo;</p>
            </div>
          )}

          {rec.negative_keywords && rec.negative_keywords.length > 0 && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">Negative Keywords</p>
              <p className="wrap-break-word text-xs leading-relaxed text-amber-800">
                {rec.negative_keywords.map((keyword) => `-${keyword}`).join(", ")}
                {rec.match_type ? ` (${rec.match_type})` : ""}
              </p>
            </div>
          )}

          {rec.actionType === "bid_adjustment" && rec.current_bid && rec.suggested_bid && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-blue-700">Bid Change</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-text-muted">Current</p>
                  <p className="font-bold text-foreground">{formatMyr(rec.current_bid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-text-muted">Suggested</p>
                  <p className="font-bold text-blue-700">{formatMyr(rec.suggested_bid)}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase text-text-muted">Change</p>
                  <p className={cn("font-bold", bidChangePct && bidChangePct > 0 ? "text-blue-700" : "text-amber-700")}>
                    {bidChangePct !== null ? `${bidChangePct >= 0 ? "+" : ""}${bidChangePct.toFixed(1)}%` : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(rec.time_slot || rec.location || rec.device || rec.suggested_adjustment || rec.current_cpa || rec.current_spend || rec.current_performance) && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-blue-700">Adjustment Detail</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {rec.time_slot && <Detail label="Time" value={rec.time_slot} />}
                {rec.location && <Detail label="Location" value={rec.location} />}
                {rec.suggested_adjustment && <Detail label="Adjustment" value={rec.suggested_adjustment} strongClass="text-blue-700" />}
                {rec.device && <Detail label="Device" value={rec.device.replace(/_/g, " ")} />}
                {typeof rec.current_cpa === "number" && <Detail label="Current CPA" value={formatMyr(rec.current_cpa)} />}
                {typeof rec.current_spend === "number" && <Detail label="Spend" value={formatMyr(rec.current_spend)} />}
                {rec.current_performance && (
                  <div className="col-span-2">
                    <p className="text-[10px] font-semibold uppercase text-text-muted">Current Performance</p>
                    <p className="font-bold text-foreground">{rec.current_performance}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Why</p>
            <p className="text-xs leading-relaxed text-text-muted">{rec.description}</p>
          </div>

          {rec.suggestedAction && (
            <div>
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">What to do</p>
              <p className="text-xs font-medium leading-relaxed text-foreground">{rec.suggestedAction}</p>
            </div>
          )}

          {rec.expectedImpact && (
            <div className="flex items-start gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2">
              <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">Expected Outcome</p>
                <p className="text-xs leading-relaxed text-green-700">{rec.expectedImpact}</p>
              </div>
            </div>
          )}

          {rec.formula && (
            <div className="rounded-lg border border-border/50 bg-surface-hover px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">Calculation</p>
              <p className="text-xs leading-relaxed text-text-muted">{rec.formula}</p>
            </div>
          )}

          {rec.how_to_apply && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Manual Path</p>
              <p className="text-xs leading-relaxed text-blue-800">{rec.how_to_apply}</p>
            </div>
          )}

          {(rec.isManualOnly || !canAutoApply) && cardStatus === "pending" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
              <div className="space-y-1">
                <p className="text-[10px] font-medium leading-snug text-amber-700">
                  {qualityLabel === "Needs review" ? "Needs review before changing the ad account." : "Why manual?"}
                </p>
                {(rec.guardrail_reasons || []).slice(0, 2).map((reason) => (
                  <p key={reason} className="text-[10px] leading-snug text-amber-700/80">{reason}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5">
          {cardStatus === "applied" && (
            <DoneState icon={<CheckCircle2 className="h-4 w-4" />} label="Applied Automatically" />
          )}
          {cardStatus === "manual_confirmed" && (
            <DoneState icon={<CheckCircle2 className="h-4 w-4" />} label="Marked as Implemented" />
          )}
          {cardStatus === "dismissed" && (
            <div className="flex items-center gap-2 rounded-xl bg-surface-hover px-4 py-2.5 text-sm font-medium text-text-muted">
              <XCircle className="h-4 w-4" /> Dismissed
            </div>
          )}

          {!isDone && (
            confirmDismiss ? (
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 bg-surface-hover/70 p-3">
                <p className="text-xs font-semibold text-foreground">Dismiss this recommendation?</p>
                <p className="text-[11px] text-text-muted">It will be logged as dismissed in Outcome Tracking.</p>
                {dismissError && (
                  <p className="text-[11px] font-medium text-red-600">{dismissError}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleInlineDismiss}
                    disabled={isDismissing}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDismissing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                    Confirm Dismiss
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDismiss(false);
                      setDismissError(null);
                    }}
                    disabled={isDismissing}
                    className="rounded-lg border border-border/60 bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition-colors hover:bg-surface-hover disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-accent-primary/90"
                >
                  {canAutoApply ? primaryActionLabel(rec.actionType) : <><CheckCircle2 className="h-4 w-4" /> Mark as Implemented</>}
                </button>
                <button
                  onClick={() => {
                    setConfirmDismiss(true);
                    setDismissError(null);
                  }}
                  className="rounded-xl border border-border/50 bg-surface-hover p-2.5 text-text-muted transition-colors hover:border-red-200 hover:text-red-500"
                  title="Dismiss this recommendation"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            )
          )}
        </div>
      </div>

      <ActionDrawer
        action={actionPreview}
        clientName={clientName}
        baselineMetrics={baselineMetrics}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApplied={() => setCardStatus("applied")}
        onManual={() => setCardStatus("manual_confirmed")}
        onDismissed={() => setCardStatus("dismissed")}
      />
    </>
  );
}

function Detail({ label, value, strongClass }: { label: string; value: string; strongClass?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase text-text-muted">{label}</p>
      <p className={cn("font-bold text-foreground", strongClass)}>{value}</p>
    </div>
  );
}

function DoneState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-bold text-green-700">
      {icon} {label}
    </div>
  );
}

function primaryActionLabel(actionType: string) {
  if (actionType === "bid_adjustment") return "Apply Bid Change";
  if (actionType === "budget_adjustment") return "Apply Budget Change";
  return "Apply Now";
}
