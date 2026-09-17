import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAgentSystemMessage,
  createTraceId,
  listPublicAgents,
  loadAgentRegistry,
  normalizeClientMessages,
  resolveAgent
} from './lib/agent-runtime.ts';
import { createAgentDelegator } from './lib/agent-delegation.ts';
import { runDelegatedAgent } from './lib/delegated-agent-runner.mjs';
import { createAgentRunLedger } from './lib/agent-run-ledger.ts';
import { createGitHubReadFile, parseGitHubRepoAllowlist } from './lib/github-read.mjs';
import { createCanvaAgentRuntime } from './lib/canva-agent-runtime.mjs';
import { createGmailAgentRuntime } from './lib/gmail-agent-runtime.mjs';
import { createContextCompactor } from './lib/context-compaction.mjs';
import { createRedisScheduleLeaseRuntime } from './lib/redis-schedule-lease-runtime.mjs';
import { createScheduleCommandBoundary } from './lib/schedule-command-boundary.mjs';
import { createScheduleExecutionRuntime } from './lib/schedule-execution-runtime.mjs';
import { createScheduleHttpApi } from './lib/schedule-http-api.mjs';
import { createBearerPrincipalAuthenticator } from './lib/server-auth.ts';
import { createScheduleStorageRuntime } from './lib/schedule-storage-runtime.mjs';
import { createScheduleWorker } from './lib/schedule-worker.mjs';
import { createScheduledAgentExecutor } from './lib/scheduled-agent-executor.mjs';
import { normalizeNvidiaChatCompletion } from './lib/model-response-contract.mjs';
import { deliverRequestFailure } from './lib/request-failure.mjs';
import {
  executeNvidiaToolCall,
  getAllowedNvidiaTools,
  getPublicToolActivity,
  getPublicToolRunningActivity
} from './lib/tool-runtime.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NIM_BASE_URL = (process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const SCHEDULE_AUTH_TOKEN = process.env.HAFIZE_SCHEDULE_AUTH_TOKEN || '';
const SCHEDULE_AUTH_SUBJECT = process.env.HAFIZE_SCHEDULE_AUTH_SUBJECT || '';
const SCHEDULE_MODEL = (process.env.HAFIZE_SCHEDULE_MODEL || '').trim();
const SCHEDULE_TICK_MS = boundedEnvInteger(process.env.HAFIZE_SCHEDULE_TICK_MS, 30_000, 5_000, 300_000);
const SCHEDULE_RUN_TIMEOUT_MS = boundedEnvInteger(process.env.HAFIZE_SCHEDULE_RUN_TIMEOUT_MS, 120_000, 10_000, 300_000);
const CONTEXT_LIMIT_TOKENS = boundedEnvInteger(process.env.HAFIZE_CONTEXT_LIMIT_TOKENS, 128_000, 16_000, 2_000_000);
const GITHUB_ALLOWED_REPOS = parseGitHubRepoAllowlist(process.env.HAFIZE_GITHUB_READ_REPOS || '');
const GITHUB_READ_CONFIGURED = Boolean(GITHUB_TOKEN && GITHUB_ALLOWED_REPOS.length);
const GITHUB_READ_FILE = createGitHubReadFile({
  token: GITHUB_TOKEN,
  allowedRepositories: GITHUB_ALLOWED_REPOS
});
const MAX_BODY_BYTES = 256 * 1024;
const AGENT_REGISTRY = await loadAgentRegistry();
const CANVA_AGENT_RUNTIME = createCanvaAgentRuntime();
const GMAIL_AGENT_RUNTIME = createGmailAgentRuntime();

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml']
]);

function boundedEnvInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
}

function sendJson(res, status, payload) {
  setSecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

function startSse(res) {
  setSecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
}

function sendSseContent(res, content) {
  startSse(res);
  if (content) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
  }
  res.end('data: [DONE]\n\n');
}

function writeToolActivitySse(res, activity) {
  if (!activity) return;
  res.write(`event: hafize-tool-activity\ndata: ${JSON.stringify(activity)}\n\n`);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
