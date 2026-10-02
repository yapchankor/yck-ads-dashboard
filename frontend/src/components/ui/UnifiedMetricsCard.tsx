import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatCurrency } from "@/lib/client-config";
import { PacingSummary } from "@/lib/types";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface MetricItemProps {
  title: string;
  value: string | number;
  delta?: number;
  deltaType?: "increase" | "decrease";
  isCurrency?: boolean;
  inverseColors?: boolean;
}

function MetricItem({ title, value, delta, deltaType, isCurrency, inverseColors = false }: MetricItemProps) {
  const isPositiveDelta = deltaType === "increase";
  
  let deltaColorClass = "text-text-muted";
  let deltaBgClass = "bg-surface-hover";
  if (delta !== undefined) {
    if ((isPositiveDelta && !inverseColors) || (!isPositiveDelta && inverseColors)) {
      deltaColorClass = "text-accent-green";
      deltaBgClass = "bg-accent-lime/50"; // Use soft lime for positive bg
    } else {
      deltaColorClass = "text-accent-red";
      deltaBgClass = "bg-accent-salmon/20"; // Soft red for negative bg
    }
  }

  const formattedValue = isCurrency && typeof value === 'number'
    ? formatCurrency(value)
    : typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div className="flex flex-col justify-center py-2 px-0 md:px-6 first:md:pl-0 last:md:pr-0">
      <h3 className="text-xs md:text-sm font-semibold text-text-muted mb-1.5">{title}</h3>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-2xl lg:text-3xl font-bold text-foreground">{formattedValue}</p>
        {delta !== undefined && (
          <div className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border border-white/20 shrink-0", deltaBgClass, deltaColorClass)}>
            {isPositiveDelta ? "+" : "-"}{Math.abs(delta)}%
            {isPositiveDelta ? <TrendingUp className="ml-1 h-3 w-3" /> : <TrendingDown className="ml-1 h-3 w-3" />}
          </div>
        )}
      </div>
    </div>
  );
}

export type AnomalyAlert = {
  severity: "warn" | "critical";
  title: string;
  message: string;
  action?: string;
};

interface UnifiedMetricsCardProps {
  metrics: {
    totalSpend: number;
    spendDelta?: number;
    blendedCPA: number;
    cpaDelta?: number;
    totalConversions: number;
    blendedROAS?: number;
    dateRange?: { start: string; end: string };
  };
  cpaLabel?: string;
  anomalyAlerts?: AnomalyAlert[];
  pacing?: PacingSummary | null;
}

export function UnifiedMetricsCard({ metrics, cpaLabel = "Blended CPA", anomalyAlerts = [], pacing }: UnifiedMetricsCardProps) {
  const dateLabel = metrics.dateRange
    ? `${new Date(metrics.dateRange.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(metrics.dateRange.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : "Last 30 Days";

  const showROAS = typeof metrics.blendedROAS === "number" && metrics.blendedROAS > 0;

  return (
    <div className="bg-surface shadow-sm rounded-2xl p-6 border border-border/60 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground">Account Performance</h2>
          <p className="text-xs font-medium text-text-muted mt-1">{dateLabel}</p>
        </div>

        {pacing && typeof pacing.daily_avg_spend === "number" && pacing.daily_avg_spend > 0 && (
          <div className="flex items-center gap-2.5 bg-surface-hover/80 border border-border/40 rounded-xl px-3 py-1.5 self-start sm:self-auto">
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border",
              pacing.status === "overpacing"
                ? "bg-amber-50 text-amber-800 border-amber-200"
                : pacing.status === "underpacing"
                ? "bg-blue-50 text-blue-800 border-blue-200"
                : "bg-emerald-50 text-emerald-800 border-emerald-200"
            )}>
              <span className={cn(
                "w-1.5 h-1.5 rounded-full",
                pacing.status === "overpacing" ? "bg-amber-500" : pacing.status === "underpacing" ? "bg-blue-500" : "bg-emerald-500"
              )} />
              {pacing.status === "overpacing" ? "Overpacing" : pacing.status === "underpacing" ? "Underpacing" : "Pacing On Track"}
              {typeof pacing.pacing_pct === "number" ? ` (${pacing.pacing_pct.toFixed(0)}%)` : ""}
            </span>
            <div className="text-[11px] font-medium text-text-muted">
              <span className="font-bold text-foreground">
                Proj. {formatCurrency(pacing.projected_monthly_spend || 0)}
              </span>
              <span className="hidden md:inline text-text-muted/80"> ({formatCurrency(pacing.daily_avg_spend)}/day)</span>
            </div>
          </div>
        )}
      </div>

      {anomalyAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {anomalyAlerts.map((alert, i) => (
            <div key={i} className={cn(
              "rounded-xl border px-4 py-3",
              alert.severity === "critical" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
            )}>
              <p className={cn("text-sm font-bold", alert.severity === "critical" ? "text-red-700" : "text-amber-800")}>
                {alert.title}
              </p>
              <p className={cn("text-xs mt-0.5", alert.severity === "critical" ? "text-red-600" : "text-amber-700")}>
                {alert.message}
              </p>
              {alert.action && (
                <p className={cn("text-xs mt-1 font-semibold", alert.severity === "critical" ? "text-red-700" : "text-amber-800")}>
                  → {alert.action}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-0 md:divide-x md:divide-border/50">
        <MetricItem
          title="Total Spend"
          value={metrics.totalSpend}
          delta={metrics.spendDelta}
          deltaType="increase"
          isCurrency
        />
        <MetricItem
          title={cpaLabel}
          value={metrics.blendedCPA}
          delta={metrics.cpaDelta}
          deltaType="decrease"
          isCurrency
          inverseColors
        />
        <MetricItem
          title="Total Conversions"
          value={metrics.totalConversions}
        />
        {showROAS ? (
          <MetricItem
            title="ROAS"
            value={`${metrics.blendedROAS!.toFixed(2)}×`}
          />
        ) : (
          <div className="hidden md:block" />
        )}
      </div>
    </div>
  );
}
