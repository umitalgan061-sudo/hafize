import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=(file)=>fs.readFileSync(file,'utf8');
const policy=read('public/composer-attachments-policy.js');
const runtime=read('public/composer-attachments.js');
const scanner=read('public/composer-attachments-secret-scan.js');
const index=read('public/index.html');
const sw=read('public/sw-policy.js');

const sandbox={console};
sandbox.globalThis=sandbox;
vm.runInNewContext(policy,sandbox,{filename:'policy.js'});
vm.runInNewContext(scanner,sandbox,{filename:'scanner.js'});
const p=sandbox.HafizeComposerAttachmentPolicy;
const sec=sandbox.HafizeComposerSecretScanner;

assert.equal(p.MAX_FILES,4);
assert.equal(p.MAX_BYTES,256*1024);
assert.equal(p.MAX_RANGE_LINES,400);
assert.equal(p.MAX_INSERT_CHARS,11500);
assert.equal(sec.MAX_MATCHES,12);
assert.equal(sec.MAX_SCAN_CHARS,80000);

assert.equal(p.safeName('../x.ts'),'_x.ts');
assert.equal(p.extensionOf('APP.JS'),'js');
assert.equal(p.languageOf('APP.JS'),'javascript');
assert.equal(p.lineCount('a\nb\nc'),3);
assert.equal(p.sliceLines('a\nb\nc\nd',2,3),'b\nc');
assert.equal(p.sliceLines('a\nb\nc',0,999),'a\nb\nc');
assert.equal(p.normalizeContent('a\r\nb\r c\u0000'),'a\nb\r c');

const base={name:'demo.ts',content:'one\ntwo\nthree\nfour',startLine:2,endLine:3};
const payload=p.formatRangeForComposer(base,2,3);
assert.ok(payload.includes('demo.ts'));
assert.ok(payload.includes('two\nthree'));
assert.ok(payload.includes('typescript'));

const dangerous={name:'demo.md',content:'```\ninside',startLine:1,endLine:2};
assert.ok(p.formatRangeForComposer(dangerous,1,2).includes('````markdown'));

assert.equal(sec.scan('ordinary documentation').risky,false);
assert.equal(sec.scan('-----BEGIN RSA PRIVATE KEY-----').risky,true);
assert.equal(sec.scan('AKIA1234567890ABCDEF').risky,true);
assert.equal(sec.scan('ghp_123456789012345678901234').risky,true);
assert.equal(sec.scan('AIza1234567890abcdefghijkl').risky,true);
assert.equal(sec.scan('xoxb-123456789012345678901').risky,true);
assert.equal(sec.scan('eyJabcdefgh.abcdefghijk.abcdefghijk').risky,true);

assert.ok(index.includes('/composer-attachments-policy.js'));
assert.ok(index.includes('/composer-attachments-secret-scan.js'));
assert.ok(index.includes('/composer-attachments.js'));
assert.ok(index.includes('/composer-attachments.css'));
assert.ok(index.indexOf('/composer-attachments-policy.js')<index.indexOf('/composer-attachments-secret-scan.js'));
assert.ok(index.indexOf('/composer-attachments-secret-scan.js')<index.indexOf('/composer-attachments.js'));

assert.ok(sw.includes('/composer-attachments-policy.js'));
assert.ok(sw.includes('/composer-attachments-secret-scan.js'));
assert.ok(sw.includes('/composer-attachments.js'));
assert.ok(sw.includes('/composer-attachments.css'));
assert.match(sw,/CURRENT_CACHE.*v37/);
assert.match(sw,/pathname\.startsWith\('\/api\/'\)/);

assert.doesNotMatch(runtime,/localStorage|sessionStorage|indexedDB/);
assert.doesNotMatch(runtime,/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon/);
assert.doesNotMatch(runtime,/requestSubmit|\.submit\s*\(/);
assert.doesNotMatch(runtime,/innerHTML|outerHTML/);
assert.match(runtime,/input\.value = before \+ payload \+ after/);
assert.match(runtime,/const onUndo/);
assert.match(runtime,/rootRef\.confirm/);
assert.match(runtime,/quickPrompts/);
assert.match(runtime,/clipboard/);
assert.match(runtime,/dragover/);
assert.match(runtime,/MEMORY_TTL_MS/);

console.log('composer attachment full release gate: ok');