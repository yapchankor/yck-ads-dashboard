# Adspulse Implementation Plan

## Goal

Turn the existing YCK Ads Dashboard from a mostly read-only reporting dashboard into a practical ads command centre that matches the functionality of the reference HTML reports and lets users safely make Google Ads and Meta Ads changes from the dashboard.

This document is written for an agent that has no prior context. Read this file first, then inspect the referenced files before editing.

## Repository Context

Project root:

```text
c:\Users\Andrea\yck-ads-dashboard-client
```

Frontend:

```text
frontend/
```

Frontend stack:

- Next.js App Router
- React
- Tailwind CSS
- Clerk auth
- Vercel deployment

Backend/execution layer:

```text
execution/
```

Backend stack:

- Modal Cloud
- Python FastAPI endpoints in `execution/modal_cloud.py`
- Google Ads executor in `execution/google_ads_executor.py`
- Meta Ads executor in `execution/meta_ads_executor.py`
- Data stored as JSON on Modal persistent volume

Reference reports:

```text
Facebook_Ads_Report_YAP CHAN KOR.html
Google_Ads_Report_YAP CHAN KOR.html
```

The user's original goal: everything in those reports should exist as a dashboard, and users should be able to act on Google Ads and Meta Ads either manually or directly from the dashboard.

## Implementation Progress

Last updated: 2026-05-15

Completed in the current sprint:

- Created the shared action workflow foundation:
  - `frontend/src/components/ui/ActionDrawer.tsx`
  - `frontend/src/lib/action-types.ts`
  - updates to `frontend/src/lib/types.ts`
- Reworked `frontend/src/components/ui/RecommendationCard.tsx` so recommendation actions now open the shared action drawer instead of using a direct `confirm(...)` flow.
- Added Google row-level actions in `frontend/src/app/google/page.tsx`:
  - campaign pause/enable
  - campaign daily budget increase/decrease by 10%
  - keyword pause
  - search term and wasted term add-as-negative-keyword actions
- Added Meta row-level actions in `frontend/src/app/meta/page.tsx`:
  - campaign budget increase/decrease by 10%
  - ad set budget increase/decrease by 10%
  - pause ad from creative cards when `ad_id` exists
- Updated `frontend/src/app/api/data/route.ts` so Meta ad set rows expose `adset_id`, `campaign_id`, `daily_budget`, `lifetime_budget`, and `targeting_summary`.
- Restored local Modal configuration after the dashboard showed `Modal dashboard API is not configured`:
  - pulled Vercel development env vars into `frontend/.env.local`
  - confirmed `MODAL_API_BASE_URL`, `MODAL_APPLY_URL`, `MODAL_TRACKING_URL`, `MODAL_REFRESH_URL`, `ADSPULSE_DEFAULT_CLIENT_NAME`, and `ADSPULSE_ALLOWED_CLIENTS` are present
  - pulled production env temporarily only to recover the missing `ADSPULSE_INTERNAL_API_KEY`
  - discovered `vercel env pull` writes sensitive `ADSPULSE_INTERNAL_API_KEY` as an empty quoted value locally
  - recovered the real `ADSPULSE_INTERNAL_API_KEY` from the Modal `adspulse-api-creds` secret and copied it into `frontend/.env.local`
  - removed the temporary production env file
  - removed the attempted local mock-data fallback and kept Modal as the source of truth
  - removed mismatched/empty Clerk env values from `frontend/.env.local` so local development returns to the prior Clerk keyless mode
- Verified the first implementation slice:
  - `npm run lint` passed
  - `npm run build` passed
  - local HTTP checks returned 200 for `/`, `/google`, `/meta`, `/recommendations`, and `/tracking`
- Re-verified after restoring local Modal environment configuration:
  - `npm run lint` passed
  - `npm run build` passed

Notes:

