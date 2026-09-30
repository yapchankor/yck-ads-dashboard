// Multi-tenant client configuration for the Adspulse dashboard.
//
// One codebase serves multiple clients (YCK, Genera, ...). The active client is
// resolved from NEXT_PUBLIC_ADSPULSE_CLIENT, which is baked per Vercel deploy so it
// is available in both server and client components. It defaults to "YAP CHAN KOR"
// so the app renders byte-identically to the original standalone YCK build when the
// env var is unset.
//
// Currency helpers here are drop-in replacements for the hardcoded formatters
// scattered across the app. They deliberately mirror the three existing patterns so
// migrated call sites keep producing identical output for YCK:
//   1. Intl currency  -> formatCurrency()   (RM 1,234.56 — thousands separators)
//   2. literal prefix  -> currencySymbol()   ("RM " + hand-built number, no separators)
//   3. locale number   -> formatNumber()     (plain locale-formatted number, no currency)

export type ClientKey = "YAP CHAN KOR" | "GENERA";

export interface ClientCurrency {
  /** ISO 4217 code, e.g. "MYR". */
  code: string;
  /** BCP 47 locale, e.g. "en-MY". */
  locale: string;
  /** Literal prefix used by hand-built (non-Intl) strings, e.g. "RM ". */
  symbol: string;
}

export interface ClientLogo {
  /** Optional logo image served from /public (e.g. "/genera-logo.svg"). Text-only if omitted. */
  image?: string;
  /** Primary wordmark, e.g. "YCK Ads Dashboard" or "Genera". */
  title: string;
  /** Optional secondary line under the wordmark, e.g. "Ads Dashboard". */
  subtitle?: string;
}

export interface ClientBrand {
  /** Sidebar logo text / aria label. */
  appName: string;
  /** <title> and description. */
  metaTitle: string;
  metaDescription: string;
  /** Sidebar colour scheme. "light" = YCK (light bg, dark text, lime active);
   *  "dark" = Genera (teal bg, white text, orange active + mobile drawer). */
  sidebarVariant: "light" | "dark";
  /** Sidebar logo. */
  logo: ClientLogo;
  /** Clerk appearance variables. */
  clerk: {
    colorPrimary: string;
    colorBackground: string;
    colorText: string;
  };
  /** --color-* custom-property overrides applied to :root at runtime.
   *  Each client stores its own real @theme token set. */
  cssVars: Record<string, string>;
}

export interface ClientConfig {
  key: ClientKey;
  currency: ClientCurrency;
  brand: ClientBrand;
  /** IANA timezone used as the default for scheduled email reports, e.g. "Asia/Kuala_Lumpur". */
  timezone: string;
}

