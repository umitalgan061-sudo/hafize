import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/hands-free-background-guard.js', import.meta.url), 'utf8');
const doc = await readFile(new URL('../docs/HANDS_FREE_MICROPHONE_DEVICE_CONTRACT.md', import.meta.url), 'utf8');

assert.match(source, /MICROPHONE_DEVICE_REASON\s*=\s*'microphone-device-unavailable'/);
assert.match(source, /addEventListener\('devicechange',\s*onMediaDeviceChange\)/);
assert.match(source, /removeEventListener\?\.\('devicechange',\s*onMediaDeviceChange\)/);
assert.match(source, /enumerateDevices\(\)/);
assert.match(source, /device\?\.kind === 'audioinput'/);
assert.match(source, /if \(!isHandsFreeEnabled\(toggle\)\) \{\s*deviceAvailability = 'inactive';\s*return false;/s);
assert.match(source, /if \(!available && isHandsFreeEnabled\(toggle\)\) \{\s*const revoked = revoke\(MICROPHONE_DEVICE_REASON\);\s*if \(revoked\) announceRevocation\(\);\s*\}/s);
assert.match(source, /deviceWatchGeneration/);
assert.match(source, /destroyed \|\| generation !== deviceWatchGeneration/);

assert.doesNotMatch(source, /getUserMedia\s*\(/, 'device-loss guard must never request microphone permission or capture audio');
assert.doesNotMatch(source, /getDisplayMedia\s*\(/);
assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i, 'device inventory must not be persisted');
assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/i, 'device inventory must not leave the browser');
assert.doesNotMatch(source, /deviceId\s*[,:=]|groupId\s*[,:=]|\.label\b/, 'guard must not read or retain identifying device metadata');
assert.doesNotMatch(source, /console\.(?:log|info|warn|error).*devices?/i, 'device inventory must not be logged');
assert.doesNotMatch(source, /toggle\?*\.click\(\).*device/i, 'device loss cannot manufacture a consent click');

assert.match(doc, /yalnızca `kind === "audioinput"`/i);
assert.match(doc, /cihaz adı, `deviceId`, `groupId` veya label/i);
assert.match(doc, /`getUserMedia` çağrılmaz/i);
assert.match(doc, /otomatik yeniden etkinleştirme yoktur/i);
assert.match(doc, /NVIDIA NIM/i);
assert.match(doc, /backend default-deny/i);

console.log('hands-free microphone device contract tests passed');