- The Vercel `agent-browser` CLI was not available on PATH, so full visual browser automation was not performed. The implementation was verified through lint, build, and HTTP route checks.
- No new external API, MCP server, or backend mutation path was required for this slice. The existing `/api/tracking` route and Modal apply contract were sufficient.
- The current budget row actions intentionally use conservative fixed 10% changes rather than arbitrary free-form budget editing. Add custom input later only if the client needs it.
- Local development now depends on `frontend/.env.local` for real Modal data. Do not replace Modal with mock data for this project unless explicitly requested.
- Local `.env.local` should contain Modal/client variables and the internal API key. It should not contain empty or mismatched Clerk keys.
- After the real API key was restored, unauthenticated `/api/data` returned `401 Unauthorized` instead of the Modal configuration `500`, confirming the configuration gate is fixed.
- Fixed follow-up QA issues from browser review:
  - date preset buttons now anchor to the loaded dashboard end date instead of the browser's current date, so "7 days" matches the latest synced data window
  - Google Search Query Report no longer filters out rows with Google search-term status `NONE`
  - Google Geographic Summary now resolves `Location <id>` values to the matching readable location name when the geo row exists
  - Meta creative cards detect low-resolution Meta CDN previews such as `p64x64`, stop stretching them as full-bleed images, and label them as low-res previews
  - Outcome Tracking now labels milestone results as account-level directional snapshots rather than implying a single change definitively caused improvement or worsening
  - normalized local `.env.local` values to remove literal `\r\n` suffixes from Vercel-pulled values

Remaining work:

- Phase 4 report-parity polish: make platform pages visibly match every major report section, especially "Top Performers", "Issues & Underperformers", "Total Expected Impact", and Meta landing page performance if data is available.
- Phase 5 audit trail upgrade: improve `/tracking` into a stronger client-facing change log with filtering, before/after values, execution details, and user attribution where available.
- Phase 6 backend contract hardening: normalize apply responses and validation only where gaps are found during the tracking/audit pass.

Important tracking gap discovered during QA:

- Implementation tracking is currently working as an audit log: it records that a recommendation/action was applied, dismissed, failed, or marked manual.
- Outcome tracking is not yet recommendation-specific enough for client handoff.
- The current Day 7/14/30 "CPA improved/worsened" snapshot is based on account-level cached CPA movement, not the exact entity changed by the recommendation.
- This means a row such as "Add Negative Keywords: yapchankor" can show "CPA worsened" even though that wording does not prove the negative keyword caused the change.
- Until target-level outcome tracking is implemented, the UI must avoid implying causation. It should say account-level directional snapshot or target-level outcome unavailable.

Required Phase 5 tracking upgrade:

- Store the changed target entity for every action:
  - Google negative keyword: campaign ID, ad group ID/name where available, search term/negative keyword, match type.
  - Google keyword pause/bid change: keyword resource name, keyword text, campaign, ad group.
  - Google campaign pause/budget change: campaign ID/name and budget resource where available.
  - Google device/geo/schedule changes: campaign ID plus device/location/schedule identifiers.
  - Meta campaign/ad set/ad actions: campaign ID, ad set ID, ad ID/creative ID as applicable.
- Capture target-level baseline metrics at apply time where possible:
  - spend, clicks, impressions, conversions, CPA, CTR, conversion value, date range.
- Build Day 7/14/30 snapshots from the same target entity, not from whole-account blended metrics.
- If exact target-level data is not available, show:
  - "Implementation recorded"
  - "Target-level outcome not available"
  - optional account-level directional context clearly labelled as account-level only.
- Do not label a recommendation as improved/worsened unless the comparison is for the same target entity affected by the action.

## Current State Summary

The dashboard is already close on read-only report parity:

- `/google` has budget pacing, search term intelligence, quality score, wasted search terms, negative keyword candidates, geo, device, landing page heatmap, responsive search ads, hourly/day performance, and recommendations.
- `/meta` has campaign performance, ad set performance, placement, demographic, geo, hourly/day performance, conversion tracking health, creative cards, and recommendations.
- `/recommendations` has recommendation cards and platform-level expected impact.
- `/tracking` has outcome tracking for applied/implemented recommendations.
- Backend apply support already exists for many live changes through Modal.

