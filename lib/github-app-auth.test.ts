import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createGitHubAppTokenProvider } from './github-app-auth.ts';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const PEM = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
const NOW = Date.parse('2026-11-20T10:00:00Z');

function response(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

function provider(fetchImpl: typeof fetch, extra: Record<string, unknown> = {}) {
  return createGitHubAppTokenProvider({
    appId: '123456', installationId: '999',
    privateKey: PEM, allowedRepositories: ['owner/hafize'],
    fetchImpl, now: () => NOW, ...extra
  });
}

const installation = {
  id: 999, app_id: 123456, repository_selection: 'selected',
  account: { login: 'owner' }, suspended_at: null
};
const granted = {
  token: 'short-lived-installation-token',
  expires_at: new Date(NOW + 3_600_000).toISOString(),
  permissions: { contents: 'write' },
  repositories: [{ full_name: 'owner/hafize' }]
};

describe('GitHub App selected-repository credential provider', () => {
  it('rejects missing configuration without contacting GitHub', async () => {
    let calls = 0;
    const auth = provider(async () => { calls++; return response({}); }, { privateKey: '' });
    expect(auth.configured()).toBe(false);
    await expect(auth.getToken('owner/hafize', 'contents')).rejects.toMatchObject({ code: 'GITHUB_APP_NOT_CONFIGURED' });
    expect(calls).toBe(0);
  });

  it('rejects repositories outside the explicit allowlist', async () => {
    let calls = 0;
    const auth = provider(async () => { calls++; return response({}); });
    await expect(auth.getToken('owner/other', 'contents')).rejects.toMatchObject({ code: 'GITHUB_APP_REPOSITORY_NOT_ALLOWED' });
    expect(calls).toBe(0);
  });

  it('makes a signed short lived JWT and grants only one repository/capability', async () => {
    const calls: { path: string; method: string; body: string; authorization: string }[] = [];
    const auth = provider(async (url, init) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ path: new URL(String(url)).pathname, method: init.method || '', body: String(init.body || ''), authorization: headers.Authorization });
      return response(calls.length === 1 ? installation : granted);
    });
    expect(await auth.getToken('owner/hafize', 'contents')).toBe('short-lived-installation-token');
    expect(calls).toHaveLength(2);
    const jwt = calls[0]!.authorization.replace('Bearer ', '');
    const [h, p, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(p!, 'base64url').toString())).toMatchObject({ iss: '123456' });
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toMatchObject({ alg: 'RS256' });
    expect(verify('RSA-SHA256', Buffer.from(h + '.' + p), publicKey, Buffer.from(sig!, 'base64url'))).toBe(true);
    expect(calls[0]!.path).toBe('/app/installations/999');
    expect(calls[1]!.path).toBe('/app/installations/999/access_tokens');
    expect(JSON.parse(calls[1]!.body)).toEqual({
      repositories: ['hafize'],
      permissions: { contents: 'write' }
    });
  });

  it('rejects all-repository installations even when an allowlist exists', async () => {
    const auth = provider(async () => response({ ...installation, repository_selection: 'all' }));
    await expect(auth.getToken('owner/hafize', 'contents')).rejects.toMatchObject({
      code: 'GITHUB_APP_INSTALLATION_NOT_SELECTED'
    });
  });

  it('rejects installation owner mismatches and suspended installations', async () => {
    const badOwner = provider(async () => response({ ...installation, account: { login: 'other' } }));
    await expect(badOwner.getToken('owner/hafize', 'contents')).rejects.toMatchObject({ code: 'GITHUB_APP_INSTALLATION_MISMATCH' });
    const suspended = provider(async () => response({ ...installation, suspended_at: '2026-11-20T08:00:00Z' }));
    await expect(suspended.getToken('owner/hafize', 'contents')).rejects.toMatchObject({ code: 'GITHUB_APP_INSTALLATION_MISMATCH' });
  });

  it('rejects expired tokens, missing capabilities and unexpected repository lists', async () => {
    const cases = [
      { ...granted, expires_at: new Date(NOW - 1000).toISOString() },
      { ...granted, permissions: { contents: 'read' } },
      { ...granted, repositories: [{ full_name: 'owner/other' }] }
    ];
    for (const issued of cases) {
      let i = 0;
      const auth = provider(async () => response(++i === 1 ? installation : issued));
      await expect(auth.getToken('owner/hafize', 'contents')).rejects.toMatchObject({ code: 'GITHUB_APP_AUTH_FAILED' });
    }
  });

  it('requests pull request write permissions separately', async () => {
    const bodies: unknown[] = [];
    let count = 0;
    const auth = provider(async (_url, init) => {
      if (++count === 1) return response(installation);
      bodies.push(JSON.parse(String(init.body)));
      return response({ ...granted, permissions: { pull_requests: 'write' } });
    });
    await expect(auth.getToken('owner/hafize', 'pull_requests')).resolves.toBe(granted.token);
    expect(bodies).toEqual([{ repositories: ['hafize'], permissions: { pull_requests: 'write' } }]);
  });
});
