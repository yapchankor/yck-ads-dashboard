# Adspulse Dashboard Deployment

YCK and Genera are tenant-specific deployments of the same repository and Git
revision. Branding, currency, account allowlists, and default client selection
are controlled by each Vercel project's environment variables.

## Verified Project Topology

| Tenant | Vercel account/team | Existing project | Production alias | Deploy directory |
| --- | --- | --- | --- | --- |
| YCK | `yapchankor79-5281` / `team_tr6sXSOVF92yNKDPPq0BgrJk` | `yck-ads-dashboard-staging` (`prj_tXe4NRwaV0gbaxGgVWrdGGKyXKnN`) | `yck-ads-dashboard-staging.vercel.app` | Repository root; project Root Directory is `frontend` |
| Genera | `rossiandrea18` / `team_ptfbbQzA53vm2KtcCiRSpA6P` | `genera-ads-dashboard-client` (`prj_P2GTjqk1Jd7dkzWKLBZRmLt1SsEh`) | `genera-ads-dashboard-client.vercel.app` | `frontend/` |

Source repository: `https://github.com/yapchankor/yck-ads-dashboard`

The YCK project deploys `main` automatically through its Git integration. The
Genera project must point to this same consolidated repository or have its
obsolete Git integration disconnected. Never create a replacement Vercel
project when switching accounts or relinking the local directory.

## YCK Deployment

- Vercel project: `yck-ads-dashboard-staging`
- Production branch: `main`
- Root directory: `frontend`
- Build command: `npm run build`
- Install command: `npm install`

Push `main`, wait for the automatic deployment, health-check the direct
deployment URL, and only then confirm the production alias. If no deployment is
created, deploy from the repository root while linked to the existing YCK
project.

## Genera Deployment

Switch Vercel authentication to `rossiandrea18`, verify that
`genera-ads-dashboard-client` already exists, and link `frontend/` to that exact
project. Confirm its environment variables before deploying from `frontend/`.
The Genera deployment must use the same Git revision as YCK.

## Backend

Modal app: `ad-optimization-reports`

Required Modal secrets:

- `adspulse-api-creds`
- `google-ads-creds`
- `facebook-ads-creds`
- `smtp-creds`
- `google-credentials`

Deploy backend from repo root:

```powershell
modal deploy execution\modal_cloud.py
```

## Frontend Environment

Required Vercel production variables:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
- `CLERK_SIGN_IN_URL`
- `CLERK_SIGN_UP_URL`
- `CLERK_AFTER_SIGN_IN_URL`
- `CLERK_AFTER_SIGN_UP_URL`
- `MODAL_API_BASE_URL`
- `MODAL_APPLY_URL`
- `MODAL_TRACKING_URL`
- `MODAL_TRACKING_DELETE_URL`
- `MODAL_REFRESH_URL`
- `MODAL_EMAIL_SETTINGS_URL`
- `MODAL_EMAIL_SETTINGS_UPDATE_URL`
- `ADSPULSE_INTERNAL_API_KEY`
- `ADSPULSE_DEFAULT_CLIENT_NAME`
- `ADSPULSE_ALLOWED_CLIENTS`
- `NEXT_PUBLIC_ADSPULSE_CLIENT` (`YCK` or `GENERA` for the matching project)
- `N8N_MASTER_AGENT_URL`
- `N8N_WEBHOOK_SECRET`

## Release Flow

1. Commit and verify the shared source revision on `main`.
2. Push to `yapchankor/yck-ads-dashboard`.
3. Verify YCK's automatic deployment; use a manual deployment only as a fallback.
4. Deploy that identical revision to the existing Genera project.
5. Health-check each direct deployment URL before confirming its production alias.
6. Deploy Modal separately only when the committed backend differs from the live Modal source.

## Smoke Test

- Sign in through Clerk.
- Confirm YCK shows YCK branding, Malaysian Ringgit, and only YCK account data.
- Confirm Genera shows Genera branding, British pounds, and only Genera account data.
- Confirm Overview, Google Ads, Meta Ads, Recommendations, Outcome Tracking, and Settings load.
- Confirm Copilot starters match the current page, Balanced is the default, and the response-style preference survives reload.
- Confirm Direct and Conversational preserve campaign figures and recommendation identifiers while changing presentation.
- Confirm Try again resubmits a failed inquiry and Review proposed change opens the existing confirmation drawer.
- Confirm email settings persist after refresh.
- Apply live recommendations only after selecting the exact low-risk item to test.
