# YCK Ads Dashboard Deployment

## Production/Staging Host

- Vercel project: `yck-ads-dashboard-staging`
- GitHub repo: `https://github.com/yapchankor/yck-ads-dashboard`
- Production branch: `main`
- Root directory: `frontend`
- Build command: `npm run build`
- Install command: `npm install`

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

## Release Flow

1. Commit changes to `main`.
2. Push to `yapchankor/yck-ads-dashboard`.
3. Vercel auto-deploys from GitHub.
4. If backend code changes, deploy Modal separately.

## Smoke Test

- Sign in through Clerk.
- Confirm Overview, Google Ads, Meta Ads, Recommendations, Outcome Tracking, and Settings load.
- Confirm email settings persist after refresh.
- Apply live recommendations only after selecting the exact low-risk item to test.
