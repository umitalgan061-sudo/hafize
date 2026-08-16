import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/conversation-export.js', import.meta.url), 'utf8');
const module = { exports: {} };
vm.runInNewContext(source, { module, exports: module.exports, globalThis: {}, self: {} });
const api = module.exports;

function classList(...values) {
  const set = new Set(values);
  return { contains(value) { return set.has(value); } };
}

function article(role, content, extras = {}) {
  const contentNode = { textContent: content };
  const toolNode = { textContent: extras.toolText || 'SECRET_TOOL_ACTIVITY' };
  return {
    classList: classList(role, 'message'),
    querySelector(selector) {
      if (selector === '.content') return contentNode;
      if (selector === '.tool-activities') return toolNode;
      return null;
    }
  };
}

function rootFor(items) {
  return {
    querySelectorAll(selector) {
      assert.equal(selector, '.message');
      return items;
    }
  };
}

assert.equal(api.MAX_MESSAGES, 500);
assert.equal(api.MAX_MESSAGE_CHARS, 256 * 1024);
assert.equal(api.MAX_EXPORT_CHARS, 1024 * 1024);
assert.equal(api.MAX_TITLE_CHARS, 80);

assert.equal(api.normalizeText(null), null);
assert.equal(api.normalizeText(undefined), null);
assert.equal(api.normalizeText('a\r\nb\rc'), 'a\nb\nc');
assert.equal(api.normalizeText('a\u0000b'), 'ab');
assert.equal(api.normalizeText(' '.repeat(30)), ' '.repeat(30));
assert.equal(api.normalizeText('x'.repeat(api.MAX_MESSAGE_CHARS)), 'x'.repeat(api.MAX_MESSAGE_CHARS));
assert.equal(api.normalizeText('x'.repeat(api.MAX_MESSAGE_CHARS + 1)), null);

assert.equal(api.normalizeRole('user'), 'user');
assert.equal(api.normalizeRole('assistant'), 'assistant');
assert.equal(api.normalizeRole('system'), null);
assert.equal(api.normalizeRole('tool'), null);
assert.equal(api.normalizeRole(null), null);

assert.equal(api.safeTitle('  Örnek   sohbet  '), 'Örnek sohbet');
assert.equal(api.safeTitle('Başlık\u0000\n devam'), 'Başlık devam');
assert.equal(api.safeTitle(''), 'Hafize sohbeti');
assert.equal(api.safeTitle(null), 'Hafize sohbeti');
assert.equal(api.safeTitle('x'.repeat(120)).length, api.MAX_TITLE_CHARS);

assert.equal(api.filenameStem('Plan: 16/08/2026?'), 'Plan- 16-08-2026-');
assert.equal(api.filenameStem('a\\b/c*d?e"f<g>h|i'), 'a-b-c-d-e-f-g-h-i');
assert.equal(api.filenameStem('Dosya....'), 'Dosya');
assert.equal(api.filenameStem('  '), 'Hafize sohbeti');
assert.ok(!/[\\/:*?"<>|]/.test(api.filenameStem('a/b:c*d?e"f<g>h|i')));

const transcript = api.collectTranscript(rootFor([
  article('user', 'Merhaba', { toolText: 'TOKEN=abc' }),
  article('assistant', 'Merhaba Ümit', { toolText: 'trace-id-private' })
]));
assert.equal(transcript.length, 2);
assert.equal(transcript[0].role, 'user');
assert.equal(transcript[0].content, 'Merhaba');
assert.equal(transcript[1].role, 'assistant');
assert.equal(transcript[1].content, 'Merhaba Ümit');
assert.ok(!JSON.stringify(transcript).includes('TOKEN=abc'));
assert.ok(!JSON.stringify(transcript).includes('trace-id-private'));
assert.ok(Object.isFrozen(transcript));
assert.ok(Object.isFrozen(transcript[0]));

const mixed = api.collectTranscript(rootFor([
  article('system', 'gizli sistem'),
  article('user', 'görünür'),
  article('assistant', 'yanıt')
]));
assert.equal(mixed.length, 2);
assert.deepEqual(Array.from(mixed, (entry) => entry.role), ['user', 'assistant']);
assert.equal(api.collectTranscript(null), null);
assert.equal(api.collectTranscript(rootFor([])), null);

const tooMany = Array.from({ length: api.MAX_MESSAGES + 1 }, () => article('user', 'x'));
assert.equal(api.collectTranscript(rootFor(tooMany)), null);

const markdown = api.markdownTranscript('Proje #1', transcript);
assert.equal(markdown, '# Proje \\#1\n\n## Sen\n\nMerhaba\n\n## Hafize\n\nMerhaba Ümit\n');
assert.ok(!markdown.includes('TOKEN=abc'));
assert.ok(!markdown.includes('trace-id-private'));

const text = api.plainTextTranscript('Proje #1', transcript);
assert.equal(text, 'Proje #1\n\nSen:\nMerhaba\n\nHafize:\nMerhaba Ümit\n');
assert.ok(!text.includes('TOKEN=abc'));

const mdExport = api.buildExport({ title: 'Plan: Ağustos', transcript, format: 'markdown' });
assert.equal(mdExport.filename, 'Plan- Ağustos.md');
assert.equal(mdExport.type, 'text/markdown;charset=utf-8');
assert.equal(mdExport.content, api.markdownTranscript('Plan: Ağustos', transcript));
assert.ok(Object.isFrozen(mdExport));

const txtExport = api.buildExport({ title: 'Plan: Ağustos', transcript, format: 'text' });
assert.equal(txtExport.filename, 'Plan- Ağustos.txt');
assert.equal(txtExport.type, 'text/plain;charset=utf-8');
assert.equal(txtExport.content, api.plainTextTranscript('Plan: Ağustos', transcript));
assert.equal(api.buildExport({ title: 'Plan', transcript, format: 'pdf' }), null);
assert.equal(api.markdownTranscript('Plan', []), null);
assert.equal(api.plainTextTranscript('Plan', []), null);

const titleDocument = {
  querySelector(selector) {
    assert.equal(selector, '.conversation-row.active .conversation-open');
    return { textContent: '  Aktif sohbet  ' };
  }
};
assert.equal(api.activeTitle(titleDocument), 'Aktif sohbet');
assert.equal(api.activeTitle({ querySelector() { return null; } }), 'Hafize sohbeti');

console.log('conversation export contract ok');