The main gap is product actionability:

- Users can apply recommendation cards, but they cannot directly edit campaign/ad set/ad group/keyword/ad rows from dashboard tables.
- There is no consistent before/after preview before live ad account changes.
- There is no strong audit trail UI with before value, after value, user, timestamp, target, and API response.
- Some report sections are present but not promoted clearly as report-style summary modules.

## Important Files

Frontend pages:

```text
frontend/src/app/page.tsx
frontend/src/app/google/page.tsx
frontend/src/app/meta/page.tsx
frontend/src/app/recommendations/page.tsx
frontend/src/app/tracking/page.tsx
frontend/src/app/settings/page.tsx
```

Frontend API routes:

```text
frontend/src/app/api/data/route.ts
frontend/src/app/api/tracking/route.ts
frontend/src/app/api/apply/route.ts
frontend/src/app/api/refresh/route.ts
```

Frontend components/types:

```text
frontend/src/components/ui/RecommendationCard.tsx
frontend/src/components/ui/DataTable.tsx
frontend/src/components/ui/UnifiedMetricsCard.tsx
frontend/src/lib/types.ts
frontend/src/lib/dashboard-refresh.ts
```

Backend:

```text
execution/modal_cloud.py
execution/google_ads_executor.py
execution/meta_ads_executor.py
execution/fetch_google_ads_metrics.py
execution/fetch_facebook_ads_metrics.py
execution/generate_dashboard_data.py
execution/calculate_total_impact.py
execution/impact_models.py
```

## Existing Live Apply Capabilities

Before adding new backend mutations, inspect the existing code. Do not duplicate implemented actions.

Google executor currently includes functions for:

- Add campaign negative keyword
- Pause keyword/ad group criterion
- Update keyword bid
- Pause campaign
- Enable campaign
- Update campaign budget
- Device bid modifier
- Geo bid modifier
- Geo exclusion
- Ad schedule bid modifier

Meta executor currently includes functions for:

- Pause campaign
- Pause ad set
- Pause ad
- Update campaign budget
- Update ad set budget
- Scale campaign budget
- Scale ad set budget
- Exclude demographic segment
- Exclude placement
- Exclude geo location
- Adjust ad schedule by best hours
- Adjust day schedule

Modal apply routing lives in:

```text
execution/modal_cloud.py
```

Look for:

```text
def apply_recommendation(...)
```

and the Google/Meta branches around the executor calls.

Frontend apply routing currently goes through:

```text
frontend/src/app/api/tracking/route.ts
frontend/src/components/ui/RecommendationCard.tsx
```

## Target Product Outcome

After implementation, a user should be able to:

1. Open the dashboard and see the same strategic information contained in the two HTML reports.
2. Inspect Google and Meta performance by campaign, ad group/ad set, keyword/search term, placement, demographic, geo, time, device, landing page, and creative where applicable.
3. Apply recommended changes with a clear before/after preview.
4. Manually mark non-automatable work as implemented.
5. Directly edit common ad account settings from table rows where safe.
6. View an audit trail of every attempted, successful, failed, dismissed, or manual action.
7. Understand whether a recommendation/action is automatic, needs review, manual-only, or suppressed by guardrails.

## Implementation Phases

### Phase 1: Action Center Foundation

Build a reusable action workflow used by both recommendation cards and row-level table actions.

Required UX:

- An action drawer or modal.
- Shows platform.
- Shows action type.
- Shows target entity: campaign, ad group, ad set, keyword, search term, ad, placement, location, device, or schedule.
- Shows current value where known.
- Shows proposed value.
- Shows reason/evidence.
- Shows risk/guardrail status.
- Shows expected impact if available.
- Requires explicit confirmation before live apply.
- Supports manual-only actions with "Mark as Implemented".
- Supports "Dismiss".

Recommended files:

