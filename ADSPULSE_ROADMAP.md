# ADSPULSE — Full Product Roadmap

**Last updated:** 2026-05-04  
**Codebase:** `c:\Users\Andrea\yck-ads-dashboard-client`  
**Backend:** `execution/modal_cloud.py` on Modal Cloud  
**Frontend:** Next.js App Router, Tailwind CSS, Vercel

---

## Current Architecture

| Layer | Tech | Status |
|---|---|---|
| Frontend | Next.js + Tailwind CSS | Live |
| Backend | Modal Cloud (Python / FastAPI) | Live |
| Google executor | `execution/google_ads_executor.py` | Live |
| Meta executor | `execution/meta_ads_executor.py` | Live |
| Data storage | JSON on Modal persistent volume | Live |
| Auth | Clerk | Live |
| Deployment | Vercel (frontend) + Modal (backend) | Live |

---

## Phase 1 — COMPLETE

### MVP Core
- [x] Google Ads integration — full data fetch and display
- [x] Meta Ads integration — full data fetch and display
- [x] Unified main dashboard (Overview page) — blended metrics, campaign table, date range picker, platform filter toggle
- [x] Recommendations engine — AI-generated, platform-tagged, evidence-based cards
- [x] Action system — Apply Now (auto via API), Mark as Implemented (manual), Dismiss
- [x] Outcome Tracking page — day 0 / 7 / 14 / 30 snapshots, status lifecycle (Pending → Tracking → Completed → Dismissed)
- [x] Authentication — Clerk sign-in / sign-up
- [x] Settings page — email report configuration

### Google Ads Deep-Dive Page (`/google`)
- [x] Account-level KPI strip (spend, conversions, CPA, ROAS, impressions, clicks)
- [x] AI Insights Summary
- [x] Budget Pacing — daily avg spend, projected monthly, days in period
- [x] Search Term Intelligence — waste tally, intent analysis
- [x] Quality Score Roadmap — low QS keyword list with landing page / ad relevance / CTR breakdown
- [x] Campaign Performance table with insight labels (Top performer / High CPA / Spending no conv / Strong ROAS)
- [x] Ad Group Performance table with filter bar (Top Spenders / Has Conversions / Spending No Conv / All)
- [x] Keywords table with filter bar
- [x] Search Query Report table with filter bar
- [x] Wasted Search Terms — interactive per-row `+ Add Negative` and `Ignore 30d` buttons, applied via live Google Ads API
- [x] Negative Keyword Candidates — pattern-based, `+ Add Negative` button
- [x] Negative Keyword Inventory — existing negatives list
- [x] Geographic Performance + Geographic Summary
- [x] Device Performance
- [x] Landing Page Heatmap — URL-level clicks, conversions, conv rate, cost
- [x] Responsive Search Ads table
- [x] Hour of Day Performance + Day of Week Performance
- [x] Conversion Tracking Health — active campaigns with/without conversions
- [x] Anomaly detection alert banners — zero-conv waste, CPA spike, zero total conversions
- [x] Optimization Recommendations section

### Meta Ads Deep-Dive Page (`/meta`)
- [x] Account-level KPI strip (spend, conversions, CPA, ROAS, impressions, reach, CPM, CTR)
- [x] AI Insights Summary
- [x] Campaign Performance table with insight labels (Top performer / High CPA / Spending no conv / Creative fatigue risk)
- [x] Ad Set Performance table
- [x] Placement Performance table
- [x] Demographic Performance (age × gender breakdown)
- [x] Geographic Performance
- [x] Hourly Performance + Day of Week Performance
- [x] Conversion Tracking Health — active campaigns with/without conversions
- [x] Anomaly detection alert banners — zero-conv waste, CPA spike, high frequency (creative fatigue)
- [x] Optimization Recommendations section

### Recommendations Page (`/recommendations`)
- [x] Split into Google Ads section (top) and Meta Ads section (bottom)
- [x] Total Expected Impact card per platform — Monthly Savings, Additional Conversions, Additional Revenue, Net Monthly Benefit at 70% moderate confidence
- [x] Impact computed from structured `impact_data` fields (same source as HTML reports — `calculate_total_impact.py`)
- [x] Automation status — X auto-actionable · Y manual required

### Live API Execution — What Actually Fires
**Google Ads (via `google_ads_executor.py`):**
- [x] Add negative keyword to campaign
- [x] Pause keyword (ad group criterion)
- [x] Update keyword bid (ad group criterion)

**Meta Ads (via `meta_ads_executor.py`):**
- [x] Pause campaign
- [x] Pause ad set
- [x] Pause ad (creative refresh)
- [x] Update campaign budget
- [x] Update ad set budget
- [x] Scale campaign budget (25%)
- [x] Scale ad set budget (25%)
- [x] Exclude demographic segment (age / gender)
- [x] Exclude placement
- [x] Exclude geo location
- [x] Adjust ad schedule (best hours)
- [x] Adjust day schedule (wasted days)

