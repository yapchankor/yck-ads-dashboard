"use client";

import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, X, XCircle, Zap } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { ActionPreview, ApplyResult, DashboardMetrics } from "@/lib/types";
import { actionPayload, actionTypeLabel, getApplyErrorMessage } from "@/lib/action-types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type DrawerStatus = "idle" | "applying" | "applied" | "manual" | "dismissed" | "error";

const QUALITY_STYLES: Record<string, string> = {
  "High confidence": "bg-green-50 text-green-700 border-green-100",
  "Needs review": "bg-amber-50 text-amber-700 border-amber-100",
  "Manual only": "bg-amber-50 text-amber-700 border-amber-100",
  "Insufficient data": "bg-gray-50 text-gray-600 border-gray-100",
};

function DetailRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-border/40 py-2 last:border-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="text-xs font-medium leading-relaxed text-foreground">{value}</div>
    </div>
  );
}

export function ActionDrawer({
  action,
  clientName,
  baselineMetrics,
  open,
  onClose,
  onApplied,
  onManual,
  onDismissed,
}: {
  action: ActionPreview | null;
  clientName?: string;
  baselineMetrics?: DashboardMetrics;
  open: boolean;
  onClose: () => void;
  onApplied?: (result: ApplyResult) => void;
  onManual?: (result: ApplyResult) => void;
  onDismissed?: (result: ApplyResult) => void;
}) {
  if (!open || !action) return null;

  return (
    <ActionDrawerPanel
      key={action.id}
      action={action}
      clientName={clientName}
      baselineMetrics={baselineMetrics}
      onClose={onClose}
      onApplied={onApplied}
      onManual={onManual}
      onDismissed={onDismissed}
    />
  );
}

