import { createPrivateKey, sign } from 'node:crypto';

const API_URL = 'https://api.github.com';
const REPO_PATTERN = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const ID_PATTERN = /^[1-9]\d{0,17}$/;
const MAX_TOKEN_LENGTH = 8192;
const JWT_LIFETIME_SECONDS = 540;

export type GitHubAppScope = 'contents' | 'contents_read' | 'pull_requests' | 'actions' | 'checks';
export type GitHubAppAuthErrorCode =
  | 'GITHUB_APP_NOT_CONFIGURED'
  | 'GITHUB_APP_REPOSITORY_NOT_ALLOWED'
  | 'GITHUB_APP_INSTALLATION_MISMATCH'
  | 'GITHUB_APP_INSTALLATION_NOT_SELECTED'
  | 'GITHUB_APP_INVALID_KEY'
  | 'GITHUB_APP_AUTH_FAILED';

export class GitHubAppAuthError extends Error {
  constructor(readonly code: GitHubAppAuthErrorCode, readonly status = 403) {
    super(code);
    this.name = 'GitHubAppAuthError';
  }
}

type RecordValue = Record<string, unknown>;

export type GitHubAppAuthOptions = {
  readonly appId?: string | number;
  readonly installationId?: string | number;
  readonly privateKey?: string;
  readonly allowedRepositories?: readonly string[];
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
};

