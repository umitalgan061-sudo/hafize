import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const visual = require('../public/typed/voice-visual.ts');

// Caption: the spoken word sits in the middle of a trimmed window.
assert.deepEqual(visual.captionParts('Merhaba dünya', 8, 5), ['Merhaba ', 'dünya', '']);
assert.deepEqual(visual.captionParts('Kısa metin', -1, 0), ['Kısa metin', '', '']);
assert.deepEqual(visual.captionParts('', 0, 3), ['', '', '']);
const long = `${'a '.repeat(100)}HEDEF${' b'.repeat(100)}`;
const [before, word, after] = visual.captionParts(long, long.indexOf('HEDEF'), 5, 60);
assert.equal(word, 'HEDEF');
assert.ok(before.startsWith('…') && after.endsWith('…'));
assert.ok(before.length + word.length + after.length <= 64);

// Wave: always a visible floor, never above 1, louder with more energy.
const seed = Array.from({ length: 12 }, (_, i) => i / 12);
const quiet = visual.waveHeights(12, 1000, 0, seed);
const loud = visual.waveHeights(12, 1000, 1, seed);
assert.equal(quiet.length, 12);
assert.ok(quiet.every((h) => h >= 0.08 && h <= 0.081));
assert.ok(loud.every((h) => h > 0.08 && h <= 1));
assert.ok(loud[6] > loud[0], 'centre bars are taller than the edges');

// DOM: a tiny fake document that is enough for the panel and the events.
class FakeNode {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.style = { setProperty() {} }; this.listeners = new Map(); this.className = ''; this.textContent = ''; }
  append(...nodes) { this.children.push(...nodes); }
  insertBefore(node) { this.children.unshift(node); }
  get firstChild() { return this.children[0] ?? null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  getAttribute(name) { return this.attrs[name] ?? null; }
  removeAttribute(name) { delete this.attrs[name]; }
  toggleAttribute(name, on) { if (on) this.attrs[name] = ''; else delete this.attrs[name]; }
  querySelector(selector) { return selector === '.voice-visual' ? this.children.find((c) => c.className === 'voice-visual') ?? null : null; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  remove() { this.removed = true; }
  click() { this.clicked = (this.clicked || 0) + 1; }
}
const composer = new FakeNode('form');
const mic = new FakeNode('button');
const listeners = new Map();
const dispatched = [];
const documentRef = {
  documentElement: { dataset: {} },
  querySelector(selector) { return ({ '#composer': composer, '#messageInput': new FakeNode('textarea'), '#micBtn': mic })[selector] || null; },
  createElement(tag) { return new FakeNode(tag); },
  addEventListener(type, fn) { listeners.set(type, fn); },
  removeEventListener(type) { listeners.delete(type); },
  dispatchEvent(event) { dispatched.push(event.type); }
};
const frames = [];
const root = {
  requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
  cancelAnimationFrame() {},
  performance: { now: () => 0 },
  CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  navigator: {}
};
const fire = (type, detail) => listeners.get(type)?.({ detail, preventDefault() {} });

const controller = visual.installVoiceVisual(documentRef, root);
const panel = composer.children[0];
assert.equal(panel.className, 'voice-visual');
assert.equal(controller.state(), 'idle');
assert.equal(visual.installVoiceVisual(documentRef, root), null, 'installs only once per composer');

fire('hafize:voice-output-state', { source: 'voice-output', speaking: true });
assert.equal(controller.state(), 'speaking');
assert.equal(panel.attrs['data-state'], 'speaking');
assert.equal(composer.attrs['data-voice-visual'], '');
assert.ok(frames.length > 0, 'animation loop started');

fire('hafize:voice-output-progress', { source: 'voice-output', text: 'Merhaba dünya', charIndex: 8, charLength: 5 });
const caption = panel.children[0].children[1].children[2];
assert.equal(caption.children[1].textContent, 'dünya');

const stop = panel.children[0].children[2];
stop.listeners.get('click')({ preventDefault() {} });
assert.deepEqual(dispatched, ['hafize:voice-output-stop']);

fire('hafize:voice-input-state', { source: 'voice-input', listening: true });
assert.equal(controller.state(), 'listening', 'listening wins over speaking');
stop.listeners.get('click')({ preventDefault() {} });
assert.equal(mic.clicked, 1, 'stop while listening ends voice input');

fire('hafize:voice-input-state', { source: 'voice-input', listening: false });
fire('hafize:voice-output-state', { source: 'voice-output', speaking: false });
assert.equal(controller.state(), 'idle');
assert.equal(composer.attrs['data-voice-visual'], undefined);

controller.destroy();
assert.equal(panel.removed, true);
assert.equal(listeners.size, 0);

console.log('Voice visual OK: caption window, waveform levels, speaking/listening states, stop routing and cleanup');