const CLIENTS: Record<ClientKey, ClientConfig> = {
  "YAP CHAN KOR": {
    key: "YAP CHAN KOR",
    currency: { code: "MYR", locale: "en-MY", symbol: "RM " },
    timezone: "Asia/Kuala_Lumpur",
    brand: {
      appName: "YCK Ads Dashboard",
      metaTitle: "YCK Ads Dashboard",
      metaDescription: "YCK advertising performance dashboard for Google Ads and Meta Ads.",
      sidebarVariant: "light",
      logo: { title: "YCK Ads Dashboard" },
      clerk: {
        colorPrimary: "#1E3F36",
        colorBackground: "#FFFFFF",
        colorText: "#1A202C",
      },
      cssVars: {
        "--color-background": "#F4F5F7",
        "--color-surface": "#FFFFFF",
        "--color-surface-hover": "#F8F9FA",
        "--color-border": "#E2E8F0",
        "--color-foreground": "#1A202C",
        "--color-text-muted": "#718096",
        "--color-accent-primary": "#1E3F36",
        "--color-accent-lime": "#D7F7C2",
        "--color-accent-salmon": "#FF8C73",
        "--color-accent-green": "#38A169",
        "--color-accent-red": "#E53E3E",
        // Sidebar tokens: YCK's sidebar is light (bg-surface / hover bg-surface-hover).
        "--color-sidebar": "#FFFFFF",
        "--color-sidebar-hover": "#F8F9FA",
        // Orange accent unused by YCK; mirror the primary so nothing reads as unset.
        "--color-accent-orange": "#1E3F36",
        // Chart series (Campaign Performance): readable green Google + forest-green Meta.
        "--color-chart-google": "#2F9E44",
        "--color-chart-meta": "#1E3F36",
      },
    },
  },
  GENERA: {
    key: "GENERA",
    currency: { code: "GBP", locale: "en-GB", symbol: "£" },
    timezone: "Europe/London",
    brand: {
      appName: "Genera Ads Dashboard",
      metaTitle: "Genera Ads Dashboard",
      metaDescription: "Genera advertising performance dashboard for Google Ads and Meta Ads.",
      sidebarVariant: "dark",
      logo: { image: "/genera-logo.svg", title: "Genera", subtitle: "Ads Dashboard" },
      clerk: {
        colorPrimary: "#0E5C55",
        colorBackground: "#FFFFFF",
        colorText: "#14201E",
      },
      cssVars: {
        "--color-background": "#F4F7F6",
        "--color-surface": "#FFFFFF",
        "--color-surface-hover": "#EEF3F1",
        "--color-border": "#DCE6E3",
        "--color-foreground": "#14201E",
        "--color-text-muted": "#6B7C78",
        "--color-accent-primary": "#0E5C55",
        "--color-accent-lime": "#D6EEE8",
        "--color-accent-salmon": "#E07A5F",
        "--color-accent-green": "#2FA36B",
        "--color-accent-red": "#E5484D",
        "--color-accent-orange": "#FFA601",
        "--color-sidebar": "#0C3B37",
        "--color-sidebar-hover": "#124b46",
        // Chart series (Campaign Performance): Genera teal Google + orange Meta.
        "--color-chart-google": "#0E5C55",
        "--color-chart-meta": "#FFA601",
      },
    },
  },
};

// House rule: every client uses its OWN chart-series colours. If an entry omits the chart
// tokens, fall back to that client's accent-primary / accent-orange — never another client's
// palette. Both current clients set these explicitly, so this is a safety net for future entries.
for (const config of Object.values(CLIENTS)) {
  const v = config.brand.cssVars;
  if (!v["--color-chart-google"]) v["--color-chart-google"] = v["--color-accent-primary"];
  if (!v["--color-chart-meta"]) v["--color-chart-meta"] = v["--color-accent-orange"] || v["--color-accent-primary"];
}

const DEFAULT_CLIENT: ClientKey = "YAP CHAN KOR";

/** Resolve the active client config from NEXT_PUBLIC_ADSPULSE_CLIENT. */
export function getActiveClient(): ClientConfig {
  const raw = (process.env.NEXT_PUBLIC_ADSPULSE_CLIENT || DEFAULT_CLIENT).trim();
  return CLIENTS[raw as ClientKey] ?? CLIENTS[DEFAULT_CLIENT];
}

/** Active client's default IANA timezone for scheduled email reports. */
export function clientTimezone(): string {
  return getActiveClient().timezone;
}

/** Active client key, e.g. "YAP CHAN KOR". Used to namespace per-client browser storage. */
export function activeClientKey(): ClientKey {
  return getActiveClient().key;
}

/** Intl currency format. Drop-in for Intl.NumberFormat(locale,{style:'currency',currency}). */
export function formatCurrency(value: number, options?: Intl.NumberFormatOptions): string {
  const { code, locale } = getActiveClient().currency;
  return new Intl.NumberFormat(locale, { style: "currency", currency: code, ...options }).format(value);
}

/** Literal currency symbol prefix for hand-built strings, e.g. `${currencySymbol()}${x.toFixed(2)}`. */
export function currencySymbol(): string {
  return getActiveClient().currency.symbol;
}

/** Locale-aware plain number (no currency). Drop-in for x.toLocaleString(locale, options). */
export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getActiveClient().currency.locale, options).format(value);
}
