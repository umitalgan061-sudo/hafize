import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const card = require('../public/schedule-runtime-card.js');
const sw = require('../public/sw-policy.js');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

class FakeNode {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase(); this.id = id; this.className = ''; this.children = [];
    this.attributes = new Map(); this.listeners = new Map(); this.textContent = ''; this.disabled = false;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = [...nodes]; }
  addEventListener(type, handler) { const set = this.listeners.get(type) || new Set(); set.add(handler); this.listeners.set(type, set); }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, event = {}) { for (const handler of [...(this.listeners.get(type) || [])]) handler({ preventDefault() {}, ...event }); }
  get text() { return [this.textContent, ...this.children.map((child) => child.text)].filter(Boolean).join(' '); }
}

function host() {
  const nodes = {
    card: new FakeNode('section', 'scheduleRuntimeCard'),
    state: new FakeNode('p', 'scheduleRuntimeState'),
    list: new FakeNode('ul', 'scheduleRuntimeSignals'),
    refresh: new FakeNode('button', 'scheduleRuntimeRefresh')
  };
  const documentRef = {
    createElement: (tag) => new FakeNode(tag),
    getElementById: (id) => Object.values(nodes).find((node) => node.id === id) || null
  };
  return { nodes, documentRef, rootRef: new FakeNode('window') };
}

const healthResponse = (payload, { ok = true } = {}) => ({ ok, json: async () => payload });

// 1. Sağlıklı yanıt: yalnız boolean bayraklar okunur ve durum "armed" olur.
const armed = card.normalizeHealth({
  scheduleWorkerConfigured: true,
  scheduleStorageDurable: true,
  scheduleLeaseConfigured: true,
  scheduleApiConfigured: true,
  nvidiaConfigured: true
});
assert.equal(armed.state, 'armed');
assert.equal(armed.signals.length, card.SIGNALS.length);
assert.ok(Object.isFrozen(armed) && Object.isFrozen(armed.signals));
assert.deepEqual(armed.signals.map((signal) => signal.ready), [true, true, true, true]);

// 2. Motor açık ama dayanıklılık eksikse durum "partial", motor kapalıysa "offline".
assert.equal(card.normalizeHealth({ scheduleWorkerConfigured: true }).state, 'partial');
assert.equal(card.normalizeHealth({ scheduleStorageDurable: true }).state, 'offline');

// 3. Geçersiz/eksik gövde fail-closed: her sinyal "eksik", durum "unknown".
for (const payload of [null, undefined, 'ok', [], 42]) {
  const view = card.normalizeHealth(payload);
  assert.equal(view.state, 'unknown');
  assert.equal(view.signals.every((signal) => signal.ready === false), true);
}

// 4. Truthy ama boolean olmayan değerler hazır sayılmaz.
assert.equal(card.normalizeHealth({ scheduleWorkerConfigured: 'true' }).state, 'offline');
assert.equal(card.normalizeHealth({ scheduleWorkerConfigured: 1 }).state, 'offline');

// 5. Mount ağ isteği yapmaz; yalnız görev çalışma alanı açıldığında yükler.
{
  const h = host();
  const calls = [];
  const controller = card.createController({
    documentRef: h.documentRef,
    rootRef: h.rootRef,
    fetchImpl: async (path, options) => {
      calls.push({ path, options });
      return healthResponse({ scheduleWorkerConfigured: true, scheduleStorageDurable: true });
    }
  });
  assert.equal(controller.mount(), true);
  assert.equal(calls.length, 0);
  assert.equal(h.nodes.state.getAttribute('data-state'), 'unknown');
  assert.equal(h.nodes.list.children.length, card.SIGNALS.length);

  h.rootRef.dispatch(card.WORKSPACE_EVENT, { detail: { workspace: 'connections' } });
  assert.equal(calls.length, 0, 'yalnız görev çalışma alanı durum ister');

  h.rootRef.dispatch(card.WORKSPACE_EVENT, { detail: { workspace: 'tasks' } });
  await controller.refresh();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, card.HEALTH_PATH);
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.equal(controller.getView().state, 'partial');
  assert.equal(h.nodes.card.getAttribute('data-state'), 'partial');
  assert.equal(h.nodes.card.getAttribute('aria-busy'), 'false');
  assert.equal(h.nodes.refresh.disabled, false);
  assert.match(h.nodes.list.text, /Görev motoru: hazır/);
  assert.match(h.nodes.list.text, /Çift çalıştırma kilidi: eksik/);

  // Soğuma penceresi içinde tekrar istenmez; düğme zorlayarak yeniler.
  await controller.refresh();
  assert.equal(calls.length, 1);
  h.nodes.refresh.dispatch('click');
  await controller.refresh();
  assert.equal(calls.length, 2);

  assert.equal(controller.destroy(), true);
  h.nodes.refresh.dispatch('click');
  h.rootRef.dispatch(card.WORKSPACE_EVENT, { detail: { workspace: 'tasks' } });
  assert.equal(calls.length, 2, 'destroy sonrası dinleyici kalmaz');
}

