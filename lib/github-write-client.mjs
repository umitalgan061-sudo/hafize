import { normalizeGitHubWriteRequest } from './github-write-contract.mjs';

const DEFAULT_GITHUB_API = 'https://api.github.com';

function fail(code, status = 400) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  throw error;
}
function cleanToken(value) {
  const token = typeof value === 'string' ? value.trim() : '';
  if (!token || token.length > 4096 || /\s/.test(token)) fail('INVALID_GITHUB_WRITE_TOKEN');
  return token;
}
function cleanBaseUrl(value) {
  let url;
  try { url = new URL(String(value || DEFAULT_GITHUB_API)); } catch { fail('INVALID_GITHUB_WRITE_BASE_URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('INVALID_GITHUB_WRITE_BASE_URL');
  return url.toString().replace(/\/+$/, '');
}
function encodePath(value) {
  return value.split('/').map((segment) => encodeURIComponent(segment)).join('/');
}

export function createGitHubWriteClient({ token, allowedRepositories, baseUrl = DEFAULT_GITHUB_API, fetchImpl = globalThis.fetch } = {}) {
  const authToken = cleanToken(token);
  const apiBase = cleanBaseUrl(baseUrl);
  if (!(allowedRepositories instanceof Set) || allowedRepositories.size < 1) fail('INVALID_GITHUB_WRITE_REPOSITORIES');
  if (typeof fetchImpl !== 'function') fail('GITHUB_WRITE_FETCH_UNAVAILABLE', 503);
  const normalize = (command) => normalizeGitHubWriteRequest(command, { allowedRepositories, approvalGranted: true });

  async function requestJson(pathname, { method = 'GET', body, signal } = {}) {
    let response;
    try {
      response = await fetchImpl(`${apiBase}${pathname}`, {
        method, signal,
        headers: {
          Accept: 'application/vnd.github+json', Authorization: `Bearer ${authToken}`,
          'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Hafize-AI',
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
    } catch { fail('GITHUB_WRITE_PROVIDER_FAILED', 502); }
    if (!response?.ok) fail('GITHUB_WRITE_PROVIDER_FAILED', Number.isInteger(response?.status) ? response.status : 502);
    try { return await response.json(); } catch { fail('INVALID_GITHUB_WRITE_PROVIDER_RESPONSE', 502); }
  }

  async function createBranch(input, { signal } = {}) {
    const command = normalize(input);
    if (command.operation !== 'branch.create') fail('INVALID_GITHUB_WRITE_OPERATION');
    const base = await requestJson(`/repos/${command.repository}/git/ref/heads/${encodePath(command.baseRef)}`, { signal });
    const sha = typeof base?.object?.sha === 'string' ? base.object.sha.toLowerCase() : '';
    if (!/^[a-f0-9]{40}$/.test(sha)) fail('INVALID_GITHUB_WRITE_PROVIDER_RESPONSE', 502);
    const created = await requestJson(`/repos/${command.repository}/git/refs`, {
      method: 'POST', signal, body: { ref: `refs/heads/${command.branch}`, sha }
    });
    const createdSha = typeof created?.object?.sha === 'string' ? created.object.sha.toLowerCase() : '';
    if (!/^[a-f0-9]{40}$/.test(createdSha)) fail('INVALID_GITHUB_WRITE_PROVIDER_RESPONSE', 502);
    return { sha: createdSha };
  }
  async function updateFile(input, { signal } = {}) {
    const command = normalize(input);
    if (command.operation !== 'file.update') fail('INVALID_GITHUB_WRITE_OPERATION');
    const payload = await requestJson(`/repos/${command.repository}/contents/${encodePath(command.path)}`, {
      method: 'PUT', signal,
      body: { message: command.commitMessage, content: Buffer.from(command.content).toString('base64'), sha: command.expectedBlobSha, branch: command.branch }
    });
    return { commitSha: payload?.commit?.sha, blobSha: payload?.content?.sha };
  }
  async function createPullRequest(input, { signal } = {}) {
    const command = normalize(input);
    if (command.operation !== 'pr.create') fail('INVALID_GITHUB_WRITE_OPERATION');
    const payload = await requestJson(`/repos/${command.repository}/pulls`, {
      method: 'POST', signal, body: { title: command.title, head: command.head, base: command.base, draft: true }
    });
    return { prNumber: payload?.number };
  }
  async function mergePullRequest(input, { signal } = {}) {
    const command = normalize(input);
    if (command.operation !== 'pr.merge') fail('INVALID_GITHUB_WRITE_OPERATION');
    const payload = await requestJson(`/repos/${command.repository}/pulls/${command.prNumber}/merge`, {
      method: 'PUT', signal, body: { sha: command.expectedHeadSha }
    });
    return { merged: payload?.merged, sha: payload?.sha };
  }
  return Object.freeze({ createBranch, updateFile, createPullRequest, mergePullRequest });
}