function isRecord(value: unknown): value is RecordValue {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validId(value: unknown): string {
  const id = String(value ?? '').trim();
  return ID_PATTERN.test(id) ? id : '';
}

function encodeJwtPart(value: RecordValue): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

/**
 * Server-only, opt-in GitHub App installation credentials.
 * An installation is accepted only if it belongs to the requested owner and
 * uses selected repositories. Each token is narrowed to ONE allowlisted repo
 * and ONE requested capability; no token is ever returned to the browser.
 */
export function createGitHubAppTokenProvider(options: GitHubAppAuthOptions = {}) {
  const appId = validId(options.appId);
  const installationId = validId(options.installationId);
  const pem = typeof options.privateKey === 'string'
    ? options.privateKey.replace(/\\n/g, '\n').trim()
    : '';
  const allowed = new Set((options.allowedRepositories || [])
    .map((repo) => String(repo).trim().toLowerCase())
    .filter((repo) => REPO_PATTERN.test(repo)));
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now || Date.now;
  const configured = () => Boolean(appId && installationId && pem && allowed.size && typeof fetchImpl === 'function');

  function makeJwt(): string {
    try {
      const seconds = Math.floor(now() / 1000);
      const header = encodeJwtPart({ alg: 'RS256', typ: 'JWT' });
      const payload = encodeJwtPart({
        iat: seconds - 60,
        exp: seconds + JWT_LIFETIME_SECONDS,
        iss: appId
      });
      const input = header + '.' + payload;
      const key = createPrivateKey(pem);
      const signature = sign('RSA-SHA256', Buffer.from(input), key).toString('base64url');
      return input + '.' + signature;
    } catch {
      throw new GitHubAppAuthError('GITHUB_APP_INVALID_KEY', 503);
    }
  }

  async function request(method: 'GET' | 'POST', pathname: string, jwt: string, body?: RecordValue): Promise<RecordValue> {
    let response: Response;
    try {
      response = await fetchImpl(new URL(pathname, API_URL), {
        method,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + jwt,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'Hafize-GitHub-App'
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) throw new Error('upstream response');
      const json: unknown = await response.json();
      if (!isRecord(json)) throw new Error('invalid response');
      return json;
    } catch {
      // Never forward GitHub response bodies, credentials, or JWTs to callers.
      throw new GitHubAppAuthError('GITHUB_APP_AUTH_FAILED', 502);
    }
  }

  function assertRepository(repository: string): string {
    if (typeof repository !== 'string') throw new GitHubAppAuthError('GITHUB_APP_REPOSITORY_NOT_ALLOWED');
    const normalized = repository.trim().toLowerCase();
    if (!REPO_PATTERN.test(repository) || !allowed.has(normalized)) {
      throw new GitHubAppAuthError('GITHUB_APP_REPOSITORY_NOT_ALLOWED');
    }
    return normalized;
  }

  async function verifiedInstallation(repository: string, jwt: string): Promise<RecordValue> {
    const [owner] = repository.split('/');
    const installation = await request('GET', '/app/installations/' + installationId, jwt);
    const account = isRecord(installation.account) ? installation.account : {};
    if (String(installation.id) !== installationId ||
        String(installation.app_id) !== appId ||
        String(account.login || '').toLowerCase() !== owner ||
        installation.suspended_at != null) {
      throw new GitHubAppAuthError('GITHUB_APP_INSTALLATION_MISMATCH');
    }
    if (installation.repository_selection !== 'selected') {
      throw new GitHubAppAuthError('GITHUB_APP_INSTALLATION_NOT_SELECTED');
    }
    return installation;
  }

  /**
   * Resolve the real bot account user ID, never the App ID.
   * GitHub associates commits with <bot-user-id>+<app-slug>[bot]@users.noreply.github.com.
   */
  async function getBotIdentity(repository: string): Promise<Readonly<{ name: string; email: string }>> {
    if (!configured()) throw new GitHubAppAuthError('GITHUB_APP_NOT_CONFIGURED', 503);
    const normalized = assertRepository(repository);
    const jwt = makeJwt();
    const installation = await verifiedInstallation(normalized, jwt);
    const slug = String(installation.app_slug || '');
    if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(slug)) {
      throw new GitHubAppAuthError('GITHUB_APP_AUTH_FAILED', 502);
    }
    const name = slug + '[bot]';
    // The public user endpoint accepts installation tokens; an App JWT is limited to App endpoints.
    const readToken = await getToken(normalized, 'contents_read');
    const bot = await request('GET', '/users/' + encodeURIComponent(name), readToken);
    const id = validId(bot.id);
    if (!id || String(bot.login) !== name || bot.type !== 'Bot') {
      throw new GitHubAppAuthError('GITHUB_APP_AUTH_FAILED', 502);
    }
    return Object.freeze({ name, email: id + '+' + name + '@users.noreply.github.com' });
  }

  async function getToken(repository: string, scope: GitHubAppScope): Promise<string> {
    if (!configured()) throw new GitHubAppAuthError('GITHUB_APP_NOT_CONFIGURED', 503);
    const normalized = assertRepository(repository);
    if (!(['contents', 'contents_read', 'pull_requests', 'actions', 'checks'] as string[]).includes(scope)) {
      throw new GitHubAppAuthError('GITHUB_APP_AUTH_FAILED', 400);
    }

    const [, name] = normalized.split('/') as [string, string];
    const jwt = makeJwt();
    await verifiedInstallation(normalized, jwt);

    const permissionName = scope === 'contents_read' ? 'contents' : scope;
    const level = scope === 'contents' || scope === 'pull_requests' ? 'write' : 'read';
    const permissions = { [permissionName]: level };
    const issued = await request('POST', '/app/installations/' + installationId + '/access_tokens', jwt, {
      repositories: [name],
      permissions
    });
    const issuedPermissions = isRecord(issued.permissions) ? issued.permissions : {};
    const expiresAt = Date.parse(String(issued.expires_at || ''));
    const token = issued.token;
    if (typeof token !== 'string' || !token || token.length > MAX_TOKEN_LENGTH ||
        issuedPermissions[permissionName] !== level ||
        !Number.isFinite(expiresAt) || expiresAt - now() <= 30_000) {
      throw new GitHubAppAuthError('GITHUB_APP_AUTH_FAILED', 502);
    }
    if (Array.isArray(issued.repositories) && (
      issued.repositories.length !== 1 ||
      !isRecord(issued.repositories[0]) ||
      String(issued.repositories[0].full_name || '').toLowerCase() !== normalized
    )) {
      throw new GitHubAppAuthError('GITHUB_APP_AUTH_FAILED', 502);
    }
    return token;
  }

  return Object.freeze({ configured, getToken, getBotIdentity });
}
