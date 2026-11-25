# Canonical Hafize deployment — Render

The main application is https://hafize-free.onrender.com/ (UI and API on one origin). The legacy https://hafize-ua.web.app/ and https://hafize-ua.firebaseapp.com/ are navigation aliases, not independent application releases. Firebase Hosting uses reversible HTTP 302 redirects for / and /index.html; legacy SPA HTML also redirects to Render. API rewrites and existing secrets remain unchanged. The alias release.json identifies the Hosting configuration deployment only, not the running application revision. Verify the real application at Render /release.json and /api/health/live. Render Free has no persistent disk; origin-specific browser storage and sessions are not automatically migrated.

# Hafize — Firebase Hosting live deployment

This repository compiles the front end into `public/typed-build/`. It does
**not** contain the actual Firebase project's existing Hosting configuration or
a Firebase deployment credential. The site URL alone does not grant deployment
access. Do **not** replace the live configuration with a guessed SPA rewrite:
existing `/api/**`, authentication, Cloud Run/Functions or other routes could
break.

The workflow [`.github/workflows/firebase-hosting-live.yml`](../.github/workflows/firebase-hosting-live.yml)
builds main, validates the exact site and its full prior Hosting settings,
deploys **Hosting only**, and checks `https://<site>.web.app/release.json`
against the GitHub commit. Main-branch changes automatically trigger it;
you can also rerun it using **Actions → Hafize Firebase Hosting — live →
Run workflow**.

## One-time configuration (repository Settings → Secrets and variables → Actions)

**Deployment destination (configured in the workflow):**

- Firebase project ID: `projelerim-8fecd` (provided by the owner).
- Firebase Hosting site ID: `hafize-ua` (from `hafize-ua.web.app`).
  Verify in Firebase Console that this Hosting site belongs to the project
  before granting deployment credentials. These non-secret identifiers are
  already configured in the workflow; no GitHub variables are required.

**Repository secrets:**

- `FIREBASE_SERVICE_ACCOUNT_HAFIZE_UA`: the complete service-account JSON key
  for the intended Firebase project, granted only the permissions required to
  deploy its Hosting site. Prefer the official Firebase CLI
  `firebase init hosting:github` setup for creating this account/secret.
- `HAFIZE_FIREBASE_HOSTING_CONFIG`: the **full current** `firebase.json`
  configuration of the live site. Preserve existing API rewrites, headers,
  redirects and other production Hosting settings. The workflow refuses to
  deploy if this JSON is missing or points to another site. Its Hosting public
  directory must be a nonempty string. This workflow builds Hafize into
  `public/` and changes only the **temporary deploy copy** of
  `hosting.public` to `public`; the rest of the supplied existing Hosting
  configuration (API rewrites, auth, headers, redirects, site) stays intact.
  The original secret is never modified, and no existing output directory is
  deleted or overwritten.

Never commit service-account credentials, access tokens, a local `.env` file,
or private keys. If you only have a running website but do not know its active
Firebase configuration, first recover it from the last successful deployment or
the Firebase project administrator. There is **no safe inference** from the
public URL alone.

## First deployment

1. Run `npm ci && npm run build` (or let the GitHub Action build it).
2. Confirm the Firebase project owns the `hafize-ua` Hosting site, then
   configure the **two GitHub secrets** above, preserving existing Firebase
   Hosting rewrites rather than inventing backend routes.
3. In the repository's **Actions** tab, run **Hafize Firebase Hosting — live**
   on `main`, or rerun the failed live job after configuration.
4. Confirm all steps succeed, particularly the final `release.json` commit
   check. Only then describe `https://hafize-ua.web.app/` as updated.
5. On iPhone, close and reopen the installed PWA / refresh Safari to let the
   service worker pick up the latest browser files.

If validation reports `FIREBASE_HOSTING_CONFIG_MISSING`,
`FIREBASE_PROJECT_ID_MISSING_OR_INVALID` or the service account is absent,
**no deploy is attempted**. A green build or a merged GitHub PR is *not*
proof that Firebase Hosting has updated.

## Important backend limitation

The workflow deploys static Firebase Hosting files only. It cannot turn
`server.ts`, GitHub App private keys, NVIDIA credentials or a localhost agent
into a Firebase backend. Those require an independently deployed, protected
Cloud Run / Functions runtime and the corresponding **existing** Hosting
rewrites. That backend must not be replaced by a default catch-all rewrite.

## Hafize self-deployment

The GitHub Workspace **Firebase canlı yayınını başlat** action is now
implemented with the same one-time user-approval ticket as branch/commit/PR.
On a protected Hafize backend, the GitHub App (or server token) must have
**Actions: write** on `umitalgan061-sudo/hafize` and the repository must be
in `HAFIZE_GITHUB_WRITE_REPOS`. The server will dispatch **only**
`firebase-hosting-live.yml` on `main`; a user or model cannot change the
workflow or ref. The UI shows GitHub Actions' execution page. A dispatch
response means *queued*, not *successfully deployed*. Check the Actions job
for the post-deploy live marker verification.
This is distinct from browser access or uploading the Firebase service-account
JSON into Hafize. The Firebase key stays in GitHub Actions Secrets, never in
client JavaScript. Pushing an approved change to `main` also triggers the
workflow when a watched frontend path changes. An agent operating only on
Firebase Hosting's static frontend cannot directly authenticate to GitHub
Actions without an independently hosted authorized backend.
