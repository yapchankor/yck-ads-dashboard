"use client";

import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { activeClientKey, clientTimezone, currencySymbol } from "@/lib/client-config";
import { AlertCircle, CheckCircle2, Clock, FileText, Globe, Mail, Save, Users } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

type EmailReportSettings = {
  enabled: boolean;
  recipients: string[];
  frequency: "daily" | "weekly" | "monthly";
  send_day: string;
  send_time: string;
  timezone: string;
  subject: string;
  message: string;
  attachments: {
    google_html: boolean;
    meta_html: boolean;
    summary_csv: boolean;
  };
};

const defaultEmailSettings: EmailReportSettings = {
  enabled: false,
  recipients: [],
  frequency: "weekly",
  send_day: "Monday",
  send_time: "08:00",
  timezone: clientTimezone(),
  subject: "Weekly Ad Performance Report - {client_name}",
  message:
    "Hello {client_name},\n\n" +
    "Your advertising performance report is ready.\n\n" +
    `Total Spend: ${currencySymbol()}{total_spend}\n` +
    "Total Conversions: {total_conversions}\n" +
    `Average CPA: ${currencySymbol()}{avg_cpa}\n\n` +
    "Detailed reports are attached.",
  attachments: {
    google_html: true,
    meta_html: true,
    summary_csv: false,
  },
};

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Common IANA timezones for the report scheduler. The active client's default is always
// included via clientTimezone() so the selector never shows an option the backend can't honour.
const timezoneOptions = Array.from(
  new Set([
    clientTimezone(),
    "Asia/Kuala_Lumpur",
    "Asia/Singapore",
    "Europe/London",
    "Europe/Paris",
    "America/New_York",
    "America/Los_Angeles",
    "Australia/Sydney",
    "UTC",
  ]),
);

// Per-client storage key so settings don't bleed across tenants on a shared/preview origin.
const STORAGE_KEY = `adspulse-email-report-settings:${activeClientKey()}`;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string) {
  return EMAIL_PATTERN.test(value);
}

// send_day is reused across frequencies (weekday name for weekly, day-of-month for monthly).
// Reset it to a valid value for the target frequency so a stale value can't silently break the
// backend schedule check (which never matches a day-of-month against a weekday name).
function normalizeSendDay(frequency: EmailReportSettings["frequency"], current: string) {
  if (frequency === "monthly") {
    const day = parseInt(current, 10);
    return Number.isFinite(day) && day >= 1 && day <= 28 ? String(day) : "1";
  }
  return weekdays.includes(current) ? current : "Monday";
}

function parseRecipients(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function loadLocalEmailSettings() {
  if (typeof window === "undefined") return defaultEmailSettings;

  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return defaultEmailSettings;
    const parsed = JSON.parse(saved);
    return {
      ...defaultEmailSettings,
      ...parsed,
      attachments: {
        ...defaultEmailSettings.attachments,
        ...(parsed.attachments || {}),
      },
      recipients: Array.isArray(parsed.recipients) ? parsed.recipients : [],
    };
  } catch {
    return defaultEmailSettings;
  }
}