function ActionDrawerPanel({
  action,
  clientName,
  baselineMetrics,
  onClose,
  onApplied,
  onManual,
  onDismissed,
}: {
  action: ActionPreview;
  clientName?: string;
  baselineMetrics?: DashboardMetrics;
  onClose: () => void;
  onApplied?: (result: ApplyResult) => void;
  onManual?: (result: ApplyResult) => void;
  onDismissed?: (result: ApplyResult) => void;
}) {
  const [status, setStatus] = useState<DrawerStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const qualityLabel = action.qualityLabel || (action.manualOnly ? "Manual only" : "High confidence");
  const canAutoApply = action.automationAllowed === true && action.guardrailStatus !== "manual_only" && !action.manualOnly;
  const actionStatusLabel = canAutoApply ? "Auto" : qualityLabel === "Needs review" ? "Needs review" : "Manual";
  const isBusy = status === "applying";
  const isDone = status === "applied" || status === "manual" || status === "dismissed";

  async function submit(options?: { manual?: boolean; status?: "Dismissed" }) {
    if (!clientName) {
      setError("Client is not configured for this action.");
      setStatus("error");
      return;
    }

    setStatus("applying");
    setError(null);

    try {
      const response = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(actionPayload(action, clientName, baselineMetrics, options)),
      });
      const result = (await response.json()) as ApplyResult;
      const trackingStatus = result.tracking_record?.status;
      const hasTrackingRecord = Boolean(result.tracking_record);

      if (!response.ok) {
        throw new Error(getApplyErrorMessage(result));
      }

      if (result.status === "dismissed") {
        if (trackingStatus !== "Dismissed") throw new Error("Dismissal was not recorded in Outcome Tracking.");
        setStatus("dismissed");
        onDismissed?.(result);
      } else if (result.status === "manual_required") {
        if (trackingStatus !== "Tracking" && trackingStatus !== "Completed") {
          throw new Error("Manual action was not recorded in Outcome Tracking.");
        }
        setStatus("manual");
        onManual?.(result);
      } else if (result.status === "already_tracking") {
        throw new Error(result.message || "This action is already in Outcome Tracking.");
      } else if (result.status === "error") {
        throw new Error(result.execution_status || "Execution failed.");
      } else if ((result.status === "applied" || result.status === "tracked") && hasTrackingRecord) {
        if (trackingStatus !== "Tracking" && trackingStatus !== "Completed") {
          throw new Error(result.tracking_record?.execution_status || "Action was not recorded as tracking.");
        }
        setStatus("applied");
        onApplied?.(result);
      } else {
        throw new Error("Apply response did not include a valid tracking record.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply action. Please try again.");
      setStatus("error");
    }
  }

  const platformColor = action.platform === "Google"
    ? "bg-blue-50 text-blue-700 border-blue-100"
    : action.platform === "Meta"
    ? "bg-purple-50 text-purple-700 border-purple-100"
    : "bg-teal-50 text-teal-700 border-teal-100";

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close action preview"
        className="absolute inset-0 cursor-default bg-black/30"
        onClick={isBusy ? undefined : onClose}
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide", platformColor)}>
                {action.platform}
              </span>
              <span className="rounded-full border border-border/60 bg-surface-hover px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-text-muted">
                {actionTypeLabel(action.actionType)}
              </span>
              <span className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                QUALITY_STYLES[String(qualityLabel)] || QUALITY_STYLES["Needs review"],
              )}>
                <AlertCircle className="h-3 w-3" />
                {actionStatusLabel}
                {typeof action.confidenceScore === "number" ? ` ${Math.round(action.confidenceScore)}%` : ""}
              </span>
            </div>
            <h2 className="text-lg font-bold leading-tight text-foreground">{action.title}</h2>
            {action.targetLabel && <p className="mt-1 text-sm text-text-muted">{action.targetLabel}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl border border-border/50 p-2 text-text-muted transition-colors hover:text-foreground disabled:opacity-50"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="rounded-2xl border border-border/60 bg-background px-4 py-2">
            <DetailRow label="Target" value={action.targetType ? `${action.targetType}: ${action.targetLabel || action.targetId || "-"}` : action.targetLabel || action.targetId} />
            <DetailRow label="Campaign" value={action.campaignName || action.campaignId} />
            <DetailRow label="Ad Group" value={action.adGroupName} />
            <DetailRow label="Ad Set" value={action.adsetName || action.adsetId} />
            <DetailRow label="Ad" value={action.adName || action.adId} />
            <DetailRow label="Keyword" value={action.keyword ? `"${action.keyword}"` : null} />
            <DetailRow label="Placement" value={action.placement} />
            <DetailRow label="Location" value={action.location} />
            <DetailRow label="Device" value={action.device?.replace(/_/g, " ")} />
            <DetailRow label="Time" value={action.timeSlot} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border/60 bg-surface-hover p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Current</p>
              <p className="mt-1 text-sm font-bold text-foreground">{action.currentValue || "Review current account value"}</p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">Proposed</p>
              <p className="mt-1 text-sm font-bold text-blue-800">{action.proposedValue || action.suggestedAction || "Record implementation"}</p>
            </div>
          </div>

          {action.negativeKeywords && action.negativeKeywords.length > 0 && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Negative Keywords</p>
              <p className="mt-1 text-xs font-medium text-amber-800">
                {action.negativeKeywords.map((keyword) => `-${keyword}`).join(", ")}
                {action.matchType ? ` (${action.matchType})` : ""}
              </p>
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-border/60 bg-background p-4">
            <DetailRow label="Why" value={action.reason} />
            <DetailRow label="What To Do" value={action.suggestedAction} />
            <DetailRow label="Expected" value={action.expectedImpact} />
            <DetailRow label="Calculation" value={action.formula} />
            <DetailRow label="Manual Path" value={action.manualPath} />
          </div>

          {!canAutoApply && (
            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
              <p className="text-xs font-bold text-amber-800">
                {qualityLabel === "Needs review" ? "Needs review before changing the ad account." : "Manual action"}
              </p>
              {(action.guardrailReasons || []).length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {(action.guardrailReasons || []).slice(0, 4).map((reason) => (
                    <li key={reason} className="text-xs leading-relaxed text-amber-700">{reason}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-amber-700">
                  This action will be recorded for tracking, but it will not change the live ad account automatically.
                </p>
              )}
            </div>
          )}

          {status === "applied" && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-700">
              <CheckCircle2 className="h-5 w-5" /> Applied and added to Outcome Tracking.
            </div>
          )}
          {status === "manual" && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-bold text-green-700">
              <CheckCircle2 className="h-5 w-5" /> Marked as implemented and added to Outcome Tracking.
            </div>
          )}
          {status === "dismissed" && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border/60 bg-surface-hover p-4 text-sm font-bold text-text-muted">
              <XCircle className="h-5 w-5" /> Dismissed.
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 px-6 py-4">
          {isDone ? (
            <button
              onClick={onClose}
              className="w-full rounded-xl bg-accent-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary/90"
            >
              Close
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {canAutoApply ? (
                <button
                  onClick={() => submit()}
                  disabled={isBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary/90 disabled:opacity-60"
                >
                  {isBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Applying...</> : <><Zap className="h-4 w-4" /> Apply Change</>}
                </button>
              ) : (
                <button
                  onClick={() => submit({ manual: true })}
                  disabled={isBusy}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-primary/90 disabled:opacity-60"
                >
                  {isBusy ? <><Loader2 className="h-4 w-4 animate-spin" /> Recording...</> : <><CheckCircle2 className="h-4 w-4" /> Mark as Implemented</>}
                </button>
              )}
              <button
                onClick={() => submit({ manual: true, status: "Dismissed" })}
                disabled={isBusy}
                className="rounded-xl border border-border/60 bg-surface-hover p-3 text-text-muted transition-colors hover:border-red-200 hover:text-red-500 disabled:opacity-60"
                title="Dismiss this action"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
