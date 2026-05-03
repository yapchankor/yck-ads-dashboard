import React from "react";
import { Campaign } from "@/lib/types";

type InsightLabel = {
  text: string;
  color: "red" | "amber" | "green" | "blue";
};

function classifyCampaign(allCampaigns: Campaign[], row: Campaign): InsightLabel | null {
  if (row.status !== "Active") return null;

  const activeCampaignsWithConversions = allCampaigns.filter(
    (c) => c.status === "Active" && c.conversions > 0 && c.spend > 0
  );
  const avgCpa =
    activeCampaignsWithConversions.length > 0
      ? activeCampaignsWithConversions.reduce((sum, c) => sum + c.cpa, 0) / activeCampaignsWithConversions.length
      : 0;

  if (row.spend > 20 && row.conversions === 0) {
    return { text: "Spending, no conversions", color: "red" };
  }
  if (avgCpa > 0 && row.conversions >= 2 && row.cpa <= avgCpa * 0.75) {
    return { text: "Top performer", color: "green" };
  }
  if (avgCpa > 0 && row.cpa > avgCpa * 1.5) {
    return { text: "High CPA", color: "amber" };
  }
  if (row.conversions > 0 && row.spend > 0 && row.roas > 3) {
    return { text: "Strong ROAS", color: "blue" };
  }
  return null;
}

const labelColors: Record<InsightLabel["color"], string> = {
  red: "bg-red-100 text-red-700",
  amber: "bg-amber-100 text-amber-700",
  green: "bg-green-100 text-green-700",
  blue: "bg-blue-100 text-blue-700",
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const MetaIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" fill="#1877F2">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.469h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.469h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

export function DataTable({ data }: { data: Campaign[] }) {
  const classifiedData = data.map((row) => ({
    row,
    label: classifyCampaign(data, row),
  }));
  return (
    <div className="w-full bg-surface shadow-soft rounded-2xl border border-border/40 overflow-hidden">
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left text-sm text-text-muted">
          <colgroup>
            <col className="w-[50%]" />
            <col className="w-[14%]" />
            <col className="w-[14%]" />
            <col className="w-[11%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead className="text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border/40 bg-surface">
            <tr>
              <th scope="col" className="px-4 py-4">Campaign & Platform</th>
              <th scope="col" className="px-4 py-4">Status</th>
              <th scope="col" className="px-4 py-4 text-right">Spend</th>
              <th scope="col" className="px-4 py-4 text-right">Conv.</th>
              <th scope="col" className="px-4 py-4 text-right">CPA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {classifiedData.map(({ row, label }) => (
              <tr key={row.id} className="hover:bg-surface-hover/50 transition-colors">
                <td className="px-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-surface-hover">
                      {row.platform === 'Google' ? <GoogleIcon /> : <MetaIcon />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground" title={row.name}>{row.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-text-muted">{row.platform} Ads</p>
                        {label && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${labelColors[label.color]}`}>
                            {label.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                    row.status === 'Active' ? 'bg-accent-green/10 text-accent-green' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-4 text-right font-medium text-foreground">RM {row.spend.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-4 text-right font-medium text-foreground">{row.conversions}</td>
                <td className="px-4 py-4 text-right font-medium text-foreground">RM {row.cpa.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
