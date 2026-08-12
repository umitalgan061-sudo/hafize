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
} from './lib/agent-runtime.mjs';
import { createAgentExecutor } from './lib/agent-executor.mjs';
import { createGitHubReadFile, parseGitHubRepoAllowlist } from './lib/github-read.mjs';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './lib/tool-runtime.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT || '4173', 10);
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '';
const NIM_BASE_URL = (process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_ALLOWED_REPOS = parseGitHubRepoAllowlist(process.env.HAFIZE_GITHUB_READ_REPOS || '');
const GITHUB_READ_CONFIGURED = Boolean(GITHUB_TOKEN && GITHUB_ALLOWED_REPOS.length);
const GITHUB_READ_FILE = createGitHubReadFile({
  token: GITHUB_TOKEN,
  allowedRepositories: GITHUB_ALLOWED_REPOS
});
const MAX_BODY_BYTES = 256 * 1024;
const AGENT_REGISTRY = await loadAgentRegistry();

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

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function nvidiaFetch(pathname, init = {}) {
  if (!NVIDIA_API_KEY) {
    const error = new Error('NVIDIA_NOT_CONFIGURED');
    error.status = 503;
    throw error;
  }
  return fetch(`${NIM_BASE_URL}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      ...(init.headers || {})
    }
  });
}

async function nvidiaJsonCompletion(payload, signal) {
  const upstream = await nvidiaFetch('/chat/completions', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await upstream.text();
  if (!upstream.ok) {
    const error = new Error('NVIDIA_CHAT_ERROR');
    error.status = upstream.status || 502;
    error.detail = text.slice(0, 1200);
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('INVALID_NVIDIA_RESPONSE');
    error.status = 502;
    throw error;
  }
}

function boundedMaxTokens(body) {
  return Number.isInteger(body.max_tokens) ? Math.min(Math.max(body.max_tokens, 1), 8192) : 2048;
}

const AGENT_EXECUTOR = createAgentExecutor({
  registry: AGENT_REGISTRY,
  complete: nvidiaJsonCompletion,
  buildSystemMessage: buildAgentSystemMessage,
  getAllowedTools: getAllowedNvidiaTools,
  executeTool: executeNvidiaToolCall,
  toolContextFactory: () => ({
    nvidiaConfigured: Boolean(NVIDIA_API_KEY),
    githubReadConfigured: GITHUB_READ_CONFIGURED,
    githubReadFile: GITHUB_READ_FILE
  })
});

async function handleModels(res) {
  const upstream = await nvidiaFetch('/models', { headers: { Accept: 'application/json' } });
  const text = await upstream.text();
  if (!upstream.ok) {
    sendJson(res, upstream.status, { error: 'NVIDIA_MODELS_ERROR', detail: text.slice(0, 1000) });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    sendJson(res, 502, { error: 'INVALID_NVIDIA_RESPONSE' });
    return;
  }

  const models = Array.isArray(payload.data)
    ? payload.data.map((item) => item?.id).filter((id) => typeof id === 'string' && id.length > 0)
    : [];
  sendJson(res, 200, { models });
}

function handleAgents(res) {
  sendJson(res, 200, {
    defaultAgent: AGENT_REGISTRY.defaultAgent,
    agents: listPublicAgents(AGENT_REGISTRY)
  });
}

async function handleAgentRun(req, res) {
  const body = await readJson(req);
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const messages = normalizeClientMessages(body.messages);
  const agent = resolveAgent(AGENT_REGISTRY, body.agentId);
  if (!model || !messages || !agent) {
    sendJson(res, 400, { error: !agent ? 'INVALID_AGENT' : 'INVALID_CHAT_REQUEST' });
    return;
  }

  const traceId = createTraceId();
  res.setHeader('X-Hafize-Trace-Id', traceId);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const result = await AGENT_EXECUTOR.run({
    model,
    agent,
    messages,
    traceId,
    signal: controller.signal,
    maxTokens: boundedMaxTokens(body)
  });

  sendJson(res, 200, {
    traceId,
    agent: { id: agent.id, name: agent.name },
    content: result.content,
    tools: result.tools,
    delegations: result.ledger
  });
}

async function handleChat(req, res) {
  const body = await readJson(req);
  const model = typeof body.model === 'string' ? body.model.trim() : '';
  const messages = normalizeClientMessages(body.messages);
  const agent = resolveAgent(AGENT_REGISTRY, body.agentId);
  if (!model || !messages || !agent) {
    sendJson(res, 400, { error: !agent ? 'INVALID_AGENT' : 'INVALID_CHAT_REQUEST' });
    return;
  }

  const traceId = createTraceId();
  res.setHeader('X-Hafize-Trace-Id', traceId);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const payload = {
    model,
    messages: [buildAgentSystemMessage(agent, traceId), ...messages],
    stream: true,
    max_tokens: boundedMaxTokens(body)
  };
  if (typeof body.temperature === 'number') payload.temperature = Math.min(Math.max(body.temperature, 0), 2);
  if (typeof body.top_p === 'number') payload.top_p = Math.min(Math.max(body.top_p, 0), 1);

  const upstream = await nvidiaFetch('/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(payload)
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text();
    sendJson(res, upstream.status || 502, { error: 'NVIDIA_CHAT_ERROR', detail: detail.slice(0, 1200) });
    return;
  }

  setSecurityHeaders(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });

  try {
    for await (const chunk of upstream.body) res.write(chunk);
  } catch (error) {
    if (error?.name !== 'AbortError') res.write(`data: ${JSON.stringify({ error: 'STREAM_INTERRUPTED' })}\n\n`);
  } finally {
    res.end();
  }
}

async function serveStatic(pathname, res) {
  const decoded = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  const filePath = resolve(PUBLIC_DIR, `.${decoded}`);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${sep}`)) {
    sendJson(res, 400, { error: 'INVALID_PATH' });
    return;
  }
  const relative = filePath.slice(PUBLIC_DIR.length + 1);

  try {
    const content = await readFile(filePath);
    setSecurityHeaders(res);
    res.writeHead(200, {
      'Content-Type': MIME.get(extname(filePath).toLowerCase()) || 'application/octet-stream',
      'Cache-Control': relative === 'index.html' ? 'no-cache' : 'public, max-age=300'
    });
    res.end(content);
  } catch {
    sendJson(res, 404, { error: 'NOT_FOUND' });
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, {
        status: 'ok',
        nvidiaConfigured: Boolean(NVIDIA_API_KEY),
        githubReadConfigured: GITHUB_READ_CONFIGURED,
        agents: AGENT_REGISTRY.agents.length
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/models') {
      await handleModels(res);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/agents') {
      handleAgents(res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/agent/run') {
      await handleAgentRun(req, res);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      await handleChat(req, res);
      return;
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      await serveStatic(url.pathname, res);
      return;
    }
    sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  } catch (error) {
    if (error?.message === 'BODY_TOO_LARGE') sendJson(res, 413, { error: 'BODY_TOO_LARGE' });
    else if (error?.message === 'NVIDIA_NOT_CONFIGURED') sendJson(res, 503, { error: 'NVIDIA_NOT_CONFIGURED' });
    else if (error?.message === 'NVIDIA_CHAT_ERROR') sendJson(res, error.status || 502, { error: 'NVIDIA_CHAT_ERROR', detail: error.detail || '' });
    else if (error?.message === 'INVALID_NVIDIA_RESPONSE') sendJson(res, error.status || 502, { error: 'INVALID_NVIDIA_RESPONSE' });
    else if (error instanceof SyntaxError) sendJson(res, 400, { error: 'INVALID_JSON' });
    else sendJson(res, 500, { error: 'INTERNAL_ERROR' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Hafize listening on http://${HOST}:${PORT}`);
});
