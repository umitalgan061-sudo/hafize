// Measures every chat model this NVIDIA key can actually call: is it reachable, how fast does the
// first word arrive, how fast is it overall, can it call tools. Prints a table and a suggested
// HAFIZE_MODEL_CHAIN. Reads .env itself and prints no secret. Run with: node scripts/rank-models.mjs
import { existsSync, readFileSync } from 'node:fs';

const envFile = new URL('../.env', import.meta.url);
const env = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/).filter((line) => /^[A-Z0-9_]+=/.test(line)).map((line) => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; })) : {};
const key = process.env.NVIDIA_API_KEY || env.NVIDIA_API_KEY;
const base = (process.env.NIM_BASE_URL || env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, '');
if (!key) { console.error('NVIDIA_API_KEY yok'); process.exit(1); }

const TIMEOUT_MS = 30_000;
const GAP_MS = 1_600; // stays under the free tier's 40 requests a minute
const NOT_CHAT = /embed|rerank|safety|guard|clip|flux|stable-?diffusion|sdxl|image|video|whisper|parakeet|tts|asr|riva|vl-|vision|vlm|deplot|kosmos|neva|paligemma|ocr|nemoretriever|retriev|cosmos|edify|bge|arctic-embed|genmol|molmim|esm|alphafold|diffdock|proteinmpnn|rfdiffusion|evo2|usdcode|usdsearch|usdvalidate|fourcastnet|corrdiff|parse|table|translate|calibration/i;
const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const thinkingOff = (model) => (/nemotron/i.test(model) ? { chat_template_kwargs: { enable_thinking: false } } : {});

async function speed(model) {
  const started = Date.now();
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers, signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ model, stream: true, max_tokens: 400, temperature: 0.2, messages: [{ role: 'user', content: 'Türkiye’nin başkenti neresidir? Tek kısa cümleyle Türkçe yanıtla.' }] })
  });
  if (!response.ok) return { status: response.status };
  let first = 0;
  let text = '';
  let buffer = '';
  const decoder = new TextDecoder();
  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
        if (delta) { if (!first) first = Date.now() - started; text += delta; }
      } catch { /* partial line */ }
    }
  }
  return { status: 200, firstMs: first, totalMs: Date.now() - started, turkish: /Ankara/i.test(text) };
}

async function tools(model) {
  const response = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers, signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model, stream: false, max_tokens: 400, temperature: 0, ...thinkingOff(model),
      tools: [{ type: 'function', function: { name: 'saat_kac', description: 'Şu anki saati döndürür.', parameters: { type: 'object', properties: {} } } }],
      messages: [{ role: 'user', content: 'Saat kaç? saat_kac aracını kullan.' }]
    })
  });
  if (!response.ok) return false;
  const data = await response.json();
  return Boolean(data.choices?.[0]?.message?.tool_calls?.length);
}

const listed = await fetch(`${base}/models`, { headers }).then((response) => response.json());
const ids = (listed.data ?? []).map((model) => model.id).filter((id) => !NOT_CHAT.test(id)).sort();
console.error(`${listed.data?.length ?? 0} model listeleniyor, ${ids.length} sohbet adayı ölçülüyor...`);

const rows = [];
for (const model of ids) {
  let row = { model };
  try {
    row = { ...row, ...(await speed(model)) };
    if (row.status === 200) { await sleep(GAP_MS); row.tools = await tools(model).catch(() => false); }
  } catch (error) { row.status = error?.name === 'TimeoutError' ? 'zaman aşımı' : 'hata'; }
  rows.push(row);
  console.error(`${model}: ${row.status}${row.firstMs ? ` ilk kelime ${row.firstMs}ms toplam ${row.totalMs}ms araç:${row.tools}` : ''}`);
  await sleep(GAP_MS);
}
const usable = rows.filter((row) => row.status === 200 && row.firstMs && row.turkish).sort((a, b) => a.firstMs - b.firstMs);
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), usable, unavailable: rows.filter((row) => !usable.includes(row)).map((row) => `${row.model} (${row.status})`) }, null, 1));
console.log(`\nHAFIZE_MODEL_CHAIN=${usable.filter((row) => row.tools).map((row) => row.model).join(',')}`);
