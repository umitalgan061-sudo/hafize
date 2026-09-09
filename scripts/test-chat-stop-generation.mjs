import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { assertShellCacheSourceAtLeast } from './sw-cache-version.mjs';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const shell = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const style = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
const serviceWorkerPolicy = await readFile(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

// The composer owns exactly one in-flight request, and stopping is an abort of that
// request — not a second endpoint and not a backend cancellation call.
assert.match(app, /let streamController = null;/);
assert.match(app, /streamController = new AbortController\(\);/);
assert.match(app, /streamController\.abort\(\);/);
assert.equal((app.match(/new AbortController\(\)/g) || []).length, 1, 'only the composer may own the stream controller');
assert.doesNotMatch(app, /\/api\/chat\/(?:stop|cancel|abort)/);

// Both chat paths (plain SSE and tool mode) must be stoppable, so both carry the signal.
for (const source of [/streamAssistantReply\(signal\)/, /runAssistantWithTools\(signal\)/]) assert.match(app, source);
assert.equal((app.match(/\n\s*signal\n\s*\}\);/g) || []).length, 2, 'both fetch calls must pass the abort signal');
assert.match(app, /async function consumeAssistantStream\(response, assistantId, emptyMessage, signal\)/);
assert.match(app, /if \(signal\?\.aborted\) throw new Error\('STREAM_STOPPED'\);/);

// A stopped answer keeps the text that already arrived; it is never silently dropped
// and never replayed as a failure toast about the model.
assert.match(app, /const STOP_NOTICE = '\\n\\n\(Yanıt durduruldu\.\)';/);
assert.match(app, /const STOPPED_EMPTY_MESSAGE = 'Yanıt durduruldu\.';/);
assert.match(app, /content \? `\$\{content\}\$\{STOP_NOTICE\}` : STOPPED_EMPTY_MESSAGE, \{ persist: true \}/);
assert.match(app, /await reader\.cancel\(\)\.catch\(\(\) => \{\}\);/);
assert.match(app, /const stoppedByUser = isAbortError\(error\) \|\| streamController\?\.signal\.aborted === true;/);
assert.match(app, /else if \(!stoppedByUser\) addMessage\('assistant', message\);/);

// Stopping is idempotent: a second click on an already aborted stream does nothing.
assert.match(app, /if \(!isStreaming \|\| !streamController \|\| streamController\.signal\.aborted\) return false;/);

// Sibling composer modules learn about a deliberate stop through one named event, so
// voice output can stay silent instead of reading the truncated answer aloud.
const voiceOutput = await readFile(new URL('../public/voice-output.js', import.meta.url), 'utf8');
assert.match(app, /const STREAM_STOPPED_EVENT = 'hafize:stream-stopped';/);
assert.match(app, /ui\.composer\.dispatchEvent\(new CustomEvent\(STREAM_STOPPED_EVENT, \{ bubbles: true \}\)\);/);
assert.match(voiceOutput, /const STREAM_STOPPED_EVENT = 'hafize:stream-stopped';/);
assert.match(voiceOutput, /composer\?\.addEventListener\?\.\(STREAM_STOPPED_EVENT, handleStreamStopped\);/);
assert.match(voiceOutput, /composer\?\.removeEventListener\?\.\(STREAM_STOPPED_EVENT, handleStreamStopped\);/);

// The stop affordance replaces send while streaming and is restored afterwards.
assert.match(app, /function setComposerBusy\(streaming\)/);
assert.match(app, /ui\.sendBtn\.hidden = streaming;/);
assert.match(app, /ui\.stopBtn\.hidden = !streaming;/);
assert.match(app, /setComposerBusy\(true\);/);
assert.match(app, /setComposerBusy\(false\);/);
assert.match(app, /ui\.stopBtn\?\.addEventListener\('click'/);

// Escape is the keyboard equivalent, but it must not steal Escape from text fields
// (history search clears itself with it) or from the sidebar close handler.
assert.match(app, /if \(event\.key !== 'Escape' \|\| !isStreaming\) return;/);
assert.match(app, /if \(tag === 'INPUT' \|\| tag === 'TEXTAREA' \|\| tag === 'SELECT'\) return;/);
assert.doesNotMatch(app, /if \(event\.key !== 'Escape' \|\| !isStreaming\) return;[\s\S]{0,400}?event\.preventDefault\(\)/);

assert.match(shell, /id="sendBtn"/);
assert.match(shell, /id="stopBtn"[^>]*type="button"/);
assert.match(shell, /id="stopBtn"[^>]*aria-label="Yanıtı durdur"/);
assert.match(shell, /id="stopBtn"[^>]*hidden/);
assert.ok(shell.indexOf('id="sendBtn"') < shell.indexOf('id="stopBtn"'), 'stop replaces send in place');

assert.match(style, /\.stop-btn \{/);
assert.match(style, /\.stop-btn\[hidden\], \.send-btn\[hidden\] \{ display: none; \}/);
assert.match(style, /min-height: 40px/, 'stop must stay a comfortable touch target on mobile');

// Actions that stay blocked during a stream now point at the way out.
for (const blocked of [/sohbet silinemez; önce yanıtı durdur \(Esc\)/, /geçmiş temizlenemez; önce yanıtı durdur \(Esc\)/, /sohbet değiştirilemez; önce yanıtı durdur \(Esc\)/, /yeni sohbet açılamaz; önce yanıtı durdur \(Esc\)/]) assert.match(app, blocked);

// The premium theme restyles the send button, so the stop button needs its own token
// there too — otherwise it renders off-theme in light and dark alike.
const premium = await readFile(new URL('../public/premium.css', import.meta.url), 'utf8');
assert.match(premium, /\.stop-btn \{[^}]*var\(--premium-stop\)/);
assert.equal((premium.match(/--premium-stop:/g) || []).length, 2, 'stop colour must be defined for both themes');

assertShellCacheSourceAtLeast(serviceWorkerPolicy, 19);

console.log('chat stop generation contract passed: abortable stream, preserved partial answer, keyboard and touch affordances');
