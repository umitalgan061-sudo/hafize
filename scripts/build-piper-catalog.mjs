// Regenerates public/piper-voices.json from Piper's voices.json:
//   curl -sL https://huggingface.co/rhasspy/piper-voices/raw/main/voices.json -o voices.json
//   node scripts/build-piper-catalog.mjs voices.json
// Each voice's small config is read too: voices that need a phonemizer other than espeak (Chinese,
// Japanese, Hebrew, Thai, ...) cannot run on the bundled phonemizer, so they are left out.
import { readFileSync, writeFileSync } from 'node:fs';

const BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/';
const source = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const entries = Object.values(source).map((voice) => {
  const [path, file] = Object.entries(voice.files).find(([name]) => name.endsWith('.onnx'));
  const config = Object.entries(voice.files).find(([name]) => name.endsWith('.onnx.json'))[1];
  return {
    key: voice.key,
    name: voice.name,
    lang: voice.language.code,
    family: voice.language.family,
    langName: voice.language.name_native,
    country: voice.language.country_english,
    quality: voice.quality,
    speakers: voice.num_speakers,
    size: file.size_bytes + config.size_bytes,
    path
  };
});

const skipped = [];
const usable = [];
let next = 0;
await Promise.all(Array.from({ length: 12 }, async () => {
  while (next < entries.length) {
    const entry = entries[next++];
    const config = await (await fetch(`${BASE}${entry.path}.json`)).json();
    const type = config.phoneme_type ?? 'espeak';
    if (type === 'espeak') usable.push(entry); else skipped.push(`${entry.key} (${type})`);
  }
}));

// Community voices missing from the official repository. Pinned to a commit so a later upload can
// never change what a user downloads. Repositories that require a login and owner approval are
// out of reach for a browser download and are not listed.
const COMMUNITY = [
  { key: 'tr_TR-fahrettin-medium', name: 'fahrettin', repo: 'speaches-ai/piper-tr_TR-fahrettin-medium', sha: 'aab8f92429ede58091e17de506484a2c84384792', source: 'speaches-ai' },
  { key: 'tr_TR-fettah-medium', name: 'fettah', repo: 'speaches-ai/piper-tr_TR-fettah-medium', sha: '82c920ee9a5f2c487f38aa2d5a77965acc1a868f', source: 'speaches-ai' },
  { key: 'tr_TR-99eren99-medium', name: '99eren99', repo: '99eren99/piper-turkish-tts', sha: '885d69c91c4a83f49467f152690460e26b818d0b', source: '99eren99' },
  { key: 'tr_TR-antalia-medium', name: 'antalia', repo: 'ozgurguler/piper-tr-antalia-medium', sha: '22b2a016887632416c2a5fb2de515c3957077e47', model: 'tr_TR-antalia-medium.onnx', config: 'tr_TR-antalia-medium.onnx.json', source: 'ozgurguler', license: 'CC BY 4.0' },
  { key: 'tr_TR-ilkiz-medium', name: 'ilkiz', repo: 'ilkeraktuna/piper-tts-tr-ilkiz-medium', sha: 'ecf42bcc271974d000542f5868d81bbcf4e4ec0f', model: 'ilkiz.onnx', config: 'ilkiz.onnx.json', source: 'ilkeraktuna', license: 'MIT' },
  { key: 'tr_TR-99eren99_hafif-medium', name: '99eren99 hafif', repo: 'okasi/piper-turkish-99eren99-voice-0-onnx-q8', sha: '0d6d450031f9307f5e4357975629a1068a94285', model: 'tr-99eren99-voice-0-q8.onnx', config: 'tr-99eren99-voice-0-q8.onnx.json', source: 'okasi' }
];
for (const voice of COMMUNITY) {
  const tree = await (await fetch(`https://huggingface.co/api/models/${voice.repo}/tree/${voice.sha}`)).json();
  const size = (name) => tree.find((file) => file.path === name).size;
  const root = `https://huggingface.co/${voice.repo}/resolve/${voice.sha}/`;
  const config = await (await fetch(`${root}${voice.config ?? 'config.json'}`)).json();
  if ((config.phoneme_type ?? 'espeak') !== 'espeak') throw new Error(`${voice.key}: unsupported phonemes`);
  usable.push({
    key: voice.key, name: voice.name, lang: 'tr_TR', family: 'tr', langName: 'Türkçe', country: 'Turkey',
    quality: config.audio?.quality ?? 'medium', speakers: config.num_speakers ?? 1,
    size: size(voice.model ?? 'model.onnx') + size(voice.config ?? 'config.json'), path: `${voice.repo}/${voice.model ?? 'model.onnx'}`,
    url: `${root}${voice.model ?? 'model.onnx'}`, configUrl: `${root}${voice.config ?? 'config.json'}`, source: voice.source, ...(voice.license ? { license: voice.license } : {})
  });
}
usable.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name) || a.size - b.size);
writeFileSync('public/piper-voices.json', `${JSON.stringify({ source: 'rhasspy/piper-voices', voices: usable })}\n`);
console.log(`${usable.length} voices, left out ${skipped.length}: ${skipped.join(', ')}`);
