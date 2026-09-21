import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function load(file, sandbox) { vm.runInNewContext(fs.readFileSync(file,'utf8'), sandbox, { filename:file }); }
const sandbox={console};
sandbox.globalThis=sandbox;
load('public/composer-attachments-policy.js',sandbox);
load('public/composer-attachments-secret-scan.js',sandbox);
const p=sandbox.HafizeComposerAttachmentPolicy;
const s=sandbox.HafizeComposerSecretScanner;

assert.equal(p.safeName('/tmp/<x>.ts'),'_tmp_<x>.ts');
assert.equal(p.safeName('\u0000\u0001abc.ts'),'abc.ts');
assert.equal(p.extensionOf('sample.JSON'),'json');
assert.equal(p.languageOf('sample.JSON'),'json');
assert.equal(p.languageOf('sample.bin'),'text');

const body='line1\nline2\nline3\nline4\nline5';
assert.equal(p.lineCount(body),5);
assert.equal(p.sliceLines(body,1,2),'line1\nline2');
assert.equal(p.sliceLines(body,4,999),'line4\nline5');
assert.equal(p.sliceLines(body,0,1),'line1');
assert.equal(p.sliceLines(body,-10,1),'line1');

const item={name:'file.py',content:body,startLine:2,endLine:4};
const rangePayload=p.formatRangeForComposer(item,2,4);
assert.ok(rangePayload.includes('line2'));
assert.ok(rangePayload.includes('line4'));
assert.ok(!rangePayload.includes('line1'));
assert.match(rangePayload,/python/);

const markdown={name:'x.md',content:'alpha\n```\nbeta',startLine:1,endLine:3};
assert.ok(p.formatRangeForComposer(markdown,1,3).startsWith('\n\n[Dosya: x.md'));
assert.ok(p.formatRangeForComposer(markdown,1,3).includes('````markdown'));

const clean=p.binaryScore('normal UTF-8 text with tabs\tand newlines\n');
assert.equal(clean,0);
const binary=p.binaryScore('abc\u0000def\u0001ghi');
assert.ok(binary>0);

assert.equal(s.scan('').risky,false);
assert.equal(s.scan('read api_key documentation').risky,false);
assert.equal(s.scan('client_secret = "abcdefghijklmnop"').risky,true);
assert.equal(s.scan('access_token: abcdefghijklmnop').risky,true);
assert.equal(s.scan('-----BEGIN PRIVATE KEY-----\nabc').risky,true);
assert.equal(s.scan('gho_12345678901234567890').risky,true);
assert.equal(s.scan('sk-12345678901234567890').risky,true);
assert.equal(s.scan('AKIA1234567890ABCDEF').risky,true);
assert.equal(s.scan('AIza1234567890abcdefghijkl').risky,true);
assert.equal(s.scan('xoxb-123456789012345678901').risky,true);
assert.equal(s.scan('eyJheaderheader.aaaaaaaaaa.bbbbbbbbbb').risky,true);

const summary=s.summary(s.scan('-----BEGIN PRIVATE KEY-----'));
assert.match(summary,/Private key/);
assert.ok(summary.length<240);

const long='x'.repeat(100000);
const longResult=s.scan(long);
assert.equal(longResult.scannedChars,80000);

const repeated='x'.repeat(1000);
assert.equal(p.normalizeContent(repeated).length,1000);
assert.ok(p.formatRangeForComposer({name:'x.txt',content:repeated},1,1).length<12000);

console.log('composer attachment deep VM behavior: ok');