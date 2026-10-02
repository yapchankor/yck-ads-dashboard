# Master Technical Review & Architecture Plan: Adspulse Dashboard
**Repository:** `c:\Users\Andrea\yck-ads-dashboard-client`  
**Architecture:** Next.js 16 (React 19, Tailwind CSS v4, Clerk, Recharts) & Modal Python Cloud API (`modal_cloud.py`)  
**Tenants:** Multi-tenant deployment (YAP CHAN KOR & Genera)  
**Standard:** Enterprise Execution System, Operational Safety & Usability  
**Date:** October 2026  

---

## Executive Summary

ADSPULSE is not merely a reporting dashboard; it is a **live advertising execution system** with mutate capabilities directly wired into Google Ads and Meta Ads APIs. 

While the frontend exhibits high aesthetic quality and rich analytical modules (such as the Meta creative gallery and Google Quality Score roadmap), our architectural review establishes that **operational safety, mutation security, and mathematical integrity must take precedence over visual additions.**

This document establishes the finalized, production-grade review across all platform views and outlines an agreed 3-phase execution roadmap.

---

## Table of Contents
1. [Core Safety & Security Requirements (The Highest Priority)](#1-core-safety--security-requirements)
2. [Architectural Boundaries & Corrections](#2-architectural-boundaries--corrections)
3. [Page-by-Page Audit Findings](#3-page-by-page-audit-findings)
   - [Overview Page (`/`)](#31-overview-page-)
   - [Recommendations Engine (`/recommendations`)](#32-recommendations-engine-recommendations)
   - [Meta Ads Deep Dive (`/meta`)](#33-meta-ads-deep-dive-meta)
   - [Google Ads Deep Dive (`/google`)](#34-google-ads-deep-dive-google)
   - [Outcome Tracking & Change Log (`/tracking`)](#35-outcome-tracking--change-log-tracking)
4. [Cross-Platform Model Rigor & Attribution Standard](#4-cross-platform-model-rigor--attribution-standard)
5. [Local Development Profile Solution](#5-local-development-profile-solution)
6. [Finalized 3-Phase Implementation Roadmap](#6-finalized-3-phase-implementation-roadmap)

---

# 1. Core Safety & Security Requirements

### 1.1 Server-Authoritative Writes for All Mutation Paths
The most urgent vulnerability in the application is that live ad network mutations currently trust payloads constructed in the client browser.

- **Current Vulnerability:** [`ActionDrawer.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/components/ui/ActionDrawer.tsx) constructs `actionPayload` containing target IDs, proposed values, action types, and guardrail statuses from client state and posts directly to `/api/tracking` -> `modal_cloud.py`.
- **Scope of Mutations:**
  1. *Recommendations:* Actions originating from AI recommendation cards.
  2. *Direct Page Actions:* In-line table actions originating from Google and Meta pages (e.g. `+10%` / `-10%` daily budget adjustments, `Pause Ad`, `Pause Keyword`).
- **Required Architecture:**
  The server must **never** accept arbitrary campaign IDs and proposed budget values from the client. The mutation API must only accept:
  - **Option A (Recommendations):** An authoritative `recommendation_id` + explicit user confirmation. The server re-fetches the recommendation from storage, verifies it is still active and eligible, and applies the pre-verified delta.
  - **Option B (Direct Page Actions):** A short-lived, server-generated **Action Intent Ticket** (with verified target, action constraint, cryptographic signature/hash, and TTL) generated when the user opens the drawer. The server verifies the ticket before applying the mutation.

### 1.2 Execution Hardening Beyond Basic Idempotency
Phase 1 must enforce complete execution integrity to avoid spending client money erroneously:
1. **Operator Role Boundaries:** Enforce an application-level distinction between read-only *Viewers* (clients, observers) and authorized *Operators* (media buyers, admins). Authentication alone must not imply write permission.
2. **Concurrency Control:** Atomic locks/mutex on the target entity to prevent two simultaneous requests from mutating the same budget or keyword before the first record is written.
3. **Provider Timeout Protection:** If a provider call (Google Ads mutate or Meta API request) times out over HTTP, the backend must not immediately assume failure and allow blind retries.
4. **Pre-Retry Reconciliation:** Before retrying any timed-out action, the system must poll the provider API to determine whether the mutation actually took effect.
5. **State Re-verification Before Execution:** Immediately prior to dispatching the mutation, the server must query the provider's live state to confirm the entity's budget or status has not changed since the recommendation was generated.
6. **User Identity Audit Trail (Who Took the Action):** Every mutation and dismissal must record the verified identity of the user who initiated the action. The Next.js API layer extracts the authenticated Clerk user identity (`userId`, `fullName`, `email`, and `imageUrl`) and attaches it to the execution payload. The Modal backend writes this immutably to `tracking.json` under an `applied_by` object, enabling accountability and compliance.

---

# 2. Architectural Boundaries & Corrections

### 2.1 Multi-Tenant Isolation Remains Server-Side
- **Architecture:** YCK and Genera are deployed on separate Vercel environments with tenant-specific server configuration (`ADSPULSE_DEFAULT_CLIENT_NAME` validated against `ADSPULSE_ALLOWED_CLIENTS` in [`server-config.ts`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/lib/server-config.ts)).
- **Security Rule:** Tenant authorization must remain strictly server-side. The frontend must **not** pass browser-selected client keys to authorize data access or mutation requests. The server must fail closed if tenant configuration is missing.

### 2.2 `DELETE /api/tracking` Is Audit Removal, NOT Ad Network Rollback
- **Clarification:** Calling `DELETE /api/tracking` removes a JSON record from `tracking.json` ([`modal_cloud.py` line 2677](file:///c:/Users/Andrea/yck-ads-dashboard-client/execution/modal_cloud.py#L2677)). It does **not** revert the bid or budget in Google Ads or Meta Ads.
- **Protocol:** Calling this "Rollback" in the UI would be dangerous. A true rollback requires an explicit reverse mutation:
  1. Fetching live provider state.
  2. Generating a reverse proposal with target values.
  3. Operator confirmation in `ActionDrawer`.
  4. Executing provider mutate operations.
  5. Preserving the historical audit trail without destroying records.
- **UI Copy:** Until this workflow is built, the interface must state *"Review reverse change"* or *"Dismiss tracking record"*, never *"Rollback"*.

### 2.3 Observational Monitoring vs. Causal Attribution
- **Attribution Standard:** The Day 7, 14, and 30 milestone comparisons measure observational before-versus-after performance on the target entity (or account-level trends when entity data is sparse). They do not isolate external factors like seasonality, promotions, budget shifts, or conversion attribution lag.
- **Copy Standard:** The product must not claim causal credit (e.g. *"RM 2,840 saved to date"* by summing snapshot differences). It must use honest, defensible language:
  - *"Observed CPA change following implementation"*
  - *"Associated performance trend"*
  - *"Not isolated from external market factors"*

### 2.4 Restrained Overview Strategy: No Premature Pacing Gauge
- **Decision:** Do **not** automatically migrate the Google pacing gauge to the Overview page.
- **Reasons:**
  1. The Google calculation currently assumes a fixed 30-day month (`* 30`) and can double-count shared campaign budgets.
  2. Cross-platform pacing is complex: Meta mixes campaign budgets (CBO), ad set budgets (ABO), daily budgets, and lifetime budgets.
- **Direction:** Keep the pacing gauge on Google Ads initially. Promote a budget pacing summary to the Overview page only after the calculation is normalized and trustworthy across both ad platforms.

---

# 3. Page-by-Page Audit Findings

---

### 3.1 Overview Page (`/`)
**File:** [`frontend/src/app/page.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/page.tsx)

#### Validated Defects & Usability Gaps:
1. **Sync Now Button Desync:** The button re-enables immediately while the 10-minute background poll runs ([`page.tsx` line 90](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/page.tsx#L90)). It must track the job ID returned by `/api/refresh-status` and remain disabled until the job concludes.
2. **Silent Uncached Date Range Fallback:** When the backend returns a 409 (range not cached), the page silently reverts to the default range without explanation. The selected range must remain active with a visible *"Generating data for selected range..."* state.
3. **Platform Filter Inconsistency:** Filtering by platform updates spend and CPA, but retains global blended deltas. [`PerformanceChart.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/components/ui/PerformanceChart.tsx) ignores the platform toggle and always renders both platform series.
4. **Mobile Layout Compression:** [`UnifiedMetricsCard.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/components/ui/UnifiedMetricsCard.tsx) uses horizontal flex dividers that squeeze into unreadable columns on screens < 640px. Must be restructured as a responsive grid.
5. **Campaign Table Ranking:** The "Top Performing Campaigns" table renders raw database order rather than being ranked by conversions or spend. It should either be explicitly ranked (top 5) or labeled simply "Campaigns".
6. **Misleading Search Input:** The disabled global search bar in [`DashboardLayout.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/components/layout/DashboardLayout.tsx) should be removed rather than left as a broken placeholder.
7. **Overview Enhancement:** Implement a compact, restrained **"Needs Attention" panel** featuring at most 3 high-confidence recommendations with direct links into the existing `ActionDrawer`, avoiding dashboard bloat.

---

### 3.2 Recommendations Engine (`/recommendations`)
**File:** [`frontend/src/app/recommendations/page.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/recommendations/page.tsx)

#### Validated Defects & Usability Gaps:
1. **Ignored Deep-Link Platform Query:** The page ignores `?platform=Google` and `?platform=Meta` parameters sent from sub-pages, always rendering all platform sections stacked.
2. **Impact Calculation Divergence:** [`recommendations/page.tsx` line 93](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/recommendations/page.tsx#L93) discounts impact using each recommendation's individual `confidence_pct`, while the shared helper [`recommendation-impact.ts` line 18](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/lib/recommendation-impact.ts#L18) applies a static 70% factor (`CONFIDENCE_FACTOR = 0.7`). Both surfaces must use identical logic.
3. **Confusing Dismiss UX:** Clicking the dismiss "X" icon on a recommendation card opens the full execution drawer rather than presenting an inline dismiss confirmation.
4. **Hero Banner Clutter:** Consolidate the 3 duplicate stacked `TotalImpactCard` banners into a unified header.

---

### 3.3 Meta Ads Deep Dive (`/meta`)
**File:** [`frontend/src/app/meta/page.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/meta/page.tsx)

#### Validated Defects & Usability Gaps:
1. **Reach Column Bound to Impressions:** In [`meta/page.tsx` line 744](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/meta/page.tsx#L744), the table column is labeled `"Reach"`, but bound to `key: "impressions"`. Must be updated to `key: "reach"`.
2. **Fixed `< 5` CPA Color Benchmark:** Lines 749, 810, and 829 flag any CPA > 5 as bad (red text). For SME healthcare/lead generation (where target CPAs are RM 25–RM 80), this colors top-performing campaigns red. Replace with an objective-specific target CPA comparison or neutral styling.
3. **Creative Intelligence Gallery:** The visual cards, fatigue badges (`frequency >= 3.5`), and Hook/Hold retention metrics are well-executed highlights that deliver immediate operational value.

---

### 3.4 Google Ads Deep Dive (`/google`)
**File:** [`frontend/src/app/google/page.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/google/page.tsx)

#### Validated Defects & Usability Gaps:
1. **Ambiguous `asPct()` CTR Heuristic:** In [`google/page.tsx` line 24](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/google/page.tsx#L24), `asPct()` multiplies numbers `<= 1` by 100. If the backend returns a percentage value of `0.8%` as `0.8`, it displays as `80.00%`. Percentage units must be normalized in the backend contract.
2. **Copy-Paste Terminology Error:** Line 1396 refers to a "broken pixel" on Google Ads. Google Ads uses Google Tags (gtag.js) and Conversion Actions.
3. **Cognitive Overload (28 Stacked Sections):** The page requires in-page tabbed sub-navigation (`Summary & Pacing`, `Campaigns & PMax`, `Keywords & Queries`, `Creative & QS`, `Geo & Time`) to eliminate excessive scrolling.

---

### 3.5 Outcome Tracking & Change Log (`/tracking`)
**File:** [`frontend/src/app/tracking/page.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/tracking/page.tsx)

#### Validated Defects & Usability Gaps:
1. **Milestone Inspection:** Day 7, 14, and 30 snapshots are compressed into a single text cell in the table. Provide an expandable drawer or popover to view the full Day 0 → Day 7 → Day 14 → Day 30 progression.
2. **UI Action Dismissal:** Add an in-UI action menu to remove tracking records using the backend delete endpoint.
3. **Framing:** Ensure all milestone summaries use observational language rather than claiming causal credit.
4. **User Attribution ("Executed By" Column):** The Change Log table must include an **"Executed By"** (Operator) column displaying the user's avatar, full name, and email sourced from authenticated Clerk sessions, resolving the ambiguity of who triggered, manual-approved, or dismissed each action.

---

# 4. Cross-Platform Model Rigor & Attribution Standard

The cross-platform recommendation logic in [`modal_cloud.py` line 316](file:///c:/Users/Andrea/yck-ads-dashboard-client/execution/modal_cloud.py#L316) requires strict guardrails:
1. **Conversion Model Incompatibility:** Google and Meta conversions often use fundamentally different attribution windows (e.g. Meta 7-day click / 1-day view vs Google 30-day click) and different event definitions (e.g. top-of-funnel WhatsApp click vs bottom-of-funnel booked consultation).
2. **Abstention Principle:** The system must **abstain** from recommending cross-platform budget shifts unless conversion definitions, attribution windows, and objectives are demonstrably comparable.
3. **Diminishing Returns & Step-Size:** Advertising returns do not scale linearly. When inputs are comparable, recommendations must be framed as a controlled **10–15% budget experiment**, rather than assuming all transferred spend converts at the historical CPA.
4. **Currency Normalization:** Clean hardcoded `RM` currency symbols in backend recommendation copy to ensure proper multi-tenant rendering for Genera (`£`).

---

# 5. Local Development Profile Solution

To resolve the discrepancy between local development and multi-tenant production deployments without compromising security:
- **Root Cause:** In local dev, a single `.env.local` defaults to `ADSPULSE_DEFAULT_CLIENT_NAME="YAP CHAN KOR"`. Changing only `NEXT_PUBLIC_ADSPULSE_CLIENT=GENERA` creates a split where client components render Genera branding while server-side API routes fall back to YCK.
- **Solution:** Implement paired tenant npm development profiles:
  ```json
  "scripts": {
    "dev:yck": "dotenv -e .env.yck next dev",
    "dev:genera": "dotenv -e .env.genera next dev"
  }
  ```
  Each profile sets both the public branding tenant and the server default tenant concurrently. This ensures local testing mirrors production without allowing browser requests to dictate tenant authorization.

---

# 6. Finalized 3-Phase Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Correctness & Operational Safety (Immediate Focus)            │
│ • Fix Meta Reach mapping & CPA badge benchmark                         │
│ • Normalize percentage contracts in backend contract                   │
│ • Harden provider writes: server-authoritative recs & action intents   │
│ • Enforce operator write permissions & pre-execution state recheck    │
│ • Align impact calculations (confidence_pct vs static 0.7 factor)      │
│ • Log user identity ("Executed By") in tracking.json & Change Log UI   │
│ • Frame tracking outcomes with observational language                  │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: High-Value Usability & UX Fixes                              │
│ • Keep Sync Now disabled until refresh job ID completes                │
│ • Add visible loading state for uncached date ranges                   │
│ • Align platform toggle with deltas, charts, and tables                │
│ • Make KPI card grid responsive on mobile                              │
│ • Fix recommendation ?platform= filtering and inline dismiss UX       │
│ • Add data freshness ("last successfully synced") indicator            │
│ • Group Google page's 28 sections into tabbed sub-navigation           │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE 3: Restrained Dashboard Enhancements                             │
│ • Add compact 3-item "Needs Attention" panel on Overview               │
│ • Standardize cross-platform budget pacing model before Overview promotion│
│ • Implement paired tenant local dev profiles                           │
└────────────────────────────────────────────────────────────────────────┘
```

### Phase 1: Correctness & Safety (Immediate Execution)
1. **Fix Meta Reach Mapping:** Change `key: "impressions"` to `key: "reach"` in [`meta/page.tsx` line 744](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/meta/page.tsx#L744).
2. **Fix Meta CPA Benchmark:** Replace fixed `< 5` check with dynamic target CPA comparison or neutral styling in [`meta/page.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/meta/page.tsx#L749).
3. **Normalize Percentage Contract:** Remove ambiguous `asPct()` heuristics in frontend; ensure backend returns standardized decimals or percentages.
4. **Server-Authoritative Writes for All Mutation Paths:**
   - Eliminate arbitrary client payloads from browser.
   - For recommendations: Accept only valid `recommendation_id` + user confirmation; server re-verifies active status and recalculates delta.
   - For direct page actions (Google/Meta table adjustments): Issue short-lived, server-signed Action Intent tickets with strict parameter bounds and TTLs.
5. **Execution Hardening (Beyond Basic Idempotency):**
   - **Operator Roles:** Distinguish read-only viewers from authorized operators; enforce write authorization server-side.
   - **Concurrency Control:** Atomic entity-level mutex to block race conditions across simultaneous mutation requests.
   - **Provider Timeout Protection:** Prevent blind retries if a Google Ads or Meta API call times out over HTTP.
   - **Pre-Retry Reconciliation:** Actively poll provider state to verify if a timed-out mutation actually took effect before attempting any retry.
   - **Pre-Execution State Recheck:** Query live provider state immediately prior to mutation to confirm the entity's status and budget have not shifted since ticket generation.
6. **Cross-Platform Recommendation Guardrails:**
   - Enforce the **Abstention Principle**: System must abstain from cross-platform budget transfer recommendations unless Google and Meta objectives, conversion definitions, and attribution windows are demonstrably comparable.
   - When comparable, constrain recommendations to controlled **10–15% budget experiments** rather than assuming linear efficiency scaling.
7. **Synchronize Impact Calculations:** Unify [`recommendation-impact.ts`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/lib/recommendation-impact.ts) and [`recommendations/page.tsx`](file:///c:/Users/Andrea/yck-ads-dashboard-client/frontend/src/app/recommendations/page.tsx) so all surfaces use consistent confidence weighting.
8. **Correct Copy & Attribution Standards:** Fix "broken pixel" text on Google page; frame tracking milestones as observational performance changes rather than causal savings.
9. **User Attribution & Audit Logging ("Executed By"):** Extract authenticated Clerk user identity (`userId`, `fullName`, `email`, `avatar`) in `/api/tracking`, persist under `applied_by` in `tracking.json`, and render an **"Executed By"** column in the `/tracking` Change Log table.

### Phase 2: High-Value Usability Fixes
1. **Sync Now Progress Tracking:** Keep button disabled and poll `/api/refresh-status` using the job ID until completion.
2. **Uncached Date Range Experience:** Show clear *"Generating data for selected range..."* state instead of silent snap-back.
3. **Platform Filter Synchronization:** Ensure Overview deltas, chart series, and table all respect the active platform toggle.
4. **Mobile Responsive Grid:** Convert `UnifiedMetricsCard` to `grid grid-cols-2 md:grid-cols-4`.
5. **Recommendations Deep-Linking & Inline Dismiss:** Respect `?platform=Google` and `?platform=Meta` parameters; implement inline dismiss confirmation rather than opening the execution drawer.
6. **Data Freshness Indicator:** Display "Last successfully synced at [timestamp]" across all views.
7. **Google Page Tab Navigation:** Organize 28 sections into clean, tabbed sub-views.

### Phase 3: Restrained Dashboard Enhancements
1. **Overview "Needs Attention" Panel:** Feature the top 3 highest-confidence actionable recommendations on Overview with links to the existing `ActionDrawer`, aligned with the copilot without creating a dashboard monster.
2. **Cross-Platform Pacing Normalization:** Refactor budget pacing logic to handle shared budgets, exact month lengths, and Meta CBO/ABO structures before promoting to Overview.
3. **Paired Local Dev Profiles:** Create `dev:yck` and `dev:genera` scripts setting both public branding tenant and server default tenant together to eliminate local development tenant desync.
