import assert from 'node:assert/strict';
import { installElectronSessionPermissionPolicy } from '../desktop/session-permission-policy.mjs';

function harness(options = {}) {
  let requestHandler;
  let checkHandler;
  const session = {
    setPermissionRequestHandler(value) { requestHandler = value; },
    setPermissionCheckHandler(value) { checkHandler = value; }
  };
  const webContents = { session };
  const policy = installElectronSessionPermissionPolicy({
    webContents,
    rendererOrigin: 'http://127.0.0.1:4173',
    ...options
  });
  return { policy, webContents, session, get requestHandler() { return requestHandler; }, get checkHandler() { return checkHandler; } };
}

function request(runtime, requester, permission, details) {
  let granted = null;
  runtime.requestHandler(requester, permission, (value) => { granted = value; }, details);
  return granted;
}

const denied = harness();
assert.equal(denied.policy.allowAudioMedia, false);
assert.equal(request(denied, denied.webContents, 'media', {
  isMainFrame: true,
  requestingUrl: 'http://127.0.0.1:4173/',
  mediaTypes: ['audio']
}), false);
assert.equal(denied.checkHandler(denied.webContents, 'media', 'http://127.0.0.1:4173', {
  isMainFrame: true,
  mediaType: 'audio'
}), false);

const audio = harness({ allowAudioMedia: true });
assert.equal(request(audio, audio.webContents, 'media', {
  isMainFrame: true,
  requestingUrl: 'http://127.0.0.1:4173/voice',
  mediaTypes: ['audio']
}), true);
assert.equal(audio.checkHandler(audio.webContents, 'media', 'http://127.0.0.1:4173', {
  isMainFrame: true,
  mediaType: 'audio'
}), true);

for (const details of [
  { isMainFrame: true, requestingUrl: 'http://127.0.0.1:4173/', mediaTypes: ['video'] },
  { isMainFrame: true, requestingUrl: 'http://127.0.0.1:4173/', mediaTypes: ['audio', 'video'] },
  { isMainFrame: false, requestingUrl: 'http://127.0.0.1:4173/', mediaTypes: ['audio'] },
  { isMainFrame: true, requestingUrl: 'https://evil.example/', mediaTypes: ['audio'] },
  { isMainFrame: true, requestingUrl: 'http://user:pass@127.0.0.1:4173/', mediaTypes: ['audio'] },
  { isMainFrame: true, requestingUrl: 'not-a-url', mediaTypes: ['audio'] }
]) {
  assert.equal(request(audio, audio.webContents, 'media', details), false);
}
assert.equal(request(audio, {}, 'media', {
  isMainFrame: true,
  requestingUrl: 'http://127.0.0.1:4173/',
  mediaTypes: ['audio']
}), false);
assert.equal(request(audio, audio.webContents, 'geolocation', {
  isMainFrame: true,
  requestingUrl: 'http://127.0.0.1:4173/'
}), false);
assert.equal(audio.checkHandler(audio.webContents, 'media', 'https://evil.example', { isMainFrame: true, mediaType: 'audio' }), false);
assert.equal(audio.checkHandler(audio.webContents, 'media', 'http://user:pass@127.0.0.1:4173', { isMainFrame: true, mediaType: 'audio' }), false);
assert.equal(audio.checkHandler(null, 'media', 'http://127.0.0.1:4173', { isMainFrame: true, mediaType: 'audio' }), false);
assert.equal(audio.checkHandler(audio.webContents, 'media', 'http://127.0.0.1:4173', { isMainFrame: true, mediaType: 'video' }), false);
assert.equal(audio.checkHandler(audio.webContents, 'notifications', 'http://127.0.0.1:4173', { isMainFrame: true }), false);

const beforeDisposeRequest = audio.requestHandler;
const beforeDisposeCheck = audio.checkHandler;
audio.policy.dispose();
assert.notStrictEqual(audio.requestHandler, beforeDisposeRequest);
assert.notStrictEqual(audio.checkHandler, beforeDisposeCheck);
assert.equal(request(audio, audio.webContents, 'media', {
  isMainFrame: true,
  requestingUrl: 'http://127.0.0.1:4173/',
  mediaTypes: ['audio']
}), false, 'disposed policy must remain fail-closed instead of restoring Electron defaults');
assert.equal(audio.checkHandler(audio.webContents, 'media', 'http://127.0.0.1:4173', { isMainFrame: true, mediaType: 'audio' }), false);

audio.policy.dispose();
const replacement = installElectronSessionPermissionPolicy({
  webContents: audio.webContents,
  rendererOrigin: 'http://127.0.0.1:4173',
  allowAudioMedia: true
});
const replacementRequest = audio.requestHandler;
assert.equal(request(audio, audio.webContents, 'media', {
  isMainFrame: true,
  requestingUrl: 'http://127.0.0.1:4173/',
  mediaTypes: ['audio']
}), true);
audio.policy.dispose();
assert.strictEqual(audio.requestHandler, replacementRequest, 'stale policy dispose must not replace newer session handlers');
replacement.dispose();
assert.equal(request(audio, audio.webContents, 'media', {
  isMainFrame: true,
  requestingUrl: 'http://127.0.0.1:4173/',
  mediaTypes: ['audio']
}), false);

const sharedSession = {
  requestHandler: null,
  checkHandler: null,
  setPermissionRequestHandler(value) { this.requestHandler = value; },
  setPermissionCheckHandler(value) { this.checkHandler = value; }
};
const sharedContents = { session: sharedSession };
const firstSharedPolicy = installElectronSessionPermissionPolicy({
  webContents: sharedContents,
  rendererOrigin: 'http://127.0.0.1:4173'
});
assert.throws(() => installElectronSessionPermissionPolicy({
  webContents: sharedContents,
  rendererOrigin: 'http://127.0.0.1:4173'
}), /DESKTOP_PERMISSION_POLICY_ALREADY_INSTALLED/);
firstSharedPolicy.dispose();

let rollbackRequestHandler = null;
const rollbackSession = {
  setPermissionRequestHandler(value) { rollbackRequestHandler = value; },
  setPermissionCheckHandler() { throw new Error('check setup failed'); }
};
assert.throws(() => installElectronSessionPermissionPolicy({
  webContents: { session: rollbackSession },
  rendererOrigin: 'http://127.0.0.1:4173'
}), /check setup failed/);
let rollbackGranted = true;
rollbackRequestHandler({}, 'media', (value) => { rollbackGranted = value; });
assert.equal(rollbackGranted, false, 'partial permission setup must roll back to deny-all');

assert.throws(() => installElectronSessionPermissionPolicy({ webContents: {}, rendererOrigin: 'http://127.0.0.1:4173' }), /INVALID_DESKTOP_PERMISSION_SESSION/);
assert.throws(() => harness({ allowAudioMedia: 'yes' }), /INVALID_DESKTOP_PERMISSION_AUDIO_POLICY/);
assert.throws(() => installElectronSessionPermissionPolicy({
  webContents: { session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
  rendererOrigin: 'file:///tmp/index.html'
}), /INVALID_DESKTOP_PERMISSION_ORIGIN/);
assert.throws(() => installElectronSessionPermissionPolicy({
  webContents: { session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
  rendererOrigin: 'http://127.0.0.1:4173/path'
}), /INVALID_DESKTOP_PERMISSION_ORIGIN/);
assert.throws(() => installElectronSessionPermissionPolicy({
  webContents: { session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } },
  rendererOrigin: 'http://user:pass@127.0.0.1:4173'
}), /INVALID_DESKTOP_PERMISSION_ORIGIN/);

console.log('electron session permission policy tests passed');