---

## Phase 2 — Next Priority

These are the highest-value gaps relative to the V2 vision. Ordered by business impact.

---

### 2.1 Google Ads Executor — Missing Actions

**What's missing:** The Google executor only handles negative keywords, keyword pause, and bid updates. Campaign-level and budget actions on Google are not wired.

**Actions to add to `google_ads_executor.py` and route in `modal_cloud.py`:**

| Action | API Operation |
|---|---|
| Pause campaign | `CampaignService.MutateCampaigns` with status = PAUSED |
| Enable campaign | `CampaignService.MutateCampaigns` with status = ENABLED |
| Update campaign budget | `CampaignBudgetService.MutateCampaignBudgets` |
| Schedule bid adjustment | `CampaignCriterionService` with time bid modifiers |
| Device bid adjustment | `CampaignCriterionService` with device bid modifiers |
| Geo bid adjustment | `CampaignCriterionService` with location bid modifiers |

**Files:** `execution/google_ads_executor.py`, `execution/modal_cloud.py` (add branches under the Google executor block around line 1816)

---

### 2.2 In-App Report Generation Trigger

**What's missing:** HTML reports exist and are generated by `create_html_dashboard.py` / `create_facebook_html_dashboard.py` but can only be triggered via backend scripts. Users cannot generate or download them from within the app.

**What to build:**
- "Generate Report" button on the Settings page or a new Reports section
- Calls a new Modal endpoint that runs the report generation pipeline
- Returns a download link or emails the report to the configured address
- Show generation status (queued → generating → ready)

**Files:** `execution/modal_cloud.py` (new endpoint), `frontend/src/app/settings/page.tsx`

---

### 2.3 Manual Data Sync / Refresh Button

**What's missing:** The date picker triggers a cached data re-fetch, but there is no button to trigger a full backend data sync from the live Google Ads and Meta APIs.

**What to build:**
- "Sync Now" button on the main dashboard header or settings
- Calls the Modal report generation endpoint to pull fresh data
- Shows sync in progress (spinner + "Syncing live data" badge already exists)
- Refreshes the page data once complete

**Files:** `execution/modal_cloud.py`, `frontend/src/app/page.tsx`

---

### 2.4 Enhanced Budget Pacing

**What's missing:** The Budget Pacing section exists on the Google page and shows daily avg spend and projected monthly spend. It is missing:
- Monthly budget target (the planned total)
- Pacing variance (over / under vs. plan)
- Projected month-end spend vs. budget
- Recommended action (hold / increase / decrease / pause)

**What to build:**
- Add budget target input (stored in settings or passed from the `daily_budget` field on campaigns)
- Compute: pacing variance %, projected overspend/underspend, recommended action
- Colour-code: green (on track), amber (over/under by >10%), red (critical over/under by >25%)

**Files:** `frontend/src/app/google/page.tsx` (Budget Pacing SectionCard)

---

### 2.5 Change Log / Audit Trail UI

**What's missing:** The Outcome Tracking page shows applied recommendations, but there is no view of what actions were executed, when, by whom, and what the before/after was.

**What to build:**
- Dedicated section on the Tracking page (or new tab) showing a chronological log
- Each entry: timestamp, action type, platform, target (campaign/keyword), before value, after value, execution status
- Sourced from the existing `tracking.json` data that is already written on every apply
- Filter by platform, date range, status (Applied / Manual / Dismissed / Failed)

**Files:** `frontend/src/app/tracking/page.tsx`

---

### 2.6 Meta Creative Visual Display

**What's missing:** The Meta page shows ad-level text data (name, status, spend, conversions) but no actual creative visuals. Users cannot see what the ads look like without going to Meta Ads Manager.

**What to build:**
- Fetch ad creative thumbnail URLs from Meta API (available via `creative` fields on the Ads endpoint)
- Render a creative card grid: thumbnail, headline, primary text, CTA, spend, CPA, frequency
- Flag fatigued creatives visually (high frequency badge, CTR trend arrow)

**Files:** `execution/fetch_facebook_ads_metrics.py` (add creative thumbnail fields), `frontend/src/app/meta/page.tsx`

---

## Phase 3 — Advanced Intelligence

These require more significant architectural changes or new data sources.

---

### 3.1 Multi-Client / Agency Dashboard

**What's missing:** The app is single-client. The `manage_clients.py` backend script exists and clients.json is used for routing, but the frontend has no client-switcher or agency overview.

**PRD note:** Explicitly listed as Phase 2 in the PRD ("Agency multi-account dashboards, if needed, Phase 2").

