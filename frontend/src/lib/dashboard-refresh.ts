import { DateRangeSelection, rangesMatch } from "@/lib/date-range";

type RefreshOptions = {
  range: DateRangeSelection;
  clientName?: string | null;
  attempts?: number;
  intervalMs?: number;
  onData?: (data: any, warning?: string) => void;
};

type RefreshDashboardResult = {
  data: any;
  warning?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response: Response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || payload.message || "Request failed";
    throw new Error(`${message} (${response.status})`);
  }
  return payload;
}

function getRefreshWarning(data: any, range: DateRangeSelection) {
  if (!rangesMatch(data.date_range, range)) {
    return "Refresh is still processing. Showing the latest available data for now.";
  }

  if (
    data.facebook_ad_account_id &&
    data.platform_date_ranges?.meta &&
    !rangesMatch(data.platform_date_ranges.meta, range)
  ) {
    return "Google Ads refreshed, but Meta Ads is still processing or returned the previous range. Showing the latest available Meta data until it catches up.";
  }

  return undefined;
}

async function pollDashboardRange({
  range,
  clientName,
  attempts,
  intervalMs,
}: Required<Pick<RefreshOptions, "range" | "attempts" | "intervalMs">> & Pick<RefreshOptions, "clientName">): Promise<RefreshDashboardResult> {
  let latestData: any = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await sleep(attempt === 0 ? 2000 : intervalMs);
    const data = await fetchDashboardData(clientName, range);
    latestData = data;

    if (rangesMatch(data.date_range, range)) {
      const warning = getRefreshWarning(data, range);
      if (!warning) {
        return { data };
      }
      if (attempt >= 8) {
        return { data, warning };
      }
    }
  }

  if (latestData) {
    return {
      data: latestData,
      warning: getRefreshWarning(latestData, range),
    };
  }

  throw new Error("Refresh started, but the new date range is still processing. Please try again in a minute.");
}

export async function fetchDashboardData(clientName?: string | null, range?: DateRangeSelection | null) {
  const params = new URLSearchParams();
  if (clientName) {
    params.set("client", clientName);
  }
  if (range) {
    params.set("start_date", range.startDate);
    params.set("end_date", range.endDate);
  }
  const query = params.toString();
  const url = query ? `/api/data?${query}` : "/api/data";

  const response = await fetch(url, { cache: "no-store" });
  return readJson(response);
}

export async function waitForDashboardRange({
  range,
  clientName,
  attempts = 72,
  intervalMs = 5000,
  onData,
}: RefreshOptions): Promise<RefreshDashboardResult> {
  let latestData: any = null;
  let latestWarning = "Refresh is still processing. Showing the latest available data for now.";

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await sleep(attempt === 0 ? 2000 : intervalMs);
    let data;
    try {
      data = await fetchDashboardData(clientName, range);
    } catch (err) {
      latestWarning = err instanceof Error ? err.message : latestWarning;
      continue;
    }
    latestData = data;
    const warning = getRefreshWarning(data, range);

    if (rangesMatch(data.date_range, range)) {
      onData?.(data, warning);
    }

    if (rangesMatch(data.date_range, range) && !warning) {
      return { data };
    }
  }

  return {
    data: latestData,
    warning: latestData
      ? getRefreshWarning(latestData, range)
      : latestWarning,
  };
}

export async function triggerDashboardRefresh({
  range,
  clientName,
}: RefreshOptions) {
  const response = await fetch("/api/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      days: range.days,
      start_date: range.startDate,
      end_date: range.endDate,
    }),
  });

  return readJson(response);
}

export async function refreshDashboardRange({
  range,
  clientName,
  attempts = 24,
  intervalMs = 5000,
}: RefreshOptions): Promise<RefreshDashboardResult> {
  await triggerDashboardRefresh({ range, clientName });
  return pollDashboardRange({ range, clientName, attempts, intervalMs });
}

type SyncOptions = {
  clientName?: string | null;
  range: DateRangeSelection;
  onData?: (data: any) => void;
  maxWaitMs?: number;
  pollIntervalMs?: number;
};

export async function syncDashboard({
  clientName,
  range,
  onData,
  maxWaitMs = 300_000,
  pollIntervalMs = 10_000,
}: SyncOptions): Promise<{ data: any; warning?: string }> {
  const baseline = await fetchDashboardData(clientName, range);
  const baselineFetchedAt = baseline?.fetched_at ?? null;

  await triggerDashboardRefresh({ range, clientName });

  await sleep(15_000);

  const maxAttempts = Math.floor((maxWaitMs - 15_000) / pollIntervalMs);

  for (let i = 0; i < maxAttempts; i++) {
    if (i > 0) await sleep(pollIntervalMs);
    let data: any;
    try {
      data = await fetchDashboardData(clientName, range);
    } catch {
      continue;
    }
    onData?.(data);
    if (data?.fetched_at && data.fetched_at !== baselineFetchedAt) {
      return { data };
    }
  }

  const latest = await fetchDashboardData(clientName, range);
  return {
    data: latest,
    warning: "Sync is still running — showing the latest available data. Check back in a minute.",
  };
}