export default function SettingsPage() {
  const [clientInfo, setClientInfo] = useState<{
    customer_id: string;
    facebook_ad_account_id: string;
  } | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailReportSettings>(defaultEmailSettings);
  const [recipientText, setRecipientText] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<string>("Saved schedule is checked hourly when deployed.");

  // Generate Report Now state
  const [reportRange, setReportRange] = useState<"7" | "30" | "90">("30");
  const [reportEmail, setReportEmail] = useState("");
  const reportEmailPrefilledRef = useRef(false);
  const [reportStatus, setReportStatus] = useState<"idle" | "generating" | "done" | "pending" | "error">("idle");
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchData() {
      try {
        const [dashboardResponse, emailResponse] = await Promise.all([
          fetch("/api/data"),
          fetch("/api/email-settings"),
        ]);

        if (dashboardResponse.ok) {
          const data = await dashboardResponse.json();
          setClientInfo({
            customer_id: data.customer_id || "",
            facebook_ad_account_id: data.facebook_ad_account_id || "",
          });
        }

        if (emailResponse.ok) {
          const data = await emailResponse.json();
          const nextSettings = {
            ...defaultEmailSettings,
            ...(data.settings || {}),
            attachments: {
              ...defaultEmailSettings.attachments,
              ...(data.settings?.attachments || {}),
            },
          };
          setEmailSettings(nextSettings);
          setRecipientText((nextSettings.recipients || []).join("\n"));
          setHasUnsavedChanges(false);
          if (data.delivery?.scheduler) {
            setDeliveryStatus(`${data.delivery.scheduler}: ${data.delivery.status || "available"}.`);
          }
        } else {
          setSettingsError("Email settings API is not available yet. Changes will be kept in this browser until the backend endpoint is deployed.");
        }
      } catch (err) {
        console.error("Failed to fetch settings:", err);
        setSettingsError("Could not load live email settings. Changes will be kept in this browser.");
      } finally {
        setLoadingSettings(false);
      }
    }

    queueMicrotask(() => {
      if (!active) return;
      const localSettings = loadLocalEmailSettings();
      setEmailSettings(localSettings);
      setRecipientText(localSettings.recipients.join("\n"));
      fetchData();
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(emailSettings));
  }, [emailSettings]);

  useEffect(() => {
    if (reportEmailPrefilledRef.current || emailSettings.recipients.length === 0) {
      return;
    }

    queueMicrotask(() => {
      if (reportEmailPrefilledRef.current) return;
      setReportEmail(emailSettings.recipients.join(", "));
      reportEmailPrefilledRef.current = true;
    });
  }, [emailSettings.recipients]);

  function updateEmailSettings(update: Partial<EmailReportSettings>) {
    setSettingsMessage(null);
    setSettingsError(null);
    setHasUnsavedChanges(true);
    setEmailSettings((current) => ({ ...current, ...update }));
  }

  function updateFrequency(frequency: EmailReportSettings["frequency"]) {
    updateEmailSettings({
      frequency,
      send_day: normalizeSendDay(frequency, emailSettings.send_day),
    });
  }

  async function generateReport() {
    setReportStatus("generating");
    setReportError(null);
    const days = parseInt(reportRange);
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - days + 1);
    const toDateParam = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days,
          start_date: toDateParam(start),
          end_date: toDateParam(end),
          send_email: true,
          email: reportEmail.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Failed to generate report");
      }
      let succeeded = false;
      if (payload.job_id) {
        for (let i = 0; i < 60; i++) {
          await new Promise((resolve) => setTimeout(resolve, i === 0 ? 2000 : 5000));
          const statusResponse = await fetch(`/api/refresh-status?job_id=${encodeURIComponent(payload.job_id)}`);
          if (!statusResponse.ok) break;
          const statusPayload = await statusResponse.json();
          if (statusPayload.status === "succeeded") {
            succeeded = true;
            break;
          }
          if (statusPayload.status === "failed") {
            throw new Error((statusPayload.errors || []).join("; ") || "Report generation failed");
          }
        }
      } else {
        // No job to poll (fire-and-forget backend); treat the accepted request as queued.
        succeeded = true;
      }
      // If we polled a job but never observed "succeeded", it is still processing — don't
      // claim success. Surface a distinct "still processing" state instead.
      setReportStatus(succeeded ? "done" : "pending");
    } catch (err) {
      setReportStatus("error");
      setReportError(err instanceof Error ? err.message : "Failed to generate report");
    }
  }

  async function saveEmailSettings() {
    setSettingsMessage(null);
    setSettingsError(null);

    const recipients = parseRecipients(recipientText);

    const invalid = recipients.filter((address) => !isValidEmail(address));
    if (invalid.length > 0) {
      setSettingsError(`Invalid email ${invalid.length === 1 ? "address" : "addresses"}: ${invalid.join(", ")}`);
      return;
    }
    if (emailSettings.enabled && recipients.length === 0) {
      setSettingsError("Add at least one recipient before enabling email reports.");
      return;
    }

    setSavingSettings(true);
    const nextSettings = { ...emailSettings, recipients };
    setEmailSettings(nextSettings);

    try {
      const response = await fetch("/api/email-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Failed to save email settings");
      }

      setSettingsMessage("Email settings saved.");
      setHasUnsavedChanges(false);
      if (payload.settings) {
        setEmailSettings({
          ...defaultEmailSettings,
          ...payload.settings,
          attachments: {
            ...defaultEmailSettings.attachments,
            ...(payload.settings.attachments || {}),
          },
        });
        setRecipientText((payload.settings.recipients || []).join("\n"));
      }
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : "Failed to save email settings");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 pb-10">
        <div className="mt-2">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
          <p className="text-sm font-medium text-text-muted mt-1">Manage account connections, report delivery, and platform preferences.</p>
        </div>

        <div className="grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
          <section className="bg-surface shadow-sm rounded-2xl p-6 border border-border/60">
            <h2 className="text-lg font-bold text-foreground mb-4">Ad Account Connections</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-hover/50 border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent-primary/10 flex items-center justify-center text-accent-primary font-bold">G</div>
                  <div>
                    <h3 className="font-bold text-foreground">Google Ads</h3>
                    <p className="text-xs font-medium text-text-muted">
                      {clientInfo?.customer_id ? (
                        <>Connected: <span className="text-accent-primary font-bold">MCC Account (ID: {clientInfo.customer_id})</span></>
                      ) : (
                        <span className="font-bold">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-text-muted bg-surface-hover rounded-lg" title="Connections are managed by Autoflow.">
                  Managed by Autoflow
                </span>
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl bg-surface-hover/50 border border-border">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-accent-lime/20 flex items-center justify-center text-accent-primary font-bold">M</div>
                  <div>
                    <h3 className="font-bold text-foreground">Meta Ads</h3>
                    <p className="text-xs font-medium text-text-muted">
                      {clientInfo?.facebook_ad_account_id ? (
                        <>Connected: <span className="text-accent-primary font-bold">Ad Account (ID: {clientInfo.facebook_ad_account_id})</span></>
                      ) : (
                        <span className="font-bold">Not connected</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-text-muted bg-surface-hover rounded-lg" title="Connections are managed by Autoflow.">
                  Managed by Autoflow
                </span>
              </div>
            </div>
          </section>

          <section className="bg-surface shadow-sm rounded-2xl p-6 border border-border/60">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                  <Mail className="h-5 w-5 text-accent-primary" />
                  Email Reports
                </h2>
                <p className="mt-1 text-xs font-medium text-text-muted">{deliveryStatus}</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  aria-label="Enable scheduled email reports"
                  checked={emailSettings.enabled}
                  onChange={(event) => updateEmailSettings({ enabled: event.target.checked })}
                />
                <div className="h-6 w-11 rounded-full bg-surface-hover after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:bg-accent-lime peer-checked:after:translate-x-full" />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  Frequency
                </span>
                <select
                  value={emailSettings.frequency}
                  onChange={(event) => updateFrequency(event.target.value as EmailReportSettings["frequency"])}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none"
                >
                  <option value="weekly">Weekly</option>
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">
                  {emailSettings.frequency === "monthly" ? "Day of Month" : "Send Day"}
                </span>
                {emailSettings.frequency === "monthly" ? (
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={emailSettings.send_day}
                    onChange={(event) => updateEmailSettings({ send_day: event.target.value })}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none"
                  />
                ) : (
                  <select
                    value={emailSettings.send_day}
                    onChange={(event) => updateEmailSettings({ send_day: event.target.value })}
                    disabled={emailSettings.frequency === "daily"}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none disabled:text-text-muted"
                  >
                    {weekdays.map((day) => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">Send Time</span>
                <input
                  type="time"
                  value={emailSettings.send_time}
                  onChange={(event) => updateEmailSettings({ send_time: event.target.value })}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                  <Globe className="h-3.5 w-3.5" />
                  Timezone
                </span>
                <select
                  value={emailSettings.timezone}
                  onChange={(event) => updateEmailSettings({ timezone: event.target.value })}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none md:w-1/2"
                >
                  {timezoneOptions.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
                <span className="mt-1 block text-xs font-medium text-text-muted">Send time is interpreted in this timezone.</span>
              </label>
            </div>

            <div className="mt-4">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                  <Users className="h-3.5 w-3.5" />
                  Recipients
                </span>
                <textarea
                  value={recipientText}
                  onChange={(event) => {
                    setRecipientText(event.target.value);
                    updateEmailSettings({ recipients: parseRecipients(event.target.value) });
                  }}
                  rows={3}
                  placeholder="client@example.com&#10;andrea@example.com"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none"
                />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                  <FileText className="h-3.5 w-3.5" />
                  Subject
                </span>
                <input
                  value={emailSettings.subject}
                  onChange={(event) => updateEmailSettings({ subject: event.target.value })}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-text-muted">Message</span>
                <textarea
                  value={emailSettings.message}
                  onChange={(event) => updateEmailSettings({ message: event.target.value })}
                  rows={7}
                  className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium leading-relaxed text-foreground focus:border-accent-primary focus:outline-none"
                />
              </label>
            </div>

            <fieldset className="mt-4">
              <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-text-muted">Attachments</legend>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                {[
                  ["google_html", "Google report (PDF)"],
                  ["meta_html", "Meta report (PDF)"],
                  ["summary_csv", "Summary CSV"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-xl border border-border bg-surface-hover/40 px-3 py-2 text-sm font-bold text-foreground">
                    <input
                      type="checkbox"
                      checked={Boolean(emailSettings.attachments[key as keyof EmailReportSettings["attachments"]])}
                      onChange={(event) =>
                        updateEmailSettings({
                          attachments: {
                            ...emailSettings.attachments,
                            [key]: event.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-accent-primary"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {(settingsError || settingsMessage) && (
              <div className={`mt-4 rounded-xl border px-3 py-2 text-sm font-medium ${
                settingsError ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"
              }`}>
                {settingsError || settingsMessage}
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-medium text-text-muted">
                {loadingSettings ? (
                  <>
                    <Clock className="h-4 w-4 text-text-muted" />
                    Loading report settings...
                  </>
                ) : hasUnsavedChanges ? (
                  <>
                    <AlertCircle className="h-4 w-4 text-accent-orange" />
                    Unsaved changes — click Save to apply your schedule.
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-accent-green" />
                    All changes saved.
                  </>
                )}
              </div>
              <button
                onClick={saveEmailSettings}
                disabled={savingSettings || !hasUnsavedChanges}
                className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingSettings ? "Saving..." : "Save Email Settings"}
              </button>
            </div>
          </section>
        </div>
        {/* Generate Report Now */}
        <section className="max-w-6xl bg-surface shadow-sm rounded-2xl p-6 border border-border/60">
          <div className="mb-5">
            <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
              <FileText className="h-5 w-5 text-accent-primary" />
              Generate Report Now
            </h2>
            <p className="mt-1 text-xs font-medium text-text-muted">
              Trigger a one-time data fetch and send the report to the specified email addresses.
            </p>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Date Range</span>
            {(["7", "30", "90"] as const).map((n) => (
              <button
                key={n}
                onClick={() => { setReportRange(n); setReportStatus("idle"); }}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  reportRange === n
                    ? "bg-accent-primary text-white border-accent-primary"
                    : "bg-surface-hover border-border text-foreground hover:border-accent-primary"
                }`}
              >
                Last {n} days
              </button>
            ))}
          </div>

          <div className="mb-5 max-w-lg">
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-muted">
                <Mail className="h-3.5 w-3.5" />
                Send To
              </span>
              <input
                type="text"
                value={reportEmail}
                onChange={(e) => { setReportEmail(e.target.value); setReportStatus("idle"); }}
                placeholder="email@example.com, another@example.com"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground focus:border-accent-primary focus:outline-none"
              />
            </label>
          </div>

          {reportStatus === "done" && (
            <div className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Report queued — check your email.
            </div>
          )}
          {reportStatus === "pending" && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0" />
              Still processing — this report is taking longer than usual. It will arrive by email once it finishes.
            </div>
          )}
          {reportStatus === "error" && reportError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {reportError}
            </div>
          )}

          <button
            onClick={generateReport}
            disabled={reportStatus === "generating"}
            className="inline-flex items-center gap-2 rounded-xl bg-accent-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reportStatus === "generating" ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Generate &amp; Send Report
              </>
            )}
          </button>
        </section>

      </div>
    </DashboardLayout>
  );
}
