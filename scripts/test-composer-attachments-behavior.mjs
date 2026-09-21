import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const policySource=fs.readFileSync('public/composer-attachments-policy.js','utf8');
const scannerSource=fs.readFileSync('public/composer-attachments-secret-scan.js','utf8');
const sandbox={console};
sandbox.globalThis=sandbox;
vm.runInNewContext(policySource,sandbox,{filename:'composer-attachments-policy.js'});
vm.runInNewContext(scannerSource,sandbox,{filename:'composer-attachments-secret-scan.js'});
const api=sandbox.HafizeComposerAttachmentPolicy;
const scanner=sandbox.HafizeComposerSecretScanner;

assert.ok(api);
assert.ok(scanner);
assert.equal(api.safeName('../secret.js'),'_secret.js');
assert.equal(api.safeName(' folder\\file.ts '),'folder_file.ts');
assert.equal(api.safeName('\0bad\nname.txt'),'badname.txt');
assert.equal(api.extensionOf('main.TS'),'ts');
assert.equal(api.languageOf('main.ts'),'typescript');
assert.equal(api.languageOf('readme.unknown'),'text');

const normalized=api.normalizeContent('\uFEFFone\r\ntwo  \rthree\u0000');
assert.equal(normalized,'\uFEFFone\ntwo\nthree');
assert.equal(api.lineCount('a\nb\nc'),3);
assert.equal(api.sliceLines('a\nb\nc\nd',2,3),'b\nc');
assert.equal(api.sliceLines('a\nb\nc',99,100),'c');
assert.equal(api.previewLines('1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13').length,12);

const item={name:'main.ts',content:'const a=1;\nconst b=2;',startLine:1,endLine:2};
const formatted=api.formatRangeForComposer(item,1,2);
assert.match(formatted,/\[Dosya: main\.ts\]/);
assert.match(formatted,/```typescript/);
assert.match(formatted,/const a=1;/);

const fenced={name:'a.md',content:'before\n```\nafter',startLine:1,endLine:3};
assert.match(api.formatRangeForComposer(fenced,1,3),/````markdown/);

const file={name:'x.txt',size:10,lastModified:7};
assert.deepEqual(api.validateFile(file,[]).ok,true);
assert.equal(api.validateFile({name:'x.exe',size:10,lastModified:7},[]).reason,'type');
assert.equal(api.validateFile({name:'x.txt',size:0,lastModified:7},[]).reason,'empty');
assert.equal(api.validateFile({name:'x.txt',size:262145,lastModified:7},[]).reason,'size');
assert.equal(api.validateFile(file,[{name:'x.txt',size:10,lastModified:7}]).reason,'duplicate');

assert.equal(api.binaryScore('hello world'),0);
assert.ok(api.binaryScore('abc\u0000def')>0);

assert.equal(scanner.scan('hello world').risky,false);
assert.equal(scanner.scan('-----BEGIN PRIVATE KEY-----').risky,true);
assert.equal(scanner.scan('AKIA1234567890ABCDEF').risky,true);
assert.equal(scanner.scan('ghp_123456789012345678901234').risky,true);
assert.equal(scanner.scan('eyJhbGciOiJIUzI1NiJ9.abcabcabc.defdefdef').risky,true);
assert.match(scanner.summary(scanner.scan('-----BEGIN PRIVATE KEY-----')),/Private key/);
assert.ok(scanner.scan('api_key = "short"').risky===false);

console.log('composer attachment behavior: ok');