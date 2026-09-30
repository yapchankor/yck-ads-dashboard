"use client";

import React, { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TimeseriesPoint } from "@/lib/types";
import { formatCurrency, formatNumber } from "@/lib/client-config";

type Metric = "spend" | "conversions";

const myr = (val: number) => formatCurrency(val, { maximumFractionDigits: 0 });
const num = (val: number) => formatNumber(val, { maximumFractionDigits: 0 });

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Per-client chart series colours (injected on :root via client-config cssVars).
const GOOGLE_COLOR = "var(--color-chart-google)";
const META_COLOR = "var(--color-chart-meta)";

function ChartTooltip({ active, payload, label, formatValue }: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  formatValue: (val: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 12, padding: "10px 12px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.12)" }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "var(--color-foreground)", marginBottom: 6 }}>{formatDate(String(label))}</p>
      {payload.map((entry) => (
        <div key={entry.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 2 }}>
          <span style={{ width: 10, height: 10, borderRadius: 9999, background: entry.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ color: "var(--color-text-muted)" }}>{entry.name}</span>
          <span style={{ marginLeft: 16, fontWeight: 700, color: "var(--color-foreground)" }}>{formatValue(Number(entry.value))}</span>
        </div>
      ))}
    </div>
  );
}

export function PerformanceChart({ data }: { data: TimeseriesPoint[] }) {
  const [metric, setMetric] = useState<Metric>("spend");

  const isSpend = metric === "spend";
  const googleKey = isSpend ? "google_spend" : "google_conversions";
  const metaKey = isSpend ? "meta_spend" : "meta_conversions";
  const formatValue = (val: number) => (isSpend ? myr(val) : num(val));

  return (
    <div className="bg-surface shadow-sm rounded-2xl p-6 w-full flex flex-col border border-border/60">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Campaign Performance</h3>
          <p className="text-xs font-medium text-text-muted mt-1">
            Daily {isSpend ? "spend" : "conversions"} by platform
          </p>
        </div>

        {/* Metric toggle */}
        <div className="flex items-center bg-surface-hover/80 p-1 rounded-xl border border-border/40">
          <button
            onClick={() => setMetric("spend")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${metric === "spend" ? "bg-white text-foreground shadow-sm" : "text-text-muted hover:text-foreground"}`}
          >
            Spend
          </button>
          <button
            onClick={() => setMetric("conversions")}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${metric === "conversions" ? "bg-white text-foreground shadow-sm" : "text-text-muted hover:text-foreground"}`}
          >
            Conversions
          </button>
        </div>
      </div>

      {!data || data.length === 0 ? (
        <div className="h-[340px] w-full flex items-center justify-center">
          <p className="text-sm font-medium text-text-muted">No trend data yet</p>
        </div>
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGoogle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOOGLE_COLOR} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={GOOGLE_COLOR} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="perfMeta" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={META_COLOR} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={META_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                dy={10}
                tickFormatter={formatDate}
                minTickGap={24}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
                dx={-10}
                width={isSpend ? 72 : 48}
                tickFormatter={formatValue}
              />
              <Tooltip cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }} content={<ChartTooltip formatValue={formatValue} />} />

              <Area type="monotone" dataKey={googleKey} name="Google Ads" stroke={GOOGLE_COLOR} strokeWidth={2.5} fillOpacity={1} fill="url(#perfGoogle)" />
              <Area type="monotone" dataKey={metaKey} name="Meta Ads" stroke={META_COLOR} strokeWidth={2.5} fillOpacity={1} fill="url(#perfMeta)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