**What to build:**
- Client selector on the sidebar or settings
- Agency overview page: all clients, each showing blended spend / CPA / recommendation count
- Per-client data scoping already works via `client_name` in the API — the frontend just needs to support switching

**Files:** `frontend/src/components/layout/DashboardLayout.tsx`, new `frontend/src/app/clients/page.tsx`, `execution/modal_cloud.py`

---

### 3.2 Cross-Platform Attribution View

**What's missing:** Google and Meta both claim conversions independently. There is no reconciliation with actual CRM / GA4 / business outcome data.

**What to build:**
- Attribution summary: Google claimed conversions, Meta claimed conversions, total unique (deduplicated estimate)
- Optional CRM/GA4 connection: enter actual leads received in the period
- Blended CAC calculation: total spend ÷ actual leads
- Discrepancy flag: if platform-claimed total is >2× CRM actual, surface a tracking integrity warning

**Files:** New API endpoints, `frontend/src/app/page.tsx` (overview section)

---

### 3.3 "What Changed?" Performance Timeline

**What's missing:** There is no view connecting campaign edits (bid changes, budget changes, pauses) to performance shifts in the days that followed.

**What to build:**
- Timeline chart: CPA / spend / conversions over time with edit markers (vertical lines)
- Data sourced from: tracking.json (applied changes) + daily performance snapshots
- Use case: "Budget was increased on May 1. CPA rose 38% over the next 3 days."

**Files:** Requires daily snapshot storage in `modal_cloud.py`, new frontend timeline component

---

### 3.4 AI Media Buyer Chat Interface

**What's missing:** No natural language interface for querying account data.

**What to build:**
- Chat panel (slide-in or dedicated `/chat` page)
- Connects to Claude API with account data as context
- Example queries: "Which campaigns wasted the most money this week?", "Why did CPA increase?", "What should I scale with RM1,000 extra budget?"
- Responses cite actual campaign/keyword data, not generic advice

**Files:** New `frontend/src/app/chat/page.tsx`, new Modal endpoint for AI query routing

---

## Summary Table

| Item | Phase | Effort | Impact |
|---|---|---|---|
| Google executor — campaign pause/enable | 2.1 | Low | High |
| Google executor — budget update | 2.1 | Low | High |
| Google executor — schedule/device/geo bid | 2.1 | Medium | Medium |
| In-app report generation trigger | 2.2 | Medium | High |
| Manual sync / refresh button | 2.3 | Low | Medium |
| Enhanced budget pacing | 2.4 | Low | Medium |
| Change log / audit trail UI | 2.5 | Medium | Medium |
| Meta creative visual display | 2.6 | Medium | High |
| Multi-client agency dashboard | 3.1 | High | High |
| Cross-platform attribution view | 3.2 | High | High |
| "What changed?" timeline | 3.3 | High | Medium |
| AI media buyer chat interface | 3.4 | High | High |

---

## Navigation (Current)

```
/ ............... Overview (main dashboard)
/google ......... Google Ads deep-dive
/meta ........... Meta Ads deep-dive
/recommendations  Recommendations engine
/tracking ....... Outcome tracking
/settings ....... Configuration
```

---

## Key Files Reference

| File | Purpose |
|---|---|
| `frontend/src/app/page.tsx` | Main dashboard |
| `frontend/src/app/google/page.tsx` | Google Ads deep-dive |
| `frontend/src/app/meta/page.tsx` | Meta Ads deep-dive |
| `frontend/src/app/recommendations/page.tsx` | Recommendations engine |
| `frontend/src/app/tracking/page.tsx` | Outcome tracking |
| `frontend/src/app/settings/page.tsx` | Settings |
| `frontend/src/lib/types.ts` | Shared TypeScript types |
| `frontend/src/components/ui/RecommendationCard.tsx` | Recommendation card + apply logic |
| `frontend/src/components/ui/DataTable.tsx` | Main campaign table with insight labels |
| `frontend/src/components/ui/UnifiedMetricsCard.tsx` | Metrics card + anomaly alerts |
| `execution/modal_cloud.py` | Backend: data fetch, apply endpoint, guardrails |
| `execution/google_ads_executor.py` | Google Ads live API mutations |
| `execution/meta_ads_executor.py` | Meta Ads live API mutations |
| `execution/calculate_total_impact.py` | Impact aggregation (used by HTML reports) |
| `execution/impact_models.py` | Impact calculation formulas per action type |
| `Google_Ads_Report_YAP CHAN KOR.html` | Reference HTML report (Google) |
| `Facebook_Ads_Report_YAP CHAN KOR.html` | Reference HTML report (Meta) |
| `V2 idea for the ads dashboard.md` | V2 vision document |
| `📄 Product Requirements Document (PRD) - Adspulse.md` | PRD |