// 6. Hata yolu: fetch reddederse veya gövde bozuksa kart sessizce "unknown" gösterir.
for (const fetchImpl of [
  async () => { throw new Error('NETWORK'); },
  async () => healthResponse({ scheduleWorkerConfigured: true }, { ok: false }),
  async () => ({ ok: true })
]) {
  const h = host();
  const controller = card.createController({ documentRef: h.documentRef, rootRef: h.rootRef, fetchImpl });
  controller.mount();
  await controller.refresh({ force: true });
  assert.equal(controller.getView().state, 'unknown');
  assert.equal(h.nodes.refresh.disabled, false);
}

// 7. Yanıt gövdesindeki serbest metin alanları arayüze taşınmaz.
{
  const h = host();
  const controller = card.createController({
    documentRef: h.documentRef,
    rootRef: h.rootRef,
    fetchImpl: async () => healthResponse({
      scheduleWorkerConfigured: true,
      scheduleModel: 'nvidia/secret-model',
      scheduleAuthSubject: 'worker@example.com'
    })
  });
  controller.mount();
  await controller.refresh({ force: true });
  const rendered = `${h.nodes.state.text} ${h.nodes.list.text}`;
  assert.equal(rendered.includes('nvidia/secret-model'), false);
  assert.equal(rendered.includes('worker@example.com'), false);
}

// 8. Eksik DOM ana makinesi fail-closed; mount() sessizce null döner.
assert.throws(
  () => card.createController({ documentRef: { createElement: () => new FakeNode(), getElementById: () => null } }),
  /SCHEDULE_RUNTIME_CARD_HOST_UNAVAILABLE/
);
assert.throws(() => card.createController({ documentRef: {} }), /INVALID_SCHEDULE_RUNTIME_CARD_DOCUMENT/);
assert.equal(card.mount({ createElement: () => new FakeNode(), getElementById: () => null }, new FakeNode()), null);

// 9. Kabuk ve işaretleme bağlantısı.
const indexSource = await readFile(join(ROOT, 'public', 'index.html'), 'utf8');
for (const id of ['scheduleRuntimeCard', 'scheduleRuntimeState', 'scheduleRuntimeSignals', 'scheduleRuntimeRefresh']) {
  assert.ok(indexSource.includes(`id="${id}"`), `${id} index.html içinde bulunmalıdır`);
}
assert.match(indexSource, /id="scheduleRuntimeCard"[^>]*hidden/);
for (const asset of ['/schedule-runtime-card.js', '/schedule-runtime-card.css']) {
  assert.equal(sw.SHELL_ASSETS.includes(asset), true, `${asset} offline kabuk listesinde olmalıdır`);
}
assert.equal(
  sw.classifyRequest({ url: `https://hafize.example${card.HEALTH_PATH}`, method: 'GET', headers: {}, mode: 'same-origin' }, 'https://hafize.example'),
  'network-only',
  'durum uçları önbelleğe alınmaz'
);

console.log('schedule runtime card OK: boolean-only health projection, lazy tasks-workspace refresh, fail-closed errors, PWA shell wiring');
