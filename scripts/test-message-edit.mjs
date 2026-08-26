import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  FakeElement,
  fixture,
  editButton
} from './message-edit-lifecycle-fixture.mjs';

const require = createRequire(import.meta.url);
const api = require('../public/message-edit.js');

assert.equal(api.editableText('a\r\nb'), 'a\nb');
assert.equal(api.editableText('   '), null);
assert.equal(api.editableText(null), null);
assert.equal(api.editableText('x'.repeat(api.MAX_COMPOSER_CHARS + 1)), null);
assert.equal(api.editBranchTitle('Kaynak sohbet'), 'Kaynak sohbet · düzenleme');
assert.equal(api.normalizeHandoff(null), null);

// Mount uses the canonical lifecycle fixture and decorates only a valid user message.
const mounted = fixture();
const controller = api.createController(mounted.options);
assert.equal(controller.mount(), true);
const observer = mounted.messages[api.INSTALL_MARKER] ? true : false;
assert.equal(observer, true, 'mount owns the messages surface');
const button = editButton(mounted.articles[0].article);
assert.ok(button);
assert.equal(button.textContent, 'Düzenle');
assert.equal(button.attributes.get('aria-label'), 'bu mesajdan önceki bağlamı koruyarak yeni düzenleme dalı oluştur');
assert.equal(mounted.articles[0].article.dataset[api.MARKER], '1');
assert.equal(controller.decorate(mounted.articles[0].article), false, 'decoration must be idempotent');

// Editing creates a separate branch, preserves the source, stages a one-shot draft handoff,
// publishes lineage metadata and requests reload. It never submits the composer directly.
assert.equal(controller.editMessage(button, mounted.articles[0].article, mounted.articles[0].content), true);
assert.equal(mounted.composerInput.value, '');
assert.equal(mounted.reloads.length, 1);
assert.equal(button.textContent, 'Düzenleme dalı hazır');
const persisted = JSON.parse(mounted.storage.getItem(api.STORAGE_KEY));
assert.equal(persisted.length, 2);
assert.equal(persisted.some((item) => item.id === 'conversation-source'), true, 'source conversation is retained');
const branch = persisted.find((item) => item.id !== 'conversation-source');
assert.ok(branch?.id);
assert.equal(branch.messages.length, 2, 'branch keeps only context before the edited user message');
const handoff = JSON.parse(mounted.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY));
assert.equal(handoff.conversationId, branch.id);
assert.equal(handoff.text, 'Düzenlenecek soru');
assert.equal(mounted.events.length, 1);
assert.deepEqual(mounted.events[0].detail, {
  childConversationId: branch.id,
  parentConversationId: 'conversation-source',
  sourceMessageId: 'msg-user-2',
  mode: 'edit',
  createdAt: '2026-08-21T03:10:00.000Z'
});

// A non-empty unsent draft is fail-closed and is never silently overwritten.
const draftCase = fixture();
const draftController = api.createController(draftCase.options);
assert.equal(draftController.mount(), true);
const draftButton = editButton(draftCase.articles[0].article);
draftCase.composerInput.value = 'Korunacak taslak';
assert.equal(draftController.editMessage(draftButton, draftCase.articles[0].article, draftCase.articles[0].content), false);
assert.equal(draftCase.composerInput.value, 'Korunacak taslak');
assert.equal(draftCase.composerInput.focused, true);
assert.equal(draftButton.textContent, 'Taslak korunuyor');
assert.equal(draftCase.storage.writes.length, 0);
assert.equal(draftCase.handoffStorage.getItem(api.DRAFT_HANDOFF_KEY), null);

// Active generation blocks edit branch creation before any persistent write.
const streamingCase = fixture();
const streamingController = api.createController(streamingCase.options);
assert.equal(streamingController.mount(), true);
const streamingButton = editButton(streamingCase.articles[0].article);
streamingCase.send.classList.add('streaming');
assert.equal(streamingController.editMessage(streamingButton, streamingCase.articles[0].article, streamingCase.articles[0].content), false);
assert.equal(streamingButton.textContent, 'Yanıt sürüyor');
assert.equal(streamingCase.storage.writes.length, 0);

// Invalid/oversized content and invalid message IDs remain non-mutating.
const invalidCase = fixture();
const invalidController = api.createController(invalidCase.options);
assert.equal(invalidController.mount(), true);
const invalidButton = editButton(invalidCase.articles[0].article);
const oversized = new FakeElement('div');
oversized.textContent = 'x'.repeat(api.MAX_COMPOSER_CHARS + 1);
assert.equal(invalidController.editMessage(invalidButton, invalidCase.articles[0].article, oversized), false);
assert.equal(invalidCase.storage.writes.length, 0);

// If message-copy actions arrive late, observer-compatible decoration reuses that action row
// rather than creating a parallel surface.
const lateCase = fixture({ articleCount: 0 });
const lateController = api.createController(lateCase.options);
assert.equal(lateController.mount(), true);
const lateArticle = new FakeElement('article', ['message', 'user']);
lateArticle.dataset.messageId = 'msg-user-2';
const lateContent = new FakeElement('div', ['content']);
lateContent.textContent = 'Geç yüklenen';
lateArticle.append(lateContent);
lateCase.messages.append(lateArticle);
assert.equal(lateController.decorate(lateArticle), false);
const lateActions = new FakeElement('div', ['message-copy-actions']);
lateArticle.append(lateActions);
assert.equal(lateController.decorate(lateArticle), true);
assert.equal(editButton(lateArticle).textContent, 'Düzenle');

assert.equal(controller.destroy(), true);
assert.equal(controller.getState().destroyed, true);
assert.equal(controller.getState().decorations, 0);

const paths = ['../public/message-edit.js', '../public/chat-run-controller.js', '../public/sw-policy.js']
  .map((p) => fileURLToPath(new URL(p, import.meta.url)));
const [source, loader, sw] = await Promise.all(paths.map((p) => readFile(p, 'utf8')));
for (const forbidden of ['fetch(', 'WebSocket', 'clipboard', 'Authorization', 'Bearer ', 'innerHTML', 'requestSubmit(']) {
  assert.equal(source.includes(forbidden), false, `message edit source must not contain ${forbidden}`);
}
assert.equal(source.includes("storage = globalThis.localStorage"), true, 'persistent conversation storage is an explicit dependency');
assert.equal(source.includes("handoffStorage = globalThis.sessionStorage"), true, 'draft handoff storage is an explicit dependency');
assert.equal(source.includes("documentRef.querySelector('#messageInput')"), true);
assert.equal(source.includes("classList?.contains('streaming')"), true);
assert.equal(source.includes('MAX_COMPOSER_CHARS = 12_000'), true);
assert.equal(source.includes('MAX_HANDOFF_AGE_MS = 90_000'), true);
assert.equal(loader.includes("'/message-edit.js'"), true);
assert.equal(loader.includes('data-hafize-message-edit'), true);
assert.equal(/const CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`;/.test(sw), true, 'service-worker cache remains explicitly versioned');
assert.equal(sw.includes("'/message-edit.js'"), true);
assert.equal(sw.includes("pathname.startsWith('/api/')"), true);

console.log('safe message edit branch tests passed');
