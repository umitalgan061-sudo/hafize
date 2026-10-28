#!/usr/bin/env node
// Skill SDK command line.
//   node scripts/hafize-skill.mjs new <ad>                       iskelet: skills/user/<ad>.json + <ad>.js
//   node scripts/hafize-skill.mjs test <ad> [--args '{"x":1}']   manifest doğrulama + sandbox çalıştırma + dönüş şeması
//   node scripts/hafize-skill.mjs keygen [--out skills/keys]     Ed25519 imza anahtarı üretir (özel anahtar sende kalır)
//   node scripts/hafize-skill.mjs pack <ad> --version 1.0.0 [--key özel.pem] [--out dosya]   paketler (ve imzalar)
//   node scripts/hafize-skill.mjs verify <paket.json>            imzayı skills/trusted-keys ile doğrular
//   node scripts/hafize-skill.mjs install <paket.json>           doğrula + kur + sağlık denetimi (başarısızsa geri al)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeSkillManifest } from '../lib/skills-manifest.ts';
import { createSandboxRunner } from '../lib/sandbox-runner.ts';
import { testSkill, packSkill } from '../lib/skill-sdk.ts';
import { generateSigningKeys, installBundle, loadTrustedKeys, signBundle, verifyBundle } from '../lib/skill-bundles.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const USER_DIR = join(ROOT, 'skills', 'user');
const TRUSTED = join(ROOT, 'skills', 'trusted-keys');
const argv = process.argv.slice(2);
const positional = argv.filter((item, index) => !item.startsWith('--') && !argv[index - 1]?.startsWith('--'));
const [command, name] = positional;
const option = (flag, fallback = '') => { const index = argv.indexOf(flag); return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback; };
const fail = (message) => { console.error(`✗ ${message}`); process.exit(1); };

function loadSkill(skillName) {
  const manifestFile = join(USER_DIR, `${skillName}.json`);
  if (!existsSync(manifestFile)) fail(`${manifestFile} bulunamadı (önce: new ${skillName})`);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  const codeFile = manifest.handler?.type === 'sandbox' ? join(USER_DIR, manifest.handler.file) : '';
  return { manifest, code: codeFile && existsSync(codeFile) ? readFileSync(codeFile, 'utf8') : '' };
}

if (command === 'new') {
  if (!/^[a-z][a-z0-9-]{1,63}$/.test(name || '')) fail('ad küçük harf, rakam ve tire olmalı (örn. kdv-hesapla)');
  mkdirSync(USER_DIR, { recursive: true });
  const manifest = {
    name,
    description: 'Bu becerinin ne yaptığını tek cümleyle yaz.',
    triggers: [name.replace(/-/g, ' ')],
    allowedTools: ['code.run'],
    parameters: { type: 'object', properties: { text: { type: 'string', maxLength: 4000 } }, required: ['text'], additionalProperties: false },
    returns: { type: 'object', properties: { result: { type: 'string' } }, required: ['result'] },
    sideEffects: { idempotent: true, mutates: false, external: false },
    riskLevel: 'low',
    handler: { type: 'sandbox', file: `${name}.js`, network: false, timeoutMs: 5000 },
    execution: 'inline',
    prompt: 'Becerinin sonucunu kullanıcıya açıkla.'
  };
  const files = [[`${name}.json`, JSON.stringify(manifest, null, 2) + '\n'], [`${name}.js`, '// `input.args` beceri argümanlarıdır; sonucu return et. Ağ ve dosya erişimi yoktur.\nconst { text } = input.args;\nreturn { result: text.toLocaleUpperCase(\'tr\') };\n']];
  for (const [file, content] of files) {
    if (existsSync(join(USER_DIR, file))) fail(`${file} zaten var`);
    writeFileSync(join(USER_DIR, file), content);
  }
  console.log(`✓ skills/user/${name}.json ve ${name}.js oluşturuldu. Deneme: node scripts/hafize-skill.mjs test ${name} --args '{"text":"merhaba"}'`);
} else if (command === 'test') {
  const skill = loadSkill(name);
  try { normalizeSkillManifest(skill.manifest); } catch (error) { fail(`manifest geçersiz: ${error.code || error.message}`); }
  const args = JSON.parse(option('--args', '{}'));
  const result = await testSkill(skill, args, createSandboxRunner());
  for (const line of result.logs || []) console.log(`  log: ${line}`);
  if (!result.ok) fail(`çalışma başarısız: ${result.error || result.schemaErrors.join('; ')}`);
  console.log(`✓ ${name} çalıştı (${result.durationMs} ms):`, JSON.stringify(result.result));
} else if (command === 'keygen') {
  const out = resolve(option('--out', join(ROOT, 'skills', 'keys')));
  mkdirSync(out, { recursive: true });
  mkdirSync(TRUSTED, { recursive: true });
  const keys = generateSigningKeys();
  writeFileSync(join(out, `${keys.keyId}.private.pem`), keys.privateKeyPem, { mode: 0o600 });
  writeFileSync(join(TRUSTED, `${keys.keyId}.pub`), keys.publicKeyPem);
  console.log(`✓ Anahtar ${keys.keyId}: özel anahtar ${join(out, `${keys.keyId}.private.pem`)} (paylaşma!), açık anahtar skills/trusted-keys/ altına eklendi.`);
} else if (command === 'pack') {
  const skill = loadSkill(name);
  normalizeSkillManifest(skill.manifest);
  const version = option('--version');
  if (!/^\d+\.\d+\.\d+/.test(version)) fail('--version 1.0.0 biçiminde olmalı');
  let bundle = packSkill(skill, version, JSON.parse(option('--health-args', '{}')));
  const key = option('--key');
  if (key) bundle = signBundle(bundle, readFileSync(resolve(key), 'utf8'));
  const out = resolve(option('--out', join(ROOT, 'skills', 'dist', `${name}-${version}.bundle.json`)));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(bundle, null, 2));
  console.log(`✓ ${out}${key ? ` (imzalı, anahtar ${bundle.keyId})` : ' (imzasız — kurulum için --key ile imzala)'}`);
} else if (command === 'verify') {
  const bundle = JSON.parse(readFileSync(resolve(name), 'utf8'));
  try { verifyBundle(bundle, loadTrustedKeys(TRUSTED)); } catch (error) { fail(error.code || error.message); }
  console.log(`✓ ${bundle.name}@${bundle.version} imzası geçerli (anahtar ${bundle.keyId}).`);
} else if (command === 'install') {
  const bundle = JSON.parse(readFileSync(resolve(name), 'utf8'));
  try {
    const result = await installBundle({ raw: bundle, trustedKeys: loadTrustedKeys(TRUSTED), dir: USER_DIR, sandbox: createSandboxRunner() });
    console.log(`✓ ${result.name}@${result.version} kuruldu${result.previousVersion ? ` (önceki: ${result.previousVersion})` : ''}. Sunucuyu yeniden başlat ya da /api/skills/bundles ile canlı kur.`);
  } catch (error) { fail(`${error.code || error.message}${error.detail ? ` — ${error.detail}` : ''} (değişiklik geri alındı)`); }
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 9).map((line) => line.replace(/^\/\/ ?/, '')).join('\n'));
}
