import React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
    ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(value)
    : typeof value === 'number' ? value.toLocaleString() : value;

  return (
    <div className="flex-1 px-6 first:pl-0 last:pr-0 border-r border-border/50 last:border-0">
      <h3 className="text-sm font-semibold text-text-muted mb-2">{title}</h3>
      <div className="flex items-center gap-3">
        <p className="text-3xl font-bold text-foreground">{formattedValue}</p>
        {delta !== undefined && (
          <div className={cn("flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border border-white/20", deltaBgClass, deltaColorClass)}>
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
    spendDelta: number;
    blendedCPA: number;
    cpaDelta: number;
    totalConversions: number;
    blendedROAS?: number;
    dateRange?: { start: string; end: string };
  };
  cpaLabel?: string;
  anomalyAlerts?: AnomalyAlert[];
}

export function UnifiedMetricsCard({ metrics, cpaLabel = "Blended CPA", anomalyAlerts = [] }: UnifiedMetricsCardProps) {
  const dateLabel = metrics.dateRange
    ? `${new Date(metrics.dateRange.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${new Date(metrics.dateRange.end).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : "Last 30 Days";

  const showROAS = typeof metrics.blendedROAS === "number" && metrics.blendedROAS > 0;

  return (
    <div className="bg-surface shadow-sm rounded-2xl p-6 border border-border/60 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Account Performance</h2>
          <p className="text-xs font-medium text-text-muted mt-1">{dateLabel}</p>
        </div>
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

      <div className="flex items-center justify-between">
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
        {showROAS && (
          <MetricItem
            title="ROAS"
            value={`${metrics.blendedROAS!.toFixed(2)}×`}
          />
        )}
      </div>
    </div>
  );
}
