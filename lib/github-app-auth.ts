import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const GITHUB_API = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';
const APP_ID = /^[1-9][0-9]{0,15}$/;
const TOKEN_REFRESH_MARGIN_MS = 60_000;

export class GitHubAppAuthError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 503) {
    super(code);
    this.name = 'GitHubAppAuthError';
    this.code = code;
    this.status = status;
  }
}

type GitHubAppAuthOptions = {
  readonly appId: string | number;
  readonly installationId: string | number;
  readonly privateKeyPath: string;
  readonly appSlug?: string;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
};

type AccessToken = {
  readonly token: string;
  readonly expiresAt: number;
};

function numericId(value: string | number): string {
  const normalized = String(value ?? '').trim();
  if (!APP_ID.test(normalized)) throw new GitHubAppAuthError('GITHUB_APP_INVALID_CONFIGURATION');
  return normalized;
}

function safeHttpStatus(status: number): number {
  return Number.isInteger(status) && status >= 400 && status < 600 ? status : 502;
}

/**
 * GitHub App installation authentication, entirely on the server.
 *
 * The private key is never sent to the browser. JWTs are limited to the
 * token-exchange endpoint, and installation tokens are used only for
 * repository operations on api.github.com.
 */
export function createGitHubAppAuth(options: GitHubAppAuthOptions) {
  const appId = numericId(options.appId);
  const installationId = numericId(options.installationId);
  const path = typeof options.privateKeyPath === 'string' ? options.privateKeyPath.trim() : '';
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? Date.now;
  const slug = typeof options.appSlug === 'string' ? options.appSlug.trim().toLowerCase() : '';
  if (slug && !/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(slug)) {
    throw new GitHubAppAuthError('GITHUB_APP_INVALID_CONFIGURATION');
  }

  if (!path || typeof fetchImpl !== 'function') {
    throw new GitHubAppAuthError('GITHUB_APP_INVALID_CONFIGURATION');
  }

  let privateKey: ReturnType<typeof createPrivateKey>;
  try {
    privateKey = createPrivateKey(readFileSync(path));
    if (privateKey.asymmetricKeyType !== 'rsa') throw new Error('RSA key required');
  } catch {
    // Do not include private key contents or filesystem paths in errors.
    throw new GitHubAppAuthError('GITHUB_APP_PRIVATE_KEY_INVALID');
  }

  let cached: AccessToken | null = null;
  let inFlight: Promise<string> | null = null;
  let cachedBotIdentity: Readonly<{ name: string; email: string }> | null = null;
  let botInFlight: Promise<Readonly<{ name: string; email: string }>> | null = null;

  function createJwt(): string {
    const issuedAt = Math.floor(now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iat: issuedAt - 30,
      exp: issuedAt + 480,
      iss: appId
    })).toString('base64url');
    const unsigned = header + '.' + payload;
    const signature = sign('RSA-SHA256', Buffer.from(unsigned, 'utf8'), privateKey).toString('base64url');
    return unsigned + '.' + signature;
  }

  async function requestInstallationToken(): Promise<string> {
    const response = await fetchImpl(
      GITHUB_API + '/app/installations/' + installationId + '/access_tokens',
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + createJwt(),
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'User-Agent': 'Hafize-GitHub-App'
        }
      }
    );

    if (!response.ok) {
      throw new GitHubAppAuthError('GITHUB_APP_TOKEN_EXCHANGE_FAILED', safeHttpStatus(response.status));
    }

    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new GitHubAppAuthError('GITHUB_APP_TOKEN_RESPONSE_INVALID', 502);
    }

    const data = result && typeof result === 'object' && !Array.isArray(result)
      ? result as Record<string, unknown>
      : {};
    const token = typeof data.token === 'string' ? data.token : '';
    const expiresAt = typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : NaN;

    if (!token || token.length < 20 || /[\s\x00-\x1f]/.test(token) ||
        !Number.isFinite(expiresAt) || expiresAt <= now() + TOKEN_REFRESH_MARGIN_MS) {
      throw new GitHubAppAuthError('GITHUB_APP_TOKEN_RESPONSE_INVALID', 502);
    }

    cached = { token, expiresAt };
    return token;
  }

  async function installationToken(): Promise<string> {
    if (cached && cached.expiresAt - now() > TOKEN_REFRESH_MARGIN_MS) {
      return cached.token;
    }

    if (!inFlight) {
      inFlight = requestInstallationToken().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  async function botCommitIdentity(): Promise<Readonly<{ name: string; email: string }>> {
    if (cachedBotIdentity) return cachedBotIdentity;
    if (!slug) throw new GitHubAppAuthError('GITHUB_APP_BOT_SLUG_NOT_CONFIGURED');
    if (!botInFlight) {
      botInFlight = (async () => {
        const expectedLogin = slug + '[bot]';
        // Public GitHub user metadata: do NOT attach the installation token.
        const response = await fetchImpl(
          GITHUB_API + '/users/' + encodeURIComponent(expectedLogin),
          {
            method: 'GET',
            redirect: 'error',
            headers: {
              Accept: 'application/vnd.github+json',
              'User-Agent': 'Hafize-GitHub-App'
            }
          }
        );
        if (!response.ok) {
          throw new GitHubAppAuthError('GITHUB_APP_BOT_IDENTITY_LOOKUP_FAILED', safeHttpStatus(response.status));
        }
        let data: unknown;
        try { data = await response.json(); }
        catch { throw new GitHubAppAuthError('GITHUB_APP_BOT_IDENTITY_INVALID', 502); }
        const details = data && typeof data === 'object' && !Array.isArray(data)
          ? data as Record<string, unknown> : {};
        const login = typeof details.login === 'string' ? details.login : '';
        const id = details.id;
        if (login.toLowerCase() !== expectedLogin ||
            typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1 ||
            details.type !== 'Bot') {
          throw new GitHubAppAuthError('GITHUB_APP_BOT_IDENTITY_INVALID', 502);
        }
        cachedBotIdentity = Object.freeze({
          name: login,
          email: String(id) + '+' + login + '@users.noreply.github.com'
        });
        return cachedBotIdentity;
      })().finally(() => { botInFlight = null; });
    }
    return botInFlight;
  }

  async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
    const url = input instanceof URL ? input
      : typeof input === 'string' ? new URL(input)
      : new URL(input.url);

    // A compromised or misconfigured caller cannot send the installation
    // token to other origins or non-repository GitHub endpoints.
    if (url.origin !== GITHUB_API || !url.pathname.startsWith('/repos/')) {
      throw new GitHubAppAuthError('GITHUB_APP_ENDPOINT_BLOCKED', 403);
    }

    const token = await installationToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', 'Bearer ' + token);
    // Never allow HTTP redirects to forward installation credentials to another host.
    return fetchImpl(input, { ...init, headers, redirect: 'error' });
  }

  return Object.freeze({
    authenticatedFetch,
    installationToken,
    botCommitIdentity
  });
}