```text
frontend/src/components/ui/ActionDrawer.tsx
frontend/src/lib/action-types.ts
frontend/src/lib/types.ts
frontend/src/components/ui/RecommendationCard.tsx
```

Acceptance criteria:

- Recommendation cards use the shared action drawer instead of immediately calling apply after `confirm(...)`.
- Auto actions still call `/api/tracking`.
- Manual actions still record tracking records.
- Dismiss still records as dismissed.
- Errors from Modal apply endpoint are visible in the drawer.

### Phase 2: Row-Level Google Actions

Add direct actions to Google dashboard tables.

Start with the highest-value actions:

- Search terms: add as negative keyword.
- Keywords: pause keyword, update bid where `target_id`/resource name and `suggested_bid` or manual input are available.
- Campaigns: pause campaign, enable campaign, update daily budget.
- Device rows: apply device bid modifier where campaign ID and device are available.
- Geo rows: apply geo bid modifier or exclusion where location criterion ID is available.
- Schedule/time rows: apply schedule bid modifier where campaign IDs and time slot are available.

Recommended file:

```text
frontend/src/app/google/page.tsx
```

Backend may already support most of this. Verify before editing:

```text
execution/google_ads_executor.py
execution/modal_cloud.py
```

Acceptance criteria:

- Actions appear beside relevant Google rows.
- Each action opens the shared action drawer.
- No direct live change happens without preview and confirmation.
- If required IDs are missing, show disabled action with clear reason.
- Successful action creates/updates tracking record.

### Phase 3: Row-Level Meta Actions

Add direct actions to Meta dashboard tables.

Start with:

- Campaigns: pause campaign, update/scale budget where supported.
- Ad sets: pause ad set, update/scale budget.
- Ads/creatives: pause ad for fatigue/creative refresh.
- Placements: exclude placement from ad set where supported.
- Demographics: exclude age/gender segment where supported.
- Geo: exclude location where location key/type or lookup is available.
- Time: adjust schedule using best hours or wasted days where ad set IDs are available.

Recommended file:

```text
frontend/src/app/meta/page.tsx
```

Backend may already support most of this. Verify before editing:

```text
execution/meta_ads_executor.py
execution/modal_cloud.py
```

Acceptance criteria:

- Meta table rows expose safe actions.
- Actions are disabled when Meta API limitations or missing IDs prevent safe mutation.
- Creative cards have an action path for pausing a fatigued ad if `ad_id` is present.
- Successful action creates/updates tracking record.

### Phase 4: Report Parity Polish

Make the dashboard feel like the HTML reports turned into software, not just raw tables.

Reference Google report sections:

- Key Metrics
- AI Insights Summary
- Top Performers
- Issues & Underperformers
- Budget Pacing Analysis
- Landing Page Performance Heatmap
- Time-of-Day & Day-of-Week Analysis
- Total Expected Impact
- Optimization Recommendations

Reference Meta report sections:

- Key Metrics
- AI Summary
- Campaign Performance
- Ad Set Performance
- Placement Performance
- Demographic Performance
- Geographic Performance
- Time Performance
- Total Expected Impact
- Optimization Recommendations
- Landing Page Performance

Required changes:

- Add explicit "Top Performers" and "Issues & Underperformers" summary sections to `/google` if they are only implied through labels.
- Add or improve Meta landing page performance on `/meta` if data is available.
- Make "Total Expected Impact" visible on platform pages, not only `/recommendations`.
- Ensure Meta reach/frequency are prominent like the report.
- Ensure Google quality score and search waste summaries are visible near the top.

Recommended files:

```text
frontend/src/app/google/page.tsx
frontend/src/app/meta/page.tsx
frontend/src/app/recommendations/page.tsx
```

Acceptance criteria:

- A non-technical user can compare each HTML report section to a visible dashboard section.
- No major report section is only buried in a long table.

### Phase 5: Audit Trail / Change Log

Upgrade `/tracking` into a proper audit trail.

Required fields where available:

