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
usable.sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name) || a.size - b.size);
writeFileSync('public/piper-voices.json', `${JSON.stringify({ source: 'rhasspy/piper-voices', voices: usable })}\n`);
console.log(`${usable.length} voices, left out ${skipped.length}: ${skipped.join(', ')}`);
