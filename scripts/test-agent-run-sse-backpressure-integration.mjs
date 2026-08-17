import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
const sessionPath = fileURLToPath(new URL('../lib/agent-sse-node-session.mjs', import.meta.url));
const writerPath = fileURLToPath(new URL('../lib/sse-node-writer.mjs', import.meta.url));
const docPath = fileURLToPath(new URL('../docs/AGENT_RUN_SSE_BACKPRESSURE.md', import.meta.url));
const [server, session, writer, doc] = await Promise.all([
  readFile(serverPath, 'utf8'),
  readFile(sessionPath, 'utf8'),
  readFile(writerPath, 'utf8'),
  readFile(docPath, 'utf8')
]);

for (const path of [serverPath, sessionPath, writerPath]) {
  const syntax = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || `${path} syntax failed`);
}

assert.match(server, /import \{ createAgentSseNodeSession \} from '\.\/lib\/agent-sse-node-session\.mjs';/);
assert.match(server, /const sseSession = streamResponse\s*\? createAgentSseNodeSession\(/);
assert.match(server, /response: res, signal: controller\.signal, setSecurityHeaders/);
assert.match(server, /res\.once\('close', \(\) => controller\.abort\(\)\)/);

assert.match(server, /await sseSession\.sendContent\(skillRun\.content\)/);
assert.match(server, /await sseSession\.sendContent\(content\)/);
assert.match(server, /await sseSession\.writeToolActivity\(getPublicToolRunningActivity/);
assert.match(server, /await sseSession\.writeToolActivity\(getPublicToolActivity/);
assert.match(server, /const streamResult = await sseSession\.pipe\(upstream\.body\)/);
assert.match(server, /await sseSession\.writePublicError\('NVIDIA_CHAT_ERROR'\)/);
assert.match(server, /await upstream\.body\?\.cancel\?\.\(\)/);
assert.match(server, /detail: 'client_stream_closed'/);
assert.match(server, /controller\.abort\(\);\s*runLedger\.finish\(\{ ok: false, detail: 'client_stream_closed' \}\)/);
assert.match(server, /approvalGranted: false/);

for (const forbidden of [
  /for await \(const chunk of upstream\.body\) res\.write\(chunk\)/,
  /writeToolActivitySse\(/,
  /sendSseContent\(/,
  /startSse\(/,
  /res\.write\(`data: \$\{JSON\.stringify\(\{ error: 'STREAM_INTERRUPTED'/,
  /res\.write\(`data: \$\{JSON\.stringify\(\{ error: 'NVIDIA_CHAT_ERROR'/
]) {
  assert.equal(forbidden.test(server), false, `manual agent SSE write path must stay removed: ${forbidden}`);
}

assert.match(session, /createSseNodeWriter/);
assert.match(session, /activeWriter\.pipe\(iterable\)/);
assert.match(session, /activeWriter\.writeEvent\(activity, \{ event: 'hafize-tool-activity' \}\)/);
assert.match(session, /normalizePublicErrorCode/);
assert.match(session, /SSE_OUTPUT_/);
assert.match(writer, /if \(accepted !== false\) return writable\(\)/);
assert.match(writer, /waitForDrain\(target, signal, drainTimeout\)/);
assert.match(writer, /SSE_OUTPUT_DRAIN_TIMEOUT/);
assert.match(writer, /DEFAULT_MAX_CHUNK_BYTES = 256 \* 1024/);

for (const forbidden of [
  /GITHUB_WRITE_NODE_SERVER_RUNTIME\s*=/,
  /GOOGLE_OAUTH_HTTP_RUNTIME\s*=/,
  /MEMORY_SERVER_RUNTIME\s*=/,
  /SCREEN_ANALYSIS_SERVER_RUNTIME\s*=/
]) {
  assert.equal(forbidden.test(session), false, `SSE session must not gain unrelated runtime authority: ${forbidden}`);
}

assert.match(doc, /response\.write\(\).*false/i);
assert.match(doc, /drain/);
assert.match(doc, /256 KiB/);
assert.match(doc, /client disconnect/i);
assert.match(doc, /approvalGranted: false/);
assert.match(doc, /STREAM_INTERRUPTED/);
assert.match(doc, /NVIDIA_CHAT_ERROR/);
assert.match(doc, /secret/i);

console.log('agent run SSE backpressure integration tests passed');