- Timestamp
- User ID/email if available from Clerk
- Client name
- Platform
- Action type
- Target name and ID
- Before value
- After/proposed value
- Manual vs automatic
- Execution status
- API response/error
- Tracking snapshots: day 0, day 7, day 14, day 30

Recommended files:

```text
frontend/src/app/tracking/page.tsx
execution/modal_cloud.py
frontend/src/app/api/tracking/route.ts
```

Acceptance criteria:

- User can filter by platform, status, action type, and date range.
- Failed actions are visible, not hidden.
- Manual actions are clearly distinct from automatic API changes.
- Existing tracking JSON records still render without migration failure.

### Phase 6: Safer Backend Contracts

Make the apply contract explicit and stable between frontend and Modal backend.

Recommended additions:

- Shared action type mapping in frontend.
- Backend validation for required fields per action type.
- Return normalized response shape:

```json
{
  "status": "applied | tracked | manual_required | dismissed | already_tracking | error",
  "execution_status": "...",
  "tracking_record": {},
  "execution_result": {},
  "message": "..."
}
```

Existing code already partially follows this pattern. Clean up inconsistencies only where needed.

Acceptance criteria:

- Frontend can show useful errors without parsing arbitrary backend strings.
- Missing required IDs produce actionable messages.
- Manual-only actions do not pretend to have changed the ad account.

## Data and Type Requirements

Update `frontend/src/lib/types.ts` as needed.

Add or refine types for:

- Action target
- Action preview
- Action payload
- Apply response
- Tracking record
- Entity action availability

Keep backward compatibility with existing API responses.

## Safety Requirements

Never make live ad account mutations without a confirmation step.

Do not add broad destructive bulk actions in this pass.

Never silently convert a manual-only action into an automatic API mutation.

If an action needs an ID that is missing, disable it and explain what data is missing.

For budget changes:

- Show current budget.
- Show new budget.
- Show percent change.
- Require confirmation.
- Consider highlighting large increases.

For pause actions:

- Show exact entity being paused.
- Show platform and campaign/ad set/ad/ad group/keyword name.

For negative keywords:

- Show campaign target.
- Show keyword text.
- Show match type.
- Avoid duplicate negative keyword recommendations where existing negative inventory is available.

## Development Workflow

Use PowerShell from repo root:

```powershell
cd c:\Users\Andrea\yck-ads-dashboard-client
```

Install frontend dependencies if needed:

```powershell
cd frontend
npm install
```

Run lint:

```powershell
npm run lint
```

Run build:

```powershell
npm run build
```

Run dev server:

```powershell
npm run dev
```

If the dev server starts, visually verify:

- `/`
- `/google`
- `/meta`
- `/recommendations`
- `/tracking`

## Implementation Order Recommendation

1. Inspect `RecommendationCard.tsx`, `/api/tracking`, and `modal_cloud.py` apply endpoint.
2. Create shared action types and an action drawer.
3. Move recommendation apply flow into action drawer.
4. Add Google row-level actions.
5. Add Meta row-level actions.
6. Improve report parity summary sections.
7. Upgrade tracking/audit UI.
8. Run lint/build.
9. Start dev server and verify key pages.

## Non-Goals For This Pass

Do not build a full AI chat assistant.

Do not build multi-client agency dashboard unless explicitly requested.

Do not replace JSON storage with a database in this pass.

Do not rebuild the whole UI design system.

Do not add unsupported direct edits like changing Meta campaign objective after creation. If an ad platform does not support an edit, mark it manual-only and explain why.

## Definition of Done

The work is complete when:

- The dashboard visibly covers the same core sections as the two HTML reports.
- A user can apply recommended actions through a proper preview/approval workflow.
- A user can make common safe row-level changes directly from Google and Meta dashboard pages.
- Every action is recorded in tracking/audit history.
- Automatic vs manual actions are clearly labelled.
- Missing IDs/API limitations are handled gracefully.
- `npm run lint` and `npm run build` pass, or any failures are documented with exact reasons.
