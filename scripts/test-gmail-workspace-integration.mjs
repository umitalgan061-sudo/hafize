import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const sourcePath = fileURLToPath(new URL('../public/gmail-workspace.js', import.meta.url));
const stylePath = fileURLToPath(new URL('../public/gmail-workspace.css', import.meta.url));
const styleLoaderPath = fileURLToPath(new URL('../public/gmail-workspace-style.js', import.meta.url));
const loaderPath = fileURLToPath(new URL('../public/chat-run-controller.js', import.meta.url));
const policyPath = fileURLToPath(new URL('../public/sw-policy.js', import.meta.url));
const cloudPath = fileURLToPath(new URL('../public/cloud-session-ui.js', import.meta.url));
const gmailRuntimePath = fileURLToPath(new URL('../lib/gmail-agent-runtime.mjs', import.meta.url));
const gmailBoundaryPath = fileURLToPath(new URL('../lib/gmail-read-tool-boundary.mjs', import.meta.url));

const [source, style, styleLoader, loader, policy, cloud, gmailRuntime, gmailBoundary] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(stylePath, 'utf8'),
  readFile(styleLoaderPath, 'utf8'),
  readFile(loaderPath, 'utf8'),
  readFile(policyPath, 'utf8'),
  readFile(cloudPath, 'utf8'),
  readFile(gmailRuntimePath, 'utf8'),
  readFile(gmailBoundaryPath, 'utf8')
]);

for (const forbidden of [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /sendBeacon/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /indexedDB/,
  /document\.cookie/,
  /navigator\.clipboard/,
  /innerHTML/,
  /requestSubmit\s*\(/,
  /\.submit\s*\(/,
  /Authorization/i,
  /Bearer\s+/,
  /GITHUB_TOKEN/,
  /GOOGLE_CLIENT_SECRET/,
  /HAFIZE_.*(?:TOKEN|KEY|SECRET)/,
  /child_process/,
  /shell\s*:\s*true/,
  /\bexec\s*\(/,
  /\bspawn\s*\(/
]) {
  assert.equal(forbidden.test(source), false, `workspace exposes forbidden surface: ${forbidden}`);
}

assert.ok(source.includes("querySelector?.('#gmailConnectionStatus')"));
assert.ok(source.includes("querySelector?.('#messageInput')"));
assert.ok(source.includes("querySelector?.('#toolModeBtn')"));
assert.ok(source.includes("querySelector?.('#sendBtn')"));
assert.ok(source.includes("input.dispatchEvent?.(new root.Event('input', { bubbles: true }))"));
assert.ok(source.includes("String(input.value || '').trim()"), 'existing composer draft must be preserved');
assert.ok(source.includes("toolButton.click?.()"), 'tool mode changes only through the existing explicit click path');
assert.equal(source.includes('sendButton.click'), false, 'workspace must never auto-send');
assert.equal(source.includes('composer.requestSubmit'), false, 'workspace must never submit the composer');

assert.ok(cloud.includes("gmailStatus.dataset.state = gmailLinked ? 'linked' : 'unlinked'"));
assert.ok(gmailRuntime.includes("access: 'authenticated-read-only'"));
assert.ok(gmailBoundary.includes("description: 'Bağlı Gmail hesabından salt-okunur profil veya mesaj bilgisi getirir."));
assert.ok(gmailBoundary.includes("const OPERATIONS = Object.freeze(['profile.get', 'message.list', 'message.get'])"));
assert.equal(/message\.send|message\.delete|label\.modify/.test(gmailBoundary), false);

assert.ok(loader.includes("loadShellEnhancement('HafizeGmailWorkspaceStyle', '/gmail-workspace-style.js', 'data-hafize-gmail-workspace-style-loader')"));
assert.ok(loader.includes("loadShellEnhancement('HafizeGmailWorkspace', '/gmail-workspace.js', 'data-hafize-gmail-workspace')"));
assert.equal(loader.split("'/gmail-workspace.js'").length - 1, 1);
assert.equal(loader.split("'/gmail-workspace-style.js'").length - 1, 1);

assert.ok(styleLoader.includes("const HREF = '/gmail-workspace.css'"));
assert.ok(styleLoader.includes("data-hafize-gmail-workspace-style"));
assert.ok(style.includes('@media (max-width: 680px)'));
assert.ok(style.includes('min-height: 44px'));
assert.ok(style.includes('@media (prefers-reduced-motion: reduce)'));
assert.ok(style.includes('@media (forced-colors: active)'));
assert.ok(style.includes(':focus-visible'));

assert.ok(policy.includes("const CURRENT_CACHE = `${CACHE_PREFIX}v76`"));
for (const asset of ['/gmail-workspace-style.js', '/gmail-workspace.js', '/gmail-workspace.css']) {
  assert.ok(policy.includes(`'${asset}'`), `${asset} must be in shell assets`);
}
assert.ok(policy.includes("if (pathname.startsWith('/api/')) return 'network-only'"));

console.log('gmail workspace integration tests passed');
