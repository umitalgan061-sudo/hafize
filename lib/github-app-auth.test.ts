import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPrivateKey, generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createGitHubAppAuth, GitHubAppAuthError } from './github-app-auth.ts';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const dir of temporaryDirectories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'hafize-app-test-'));
  temporaryDirectories.push(directory);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const path = join(directory, 'app.pem');
  writeFileSync(path, privateKey.export({ type: 'pkcs8', format: 'pem' }));
  return { path, publicKey };
}

function tokenResponse(token: string, expiresAt: string, status = 201): Response {
  return new Response(JSON.stringify({ token, expires_at: expiresAt }), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('GitHub App authentication', () => {
  it('signs a short-lived RS256 JWT and caches the installation token', async () => {
    const { path, publicKey } = fixture();
    let calls = 0;
    const now = Date.parse('2026-11-19T12:00:00Z');
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      expect(String(input)).toBe('https://api.github.com/app/installations/183684460/access_tokens');
      expect(init?.method).toBe('POST');
      const headers = new Headers(init?.headers);
      const jwt = String(headers.get('Authorization')).replace(/^Bearer /, '');
      const [head, body, signature] = jwt.split('.');
      expect(JSON.parse(Buffer.from(head, 'base64url').toString()).alg).toBe('RS256');
      expect(JSON.parse(Buffer.from(body, 'base64url').toString()).iss).toBe('5833389');
      expect(verify('RSA-SHA256', Buffer.from(head + '.' + body), publicKey,
        Buffer.from(signature, 'base64url'))).toBe(true);
      return tokenResponse('ghs_' + 'a'.repeat(40), new Date(now + 3_600_000).toISOString());
    });

    const auth = createGitHubAppAuth({
      appId: '5833389', installationId: '183684460',
      privateKeyPath: path, fetchImpl, now: () => now
    });
    const [first, second] = await Promise.all([auth.installationToken(), auth.installationToken()]);
    expect(first).toBe(second);
    expect(calls).toBe(1);
    expect(await auth.installationToken()).toBe(first);
    expect(calls).toBe(1);
  });

  it('replaces caller authorization with the installation token on repository requests', async () => {
    const { path } = fixture();
    const now = Date.parse('2026-11-19T12:00:00Z');
    const seen: Array<{ url: string; auth: string | null }> = [];
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/access_tokens')) {
        return tokenResponse('ghs_' + 'b'.repeat(40), new Date(now + 3_600_000).toISOString());
      }
      seen.push({ url, auth: new Headers(init?.headers).get('Authorization') });
      return new Response('{}', { status: 200 });
    });
    const auth = createGitHubAppAuth({
      appId: '5833389', installationId: '183684460',
      privateKeyPath: path, fetchImpl, now: () => now
    });
    await auth.authenticatedFetch('https://api.github.com/repos/owner/repository', {
      headers: { Authorization: 'Bearer outdated-token' }
    });
    expect(seen).toEqual([{
      url: 'https://api.github.com/repos/owner/repository',
      auth: 'Bearer ghs_' + 'b'.repeat(40)
    }]);
  });

  it('blocks forwarding installation credentials to any other origin or endpoint', async () => {
    const { path } = fixture();
    const fetchImpl = vi.fn();
    const auth = createGitHubAppAuth({
      appId: '5833389', installationId: '183684460',
      privateKeyPath: path, fetchImpl
    });
    await expect(auth.authenticatedFetch('https://evil.example/repos/owner/repo'))
      .rejects.toMatchObject({ code: 'GITHUB_APP_ENDPOINT_BLOCKED', status: 403 });
    await expect(auth.authenticatedFetch('https://api.github.com/user'))
      .rejects.toMatchObject({ code: 'GITHUB_APP_ENDPOINT_BLOCKED', status: 403 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed on inaccessible or non-RSA private keys', () => {
    expect(() => createGitHubAppAuth({
      appId: '5833389', installationId: '183684460', privateKeyPath: 'missing.pem'
    })).toThrowError(new GitHubAppAuthError('GITHUB_APP_PRIVATE_KEY_INVALID'));
    const { path } = fixture();
    expect(() => createGitHubAppAuth({
      appId: 'abc', installationId: '183684460', privateKeyPath: path
    })).toThrowError(new GitHubAppAuthError('GITHUB_APP_INVALID_CONFIGURATION'));
  });

  it('rejects invalid token replies without exposing token payloads', async () => {
    const { path } = fixture();
    const fetchImpl = vi.fn(async () => new Response('not authorized', { status: 401 }));
    const auth = createGitHubAppAuth({
      appId: '5833389', installationId: '183684460',
      privateKeyPath: path, fetchImpl
    });
    await expect(auth.installationToken()).rejects.toMatchObject({
      code: 'GITHUB_APP_TOKEN_EXCHANGE_FAILED', status: 401
    });
  });
});
