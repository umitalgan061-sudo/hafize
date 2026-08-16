import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../public/voice-output.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../public/voice-output.css', import.meta.url), 'utf8');
const policy = fs.readFileSync(new URL('../public/sw-policy.js', import.meta.url), 'utf8');

assert.match(source, /voiceReplayButton/);
assert.match(source, /Son Hafize yanıtını tekrar oku/);
assert.match(source, /voiceStopButton/);
assert.match(source, /Sesli yanıtı durdur/);
assert.match(source, /function replayLatest\(\)/);
assert.match(source, /function stopSpeech\(\)/);
assert.match(source, /normalizeSpeechText\(latestAssistantText\(\)\)/);
assert.match(source, /if \(!enabled \|\| !supported \|\| speaking \|\| thinking\) return false/);
assert.match(css, /\.voice-playback-actions/);
assert.match(policy, /hafize-shell-v48/);
assert.match(policy, /if \(pathname\.startsWith\('\/api\/'\)\) return 'network-only'/);

for (const forbidden of [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /sendBeacon/,
  /navigator\.clipboard/,
  /requestSubmit\s*\(/,
  /\.submit\s*\(/
]) {
  assert.doesNotMatch(source, forbidden, `voice playback controls must not add side-effect API: ${forbidden}`);
}

console.log('voice output replay/stop integration guards passed');
