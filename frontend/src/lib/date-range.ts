export type DateRangeSelection = {
  startDate: string;
  endDate: string;
  days?: number;
  label?: string;
};

export type DashboardDateRange = {
  days?: number;
  start_date?: string;
  end_date?: string;
} | null | undefined;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
}

export function getPresetRange(days: number): DateRangeSelection {
  const end = new Date();
  const start = new Date(end);
  start.setDate(end.getDate() - days + 1);

  return {
    days,
    label: `Last ${days} Days`,
    startDate: toDateInputValue(start),
    endDate: toDateInputValue(end),
  };
}

export function getRangeDayCount(startDate: string, endDate: string) {
  const start = parseDateInput(startDate);
  const end = parseDateInput(endDate);
  if (!start || !end) return undefined;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1);
}

export function normalizeDashboardDateRange(range: DashboardDateRange): DateRangeSelection {
  if (range?.start_date && range?.end_date) {
    return {
      startDate: range.start_date,
      endDate: range.end_date,
      days: range.days ?? getRangeDayCount(range.start_date, range.end_date),
    };
  }

  return getPresetRange(30);
}

export function formatRangeLabel(range: DashboardDateRange | DateRangeSelection) {
  const normalized =
    "startDate" in (range || {})
      ? (range as DateRangeSelection)
      : normalizeDashboardDateRange(range as DashboardDateRange);

  if (normalized.label && normalized.label !== "Custom Range") {
    return normalized.label;
  }

  const matchingPreset = [7, 30, 90].find((days) => {
    const preset = getPresetRange(days);
    return normalized.startDate === preset.startDate && normalized.endDate === preset.endDate;
  });

  if (matchingPreset) {
    return `Last ${matchingPreset} Days`;
  }

  const start = parseDateInput(normalized.startDate);
  const end = parseDateInput(normalized.endDate);

  if (!start || !end) return "Custom Range";

  const formatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

export function rangesMatch(dataRange: DashboardDateRange, selection: DateRangeSelection) {
  return (
    dataRange?.start_date === selection.startDate &&
    dataRange?.end_date === selection.endDate
  );
}
