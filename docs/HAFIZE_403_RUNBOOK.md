# Hafize 403 incident runbook

## Distinguish the two local errors

- `NVIDIA_WORKSPACE_TEST_NOT_AUTHORIZED` is emitted before the NVIDIA provider call. The workspace status now returns `testAuthorization` with a derived reason; it does not disclose the owner message or credentials. Test authorization is still limited to the current explicit user request and the existing laboratory quotas. For example: “NVIDIA modellerini test et, incele, doğrula ve geliştir.” The same text must reach the live backend as the current owner message. An isolated “Kaldığın yerden devam et” is not a new test authorization. If the explicit text is still rejected, compare the live revision and route with main before blaming the provider.
- `GITHUB_REPO_NOT_ALLOWED` is returned by Hafize's local allowlist before a network call. It is not a GitHub token failure.

## Render configuration (existing free service)

In the confirmed Hafize backend service, preserve all existing environment values. Append `umitalgan061-sudo/hafize` to `HAFIZE_GITHUB_READ_REPOS`, or add it to `HAFIZE_GITHUB_EXTRA_READ_REPOS` without removing any existing approved entries. For public-only anonymous reads, `HAFIZE_GITHUB_PUBLIC_READ=true` is supported; provider rate limits still apply. Do not replace tokens or disable path/credential checks.

Save and restart/redeploy the existing service, verify the deployed revision, then test `github_read_file` on README.md in the exact repository and check the returned blob SHA. Separately validate GitHub App installation and existing scoped write configuration if required. No new service or paid plan is required for this configuration change.

## Verification

1. Run the workspace status action on a real authenticated user turn with the explicit NVIDIA test request. Confirm testAuthorization.authorized.
2. Run one synthetic probe, inspect provider result, then audit within the available budget. A catalog row or configured flag is not execution proof.
3. Verify live README read and the actual backend revision. Only then proceed to branch/PR changes and further integrations.
4. Never expose API keys, disable allowlists or claim a live result from a unit test. This runbook does not configure or deploy Render itself.

Alternatively set `HAFIZE_GITHUB_SELF_READ=true` after this revision is deployed. This explicit server-side switch adds only `umitalgan061-sudo/hafize` to the read allowlist, preserving both existing lists and all write and authentication settings. It is disabled by default.
