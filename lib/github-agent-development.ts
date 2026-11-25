import { createHash, randomBytes } from 'node:crypto';
import { createGitHubWorkspaceWriter, GitHubWorkspaceWriteError } from './github-workspace-write.ts';

/**
 * Narrow, GitHub-API-only development actions for the interactive Hafize agent.
 * The agent never receives a GitHub token or a shell. Every mutation uses the
 * existing single-use writer ticket. A separately enabled and owner-authenticated
 * safe-autonomy mode can issue that ticket under standing authorization, but
 * never permits default-branch writes, secret files, deployments or merges.
 */
type Writer = ReturnType<typeof createGitHubWorkspaceWriter>;
type Operation = 'branch' | 'file' | 'pull';
type Approval = (request: {
  readonly kind: string;
  readonly title: string;
  readonly detail: string;
  readonly risk: 'high';
}) => Promise<boolean>;
type RequestContext = {
  readonly requestApproval?: Approval;
  /** Trusted SERVER context only: cannot be supplied as model tool arguments. */
  readonly safeAutonomy?: boolean;
};
type Options = {
  readonly writer: Writer;
  readonly allowedRepositories: readonly string[];
  readonly sourcePathRestrictions?: Readonly<Record<string,string | readonly string[]>>;
};
const FEATURE_BRANCH = /^hafize\/auto-[a-z0-9][a-z0-9._-]{0,100}$/;
const DEFAULT_BRANCH = 'main';
const FIELD_SETS: Readonly<Record<Operation, ReadonlySet<string>>> = {
  branch: new Set(['operation', 'repository', 'branch']),
  file: new Set(['operation', 'repository', 'branch', 'path', 'content', 'message', 'existingSha']),
  pull: new Set(['operation', 'repository', 'branch', 'title', 'body'])
};

function invalid(): never {
  throw new GitHubWorkspaceWriteError('INVALID_GITHUB_ARGUMENTS', 400);
}
function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  return input as Record<string, unknown>;
}
function required(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return invalid();
  return value.trim();
}
function featureBranch(raw: unknown): string {
  const value = required(raw);
  if (!FEATURE_BRANCH.test(value) || value.includes('..') || value.endsWith('.lock')) {
    throw new GitHubWorkspaceWriteError('INVALID_GITHUB_BRANCH', 400);
  }
  return value;
}

export function createGitHubAgentDevelopment(options: Options) {
  const allowed = new Set(options.allowedRepositories.map((r) => r.toLowerCase()));
  const writer = options.writer;

  function enabled(): boolean {
    return allowed.size > 0 && writer.configured();
  }

  async function execute(raw: unknown, context: RequestContext): Promise<Record<string, unknown>> {
    const args = asRecord(raw);
    const operation = args.operation;
    if (operation !== 'branch' && operation !== 'file' && operation !== 'pull') return invalid();
    if (Object.keys(args).some((key) => !FIELD_SETS[operation].has(key))) return invalid();
    const repository = required(args.repository);
    if (!allowed.has(repository.toLowerCase())) {
      throw new GitHubWorkspaceWriteError('GITHUB_REPO_NOT_ALLOWED', 403);
    }
    // Generate a valid, unique branch only when creating a new one. Never silently
    // remap a file write or a PR to another branch.
    const branch = operation==='branch'&&args.branch===undefined ? 'hafize/auto-'+randomBytes(12).toString('hex') : featureBranch(args.branch);
    // No model tool argument can request autonomous write access. The
    // authenticated server alone decides whether its owner opted into
    // preapproved, bounded draft-PR development actions.
    const safeAutonomy = context.safeAutonomy === true;
    if (!safeAutonomy && typeof context.requestApproval !== 'function') {
      throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_REQUIRED', 428);
    }

    let payload: Record<string, unknown>;
    let summary: string;
    if (operation === 'branch') {
      payload = { repository, branch, fromRef: DEFAULT_BRANCH };
      summary = 'Depo: ' + repository + '\nYeni dal: ' + branch +
        '\nKaynak: ' + DEFAULT_BRANCH + '\nmain dalına yazma yok.';
    } else if (operation === 'file') {
      const path = required(args.path);
      const restriction = options.sourcePathRestrictions?.[repository.toLowerCase()];
      const prefixes = typeof restriction === 'string' ? [restriction] : restriction;
      if(prefixes && (!prefixes.some(prefix=>path.startsWith(prefix)) || path.split('/').some(segment=>!segment || segment==='.' || segment==='..'))) {
        throw new GitHubWorkspaceWriteError('GITHUB_REPO_PATH_NOT_ALLOWED',403);
      }
      const fileContent = args.content;
      if (typeof fileContent !== 'string') return invalid();
      payload = {
        repository, branch,
        path,
        content: fileContent,
        message: required(args.message),
        ...(args.existingSha ? { existingSha: args.existingSha } : {})
      };
      // Approval is tied to the entire normalized content; a preview plus its
      // checksum is displayed without putting installation secrets in the UI.
      summary = 'Depo: ' + repository + '\nDal: ' + branch +
        '\nDosya: ' + payload.path + '\nCommit: ' + payload.message +
        '\nİşlem: ' + (payload.existingSha ? 'mevcut dosyayı güncelle' : 'yeni dosya oluştur') +
        '\nBayt: ' + Buffer.byteLength(fileContent, 'utf8') +
        '\nSHA-256: ' + createHash('sha256').update(fileContent).digest('hex') +
        '\nİçerik önizlemesi:\n' + fileContent.slice(0, 1000);
    } else {
      payload = {
        repository,
        head: branch,
        base: DEFAULT_BRANCH,
        title: required(args.title),
        body: typeof args.body === 'string' ? args.body : '',
        draft: true
      };
      summary = 'Depo: ' + repository + '\nKaynak: ' + branch +
        '\nHedef: ' + DEFAULT_BRANCH + '\nTaslak PR: EVET' +
        '\nBaşlık: ' + payload.title + '\nAçıklama:\n' + String(payload.body).slice(0, 1200);
    }

    // Reuse all of the existing writer's secret, path, length, SHA and
    // default-branch checks BEFORE asking the user to approve.
    const normalized = writer.normalizeInput(operation, payload);
    if (!safeAutonomy) {
      const approved = await context.requestApproval!({
        kind: 'github.development.' + operation,
        title: operation === 'branch' ? 'GitHub üzerinde geliştirme dalı oluşturulsun mu?'
          : operation === 'file' ? 'GitHub dosya değişikliği commit edilsin mi?'
            : 'GitHub üzerinde taslak PR açılsın mı?',
        detail: summary,
        risk: 'high'
      });
      if (!approved) {
        throw new GitHubWorkspaceWriteError('GITHUB_WRITE_APPROVAL_REQUIRED', 428);
      }
    }
    // Even in safe autonomy, the single-use ticket stays bound to the exact
    // normalized repository, operation and entire content fingerprint.
    const ticket = writer.issueApproval(operation, normalized, true);
    const token = ticket.ticket;
    if (operation === 'branch') return writer.createBranch(token, normalized);
    if (operation === 'file') return writer.commitFile(token, normalized);
    return writer.createPullRequest(token, normalized);
  }

  return Object.freeze({ enabled, execute });
}
