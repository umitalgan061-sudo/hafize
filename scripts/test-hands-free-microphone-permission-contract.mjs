import assert from 'node:assert/strict';
import fs from 'node:fs';

const guardSource = fs.readFileSync(new URL('../public/hands-free-background-guard.js', import.meta.url), 'utf8');
const runtimeSource = fs.readFileSync(new URL('../public/hands-free.js', import.meta.url), 'utf8');
const contract = fs.readFileSync(new URL('../docs/HANDS_FREE_MICROPHONE_PERMISSION_CONTRACT.md', import.meta.url), 'utf8');

function occurrences(source, token) {
  return source.split(token).length - 1;
}

assert.match(guardSource, /permissions\.query\(\{ name: 'microphone' \}\)/, 'permission watcher must query only microphone');
assert.match(guardSource, /MICROPHONE_PERMISSION_REASON = 'microphone-permission-withdrawn'/);
assert.match(guardSource, /permissionState === 'granted'/, 'granted is the only continuing browser permission state');
assert.match(guardSource, /revoke\(MICROPHONE_PERMISSION_REASON\)/, 'permission loss must use the existing revoke primitive');
assert.match(guardSource, /permissionStatus\?\.addEventListener\?\.\('change'/, 'PermissionStatus must be observed');
assert.match(guardSource, /permissionStatus\.removeEventListener\?\.\('change'/, 'PermissionStatus listener must be removable');
assert.match(guardSource, /permissionWatchGeneration \+= 1;/, 'destroy must invalidate pending permission queries');
assert.match(guardSource, /refreshMicrophonePermission:/, 'explicit testable refresh must not be hidden in browser globals');

assert.equal(guardSource.includes('localStorage'), false, 'permission guard must not persist permission state');
assert.equal(guardSource.includes('sessionStorage'), false, 'permission guard must not persist permission state');
assert.equal(guardSource.includes('indexedDB'), false, 'permission guard must not create a database');
assert.equal(guardSource.includes('fetch('), false, 'permission guard must not send permission state over the network');
assert.equal(guardSource.includes('XMLHttpRequest'), false, 'permission guard must not add a network fallback');
assert.equal(guardSource.includes('WebSocket'), false, 'permission guard must not stream permission state');
assert.equal(guardSource.includes('sendBeacon'), false, 'permission guard must not beacon permission state');
assert.equal(guardSource.includes('postMessage'), false, 'permission guard must not widen permission state to other windows');
assert.equal(guardSource.includes('BroadcastChannel'), false, 'permission guard must remain local to the document');
assert.equal(guardSource.includes('navigator.mediaDevices.getUserMedia'), false, 'guard may observe but must never request microphone access');
assert.equal(guardSource.includes('getUserMedia('), false, 'guard may not trigger a permission prompt');

assert.equal(occurrences(guardSource, 'HANDS_FREE_REVOKE_EVENT'), 4, 'guard must reuse one named disable-only channel');
assert.equal(guardSource.includes("documentRef.dispatchEvent(createRevokeEvent(root, reason))"), true);
assert.equal(runtimeSource.includes("const HANDS_FREE_REVOKE_EVENT = 'hafize:hands-free-revoke';"), true);
assert.equal(runtimeSource.includes('function handleRevoke()'), true);
assert.equal(runtimeSource.includes('setEnabled(false);'), true, 'runtime revoke must converge on canonical disable');
assert.equal(runtimeSource.includes("documentRef.addEventListener?.(HANDS_FREE_REVOKE_EVENT, handleRevoke)"), true);
assert.equal(runtimeSource.includes("documentRef.removeEventListener?.(HANDS_FREE_REVOKE_EVENT, handleRevoke)"), true);

const permissionSection = guardSource.slice(guardSource.indexOf('function revokeForPermissionIfNeeded'), guardSource.indexOf('function onVisibilityChange'));
assert.ok(permissionSection.length > 0, 'permission boundary section must remain discoverable');
assert.equal(permissionSection.includes('setEnabled(true)'), false);
assert.equal(permissionSection.includes('.click('), false);
assert.equal(permissionSection.includes('dispatchEvent'), false, 'permission watcher delegates to revoke instead of manufacturing events itself');
assert.equal(permissionSection.includes('announce('), false, 'permission watcher cannot claim fresh consent');
assert.equal(permissionSection.includes('SpeechRecognition'), false, 'watcher cannot instantiate its own recognizer');

assert.match(contract, /yalnız mevcut yetki azaldığında aktif dinlemeyi sonlandırır/i);
assert.match(contract, /İzin daha sonra tekrar `granted` olsa bile runtime açılmaz/);
assert.match(contract, /Permissions API .* olmayan tarayıcılar/i);
assert.match(contract, /SpeechRecognition terminal hata sınırı korunur/i);
assert.match(contract, /network isteği yapmaz/i);
assert.match(contract, /local\/session storage yazmaz/i);
assert.match(contract, /NVIDIA NIM ana\/default provider olarak kalır/i);
assert.match(contract, /Dört profilli seçici mimari korunur/i);
assert.match(contract, /Backend default-deny tool permission/i);

console.log('hands-free microphone permission contract tests passed');