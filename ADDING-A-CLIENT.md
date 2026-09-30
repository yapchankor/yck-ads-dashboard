# Adding a New Client Dashboard (White-Label Guide)

This dashboard is a **white-label, multi-tenant** product. One codebase serves every client.
A new client is **a config entry + their data + a deploy with two env vars**. No forking, no
duplicated code. The active client is chosen at deploy time by an environment variable, not in
code, so the same repo renders as YCK, Genera, or any future client depending on how it's deployed.

- **Repo:** `C:/Users/Andrea/yck-ads-dashboard-client` (frontend in `/frontend`, backend in `/execution`)
- **Single source of truth for branding/currency:** `frontend/src/lib/client-config.ts`
- **Active client is resolved from:** `NEXT_PUBLIC_ADSPULSE_CLIENT` (theme + currency) and
  `ADSPULSE_DEFAULT_CLIENT_NAME` (which client's data to pull). Both must be set to the same
  **client key** on each deploy.

> The **client key** is the exact client-name string (e.g. `"YAP CHAN KOR"`, `"GENERA"`). It is
> used identically in the backend refresh, the config map, and both env vars. Keep it consistent.

---

## Before you start (collect per client)

- Google Ads **Customer ID** (e.g. `7867388610`)
- Meta/Facebook **Ad Account ID** (e.g. `act_717673122125428`)
- Their **brand**: logo (SVG), primary colour, background, accent colour, and **currency**
- Their **two chart-series colours** for the Campaign Performance graph (Google series + Meta
  series). **Every client picks its own** — do not reuse another client's. Pick two colours from
  their palette that read clearly against a white card.
- Access to: **Modal** (backend data), **Vercel** (deploy), **Clerk** (auth)

---

## Step 1 — Get their data flowing (backend / Modal)

The dashboard is empty without data. Deploy the backend (if changed) and refresh the client:

```bash
cd C:/Users/Andrea/yck-ads-dashboard-client/execution
PYTHONUTF8=1 modal deploy modal_cloud.py     # only needed if backend code changed

# Pull the client's Google + Meta data (last 90 days)
modal run modal_cloud.py::refresh_client_now \
  --client-name "ACME RETAIL" \
  --customer-id 1234567890 \
  --facebook-ad-account-id act_1234567890 \
  --days 90

# Confirm the data landed
modal run modal_cloud.py::verify_phase1 \
  --client-name "ACME RETAIL" \
  --customer-id 1234567890 \
  --facebook-ad-account-id act_1234567890
```

The `--client-name` you use here **is the client key** for the rest of this guide.

---

## Step 2 — Add the branding config (this repo)

Edit `frontend/src/lib/client-config.ts`:

**2a.** Add the key to the `ClientKey` union at the top:

```ts
export type ClientKey = "YAP CHAN KOR" | "GENERA" | "ACME RETAIL";
```

**2b.** Add an entry to the `CLIENTS` map:

```ts
"ACME RETAIL": {
  key: "ACME RETAIL",
  currency: { code: "USD", locale: "en-US", symbol: "$" },
  brand: {
    appName: "Acme Ads Dashboard",
    metaTitle: "Acme Ads Dashboard",
    metaDescription: "Acme advertising performance dashboard for Google Ads and Meta Ads.",
    sidebarVariant: "dark",                 // "light" (YCK style) or "dark" (Genera style)
    logo: { image: "/acme-logo.svg", title: "Acme", subtitle: "Ads Dashboard" },
    clerk: { colorPrimary: "#1B4D3E", colorBackground: "#FFFFFF", colorText: "#14201E" },
    cssVars: {
      "--color-background": "#F5F7F6",
      "--color-surface": "#FFFFFF",
      "--color-surface-hover": "#EEF2F0",
      "--color-border": "#DDE5E2",
      "--color-foreground": "#14201E",
      "--color-text-muted": "#6B7C78",
      "--color-accent-primary": "#1B4D3E",
      "--color-accent-lime": "#DCEEE7",
      "--color-accent-salmon": "#E07A5F",
      "--color-accent-green": "#2FA36B",
      "--color-accent-red": "#E5484D",
      "--color-accent-orange": "#F2A007",
      "--color-sidebar": "#0F3A30",         // dark variant: sidebar bg
      "--color-sidebar-hover": "#15493C",
      "--color-chart-google": "#1B4D3E",    // Campaign Performance series 1
      "--color-chart-meta": "#F2A007",      // Campaign Performance series 2
    },
  },
},
```

**2c.** Drop the logo file into `frontend/public/` (e.g. `acme-logo.svg`). Text-only logo? Omit
`logo.image` and it renders the wordmark alone (that's how YCK works).

### Field reference

| Field | What it controls |
|---|---|
| `currency.code` / `.locale` | Intl currency formatting (e.g. `USD` / `en-US` → `$1,234.56`) |
| `currency.symbol` | Prefix for hand-built strings (include a trailing space if the currency uses one, e.g. `"RM "`) |
| `sidebarVariant` | `"light"` = light sidebar, dark text, lime active tabs (YCK). `"dark"` = dark sidebar, white text, orange active tabs, **plus a mobile drawer** (Genera). |
| `logo.image` / `.title` / `.subtitle` | Sidebar + login + mobile-header logo |
| `clerk.*` | Login form colours |
| `cssVars` | The full palette (see token table at the bottom). Injected onto `<html>` at runtime. |

If `NEXT_PUBLIC_ADSPULSE_CLIENT` is unset or unknown, the app falls back to `"YAP CHAN KOR"`.

---

## Step 3 — Preview locally (recommended)

Run the client side by side with YCK. `NEXT_DIST_DIR` keeps their build caches isolated so the
inlined client value doesn't cross-contaminate:

```bash
cd C:/Users/Andrea/yck-ads-dashboard-client/frontend

# YCK on 3000
npm run dev -- -p 3000

# New client on 3001 (separate terminal)
NEXT_PUBLIC_ADSPULSE_CLIENT="ACME RETAIL" NEXT_DIST_DIR=.next-acme npm run dev -- -p 3001
```

Open `http://localhost:3001`. Note: locally both servers read the same `.env.local`, so the
preview shows **the new client's theme + currency applied to whatever backend `.env.local` points
at**. That's fine for judging the look. Real data appears once deployed with its own
`ADSPULSE_DEFAULT_CLIENT_NAME`.

---

## Step 4 — Deploy (Vercel)

Create a **new Vercel project** pointing at this repo. **Root Directory = `frontend`.**

Set these environment variables on the project:

| Env var | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_ADSPULSE_CLIENT` | the client key (`ACME RETAIL`) | Theme + currency |
| `ADSPULSE_DEFAULT_CLIENT_NAME` | the client key (`ACME RETAIL`) | Which client's data to pull |
| `ADSPULSE_ALLOWED_CLIENTS` | the client key (comma-list if several) | Authorises the client for this deploy |
| `MODAL_API_BASE_URL` | (copy from an existing client's Vercel project) | Backend data API |
| `MODAL_REFRESH_URL`, `MODAL_REFRESH_STATUS_URL`, `MODAL_APPLY_URL`, `MODAL_TRACKING_URL`, `MODAL_TRACKING_DELETE_URL`, `MODAL_EMAIL_SETTINGS_URL`, `MODAL_EMAIL_SETTINGS_UPDATE_URL` | (copy from existing project) | Backend endpoints |
| `ADSPULSE_INTERNAL_API_KEY` | (copy from existing project) | Backend auth |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | the client's own Clerk instance | Login (isolated user pool per client) |

Then deploy. Because it's a Git-connected Vercel project you can deploy by pushing, or via CLI
from the **repo root** (`vercel --prod`). Each client gets its own Clerk instance so their users
are isolated.

---

## Checklist

- [ ] Backend refreshed for the client; `verify_phase1` passes
- [ ] `ClientKey` union updated + `CLIENTS` entry added
- [ ] Chart-series colours (`--color-chart-google` / `--color-chart-meta`) set to this client's own palette
- [ ] Logo SVG in `frontend/public/`
- [ ] Previewed locally (theme, currency, sidebar, chart colours all correct)
- [ ] New Vercel project, Root Directory = `frontend`
- [ ] Both `NEXT_PUBLIC_ADSPULSE_CLIENT` and `ADSPULSE_DEFAULT_CLIENT_NAME` = the client key
- [ ] `ADSPULSE_ALLOWED_CLIENTS`, `MODAL_*`, `ADSPULSE_INTERNAL_API_KEY`, Clerk keys set
- [ ] Deployed; login shows their brand; data loads; currency + chart colours correct

---

## Palette token reference (`cssVars`)

All 16 tokens a client entry should define. Values are injected onto `<html>` at runtime, so
they override the defaults in `globals.css` for that client.

| Token | Used for |
|---|---|
| `--color-background` | Page background |
| `--color-surface` | Cards / panels |
| `--color-surface-hover` | Hover surfaces |
| `--color-border` | Borders / dividers |
| `--color-foreground` | Primary text |
| `--color-text-muted` | Secondary text |
| `--color-accent-primary` | Brand primary (buttons, headings, active text) |
| `--color-accent-lime` | Light active/highlight background (light sidebar active tab) |
| `--color-accent-salmon` | Soft negative background |
| `--color-accent-green` | Positive / "good" |
| `--color-accent-red` | Negative / "bad" |
| `--color-accent-orange` | Dark-sidebar active tab / CTAs (set = primary if unused) |
| `--color-sidebar` | Sidebar background (dark variant) |
| `--color-sidebar-hover` | Sidebar hover (dark variant) |
| `--color-chart-google` | Campaign Performance — Google series |
| `--color-chart-meta` | Campaign Performance — Meta series |

---

## Gotchas

- **Keys must match exactly.** `NEXT_PUBLIC_ADSPULSE_CLIENT`, `ADSPULSE_DEFAULT_CLIENT_NAME`, the
  `CLIENTS` map key, and the backend `--client-name` are all the same string. A mismatch = wrong
  theme, no data, or a 403.
- **Deploy the YCK project from the repo root**, not `/frontend` (its Root Directory is set to
  `frontend`).
- **Vercel CLI account switching:** projects can live under different Vercel accounts
  (YCK = `yapchankor79`, Genera = `rossiandrea18`). The CLI authenticates one account at a time
  and `--scope` won't cross accounts; use `vercel switch` / `vercel login` interactively.
- **Chart colours are per-client** via `--color-chart-google` / `--color-chart-meta`, and every
  client must use its own combination. If you omit them the config falls back to **that client's
  own** `--color-accent-primary` / `--color-accent-orange` (never another client's palette), but
  set them explicitly to get the intended look.
- **Currency symbol** carries any needed trailing space (`"RM "` vs `"$"`); the Intl formatter
  handles separators and decimals from `code` + `locale`.
