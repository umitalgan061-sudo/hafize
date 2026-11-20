# Hafize GitHub App — Windows local backend activation

> **Scope:** Only a private Hafize server on the owner's Windows computer.
> This does **not** deploy a backend to Firebase Hosting, nor make localhost
> accessible to visitors of https://hafize-ua.web.app/.

## Prerequisites

- Node.js 24.21+ with `--use-system-ca --use-env-proxy` support.
- GitHub App `hafize-umitalgan` installed with Contents and Pull requests write permissions.
- Existing private key stored **outside** the repository, for example
  `%LOCALAPPDATA%\Hafize\secrets\hafize-github-app.pem`.
- Successful existing read-only identity check using `scripts/check-github-app.mjs`.

## Recommended clean checkout

Keep the existing `hafize-github-app-check` proof checkout unchanged.
Open a new PowerShell and run:

```powershell
$path = Join-Path $HOME "hafize-backend"
if (-not (Test-Path -LiteralPath $path)) {
    git clone --branch main "https://github.com/umitalgan061-sudo/hafize.git" $path
    if ($LASTEXITCODE -ne 0) { throw "GitHub clone failed" }
}
Set-Location $path
git pull --ff-only origin main
if ($LASTEXITCODE -ne 0) { throw "GitHub pull failed" }

# Dry run first: no file writes or remote actions
node scripts/configure-github-app-local.mjs

# Explicit local consent to update ONLY ignored .env
node scripts/configure-github-app-local.mjs --apply

# Verifies App authentication against GitHub, read-only
node --use-system-ca --use-env-proxy --env-file=.env scripts/check-github-app.mjs
```

The setup script checks the private key at `%LOCALAPPDATA%\Hafize\secrets\hafize-github-app.pem`
(or `HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH` if already set in the shell).

It does not display or copy the private key, does not perform GitHub writes, and
never touches other repository files.

### Start the local backend

```powershell
Set-Location (Join-Path $HOME "hafize-backend")
npm ci --no-audit --no-fund
npm run dev:server
```

Leave this terminal open. In the browser open **http://127.0.0.1:4173/**.
The local Hafize backend serves both the interface and the GitHub workspace API.
Use `http://127.0.0.1:4173/api/health` to inspect the non-sensitive flags
`githubReadConfigured` and `githubWriteConfigured`.
These are **configuration flags only**, not successful authorization proofs.

Use the existing GitHub Workspace interface to create a **new feature branch**,
make a file commit on that branch, and create a draft PR. Each write has its
existing explicit approval step; main is protected from direct content writes.
Do not insert the PEM file or installation token into the UI.

## Safety limits and diagnosis

- The setup script refuses `NODE_ENV=production`, a public `HOST`,
  missing/unsafe private key paths, conflicting GitHub App settings,
  duplicate .env keys, and wildcard repository allowlists.
- If `.env` does not exist, the script creates a safe local-only profile:
  `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=4173`.
- If `.env` already exists, unrelated auth/model/token values stay intact;
  other explicit read/write repositories are preserved.
- The app-specific settings are limited initially to
  `umitalgan061-sudo/hafize`, **not every repository** installed on GitHub.
- The .env file is ignored by Git; do not commit it or sync it to a public drive.
- If port 4173 is already in use, stop or intentionally restart the existing
  local Hafize backend. Do not kill unrelated Node processes blindly.
- To undo locally, stop the server and remove ONLY the App-specific
  `HAFIZE_GITHUB_APP_*` values from the private `.env`;
  independently review `HAFIZE_GITHUB_READ_REPOS` and
  `HAFIZE_GITHUB_WRITE_REPOS` before changing them.
- The Windows private key **must never be copied into Firebase Hosting or a
  browser bundle**.

## Cloud deployment is a separate project

The source repository currently has no tracked `firebase.json` or
`.firebaserc` to identify an audited Hosting→backend routing configuration.
Do not infer an API deployment from a `web.app` domain. Cloud deployment
requires a protected Node backend (for example Cloud Run / Firebase Functions),
a server-side secret manager, explicit Hosting routing, authenticated API access,
and regression/security checks. Never make the local private key publicly
accessible or relax TLS checks to make a cloud integration work.

## Automated checks

```powershell
npm run typecheck
npx vitest run lib/github-app-local-config.test.ts lib/github-app-auth.test.ts
```

App proof script `scripts/prove-github-app-bot.mjs` is opt-in and requires
`--confirm-create-draft-pr`; do not run it again just to validate the backend,
because every confirmed run creates a new branch and PR.
