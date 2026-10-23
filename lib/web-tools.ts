// Live-information tools for the agent runtime. Fixed upstream hosts are used for search,
// encyclopedia, news and rates; web_page_read is the only tool that follows a model-chosen URL
// and it is restricted to public internet addresses (checked at connect time, on every redirect).
import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import { redactPlaintextCredentials } from './plaintext-credential-policy.ts';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Hafize/0.1';
const API_USER_AGENT = 'Hafize/0.1 (personal assistant)';
const MAX_QUERY = 300;
const MAX_URL = 2048;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_PAGE_TEXT = 12_000;
const MAX_REDIRECTS = 4;

export class WebToolError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = 'WebToolError';
    this.code = code;
    this.status = status;
  }
}

type Json = Record<string, unknown>;
type FetchLike = typeof fetch;

function record(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
}
function only(args: unknown, fields: readonly string[], code: string): Json {
  const source = record(args);
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new WebToolError(code, 400);
  for (const key of Object.keys(source)) if (!fields.includes(key)) throw new WebToolError(code, 400);
  return source;
}
function text(value: unknown, max: number, code: string): string {
  const result = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
  if (!result || result.length > max) throw new WebToolError(code, 400);
  return result;
}
function int(value: unknown, fallback: number, min: number, max: number, code: string): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new WebToolError(code, 400);
  return Number(value);
}

const ENTITIES: Readonly<Record<string, string>> = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', deg: '°', euro: '€' });
export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1] === 'x' || entity[1] === 'X' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}
function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function htmlToText(html: string): { title: string; description: string; text: string } {
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 300);
  const description = decodeEntities(
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1]
    || html.match(/<meta[^>]+property=["']og:description["'][^>]*content=["']([^"']*)["']/i)?.[1]
    || ''
  ).trim().slice(0, 500);
  const main = html.match(/<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i)?.[2] || html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] || html;
  const body = main
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|canvas|form|nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/blockquote|\/pre)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, ' ');
  const lines = decodeEntities(body).split('\n').map((line) => line.replace(/[ \t\f\v ]+/g, ' ').trim()).filter(Boolean);
  return { title, description, text: lines.join('\n') };
}

// --- public-address guard -------------------------------------------------------------
const BLOCKED = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4]
] as const) BLOCKED.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['100::', 64], ['64:ff9b::', 96]
] as const) BLOCKED.addSubnet(network, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return !BLOCKED.check(address, 'ipv4');
  if (family !== 6) return false;
  const mapped = address.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicAddress(mapped[1]);
  if (/^::ffff:/i.test(address)) return false;
  return !BLOCKED.check(address, 'ipv6');
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;
function guardedLookup(hostname: string, options: { all?: boolean }, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, '');
    const list = addresses as LookupAddress[];
    if (!list.length || list.some((entry) => !isPublicAddress(entry.address))) {
      return callback(Object.assign(new Error('WEB_ADDRESS_BLOCKED'), { code: 'WEB_ADDRESS_BLOCKED' }), '');
    }
    if (options?.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new WebToolError('WEB_URL_INVALID', 400); }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new WebToolError('WEB_URL_SCHEME_BLOCKED', 400);
  if (url.username || url.password) throw new WebToolError('WEB_URL_CREDENTIALS_BLOCKED', 400);
  if (url.port && !['80', '443'].includes(url.port)) throw new WebToolError('WEB_URL_PORT_BLOCKED', 400);
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new WebToolError('WEB_ADDRESS_BLOCKED', 403);
  if (net.isIP(host) && !isPublicAddress(host)) throw new WebToolError('WEB_ADDRESS_BLOCKED', 403);
  url.hash = '';
  return url;
}

interface RawResponse { readonly status: number; readonly headers: http.IncomingHttpHeaders; readonly body: Buffer; readonly truncated: boolean }

function requestOnce(url: URL, signal: AbortSignal | undefined): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const request = client.request(url, {
      method: 'GET',
      lookup: guardedLookup as unknown as typeof dnsLookup,
      signal,
      timeout: 15_000,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,application/json;q=0.8,*/*;q=0.3', 'Accept-Language': 'tr,en;q=0.8', 'Accept-Encoding': 'gzip, deflate, br' }
    }, (response) => {
      const encoding = String(response.headers['content-encoding'] || '').toLowerCase();
      const stream = encoding === 'gzip' ? response.pipe(zlib.createGunzip())
        : encoding === 'deflate' ? response.pipe(zlib.createInflate())
          : encoding === 'br' ? response.pipe(zlib.createBrotliDecompress())
            : response;
      const chunks: Buffer[] = [];
      let size = 0;
      let truncated = false;
      const finish = () => resolve({ status: response.statusCode || 0, headers: response.headers, body: Buffer.concat(chunks), truncated });
      stream.on('data', (chunk: Buffer) => {
        if (truncated) return;
        size += chunk.length;
        if (size > MAX_PAGE_BYTES) {
          chunks.push(chunk.subarray(0, chunk.length - (size - MAX_PAGE_BYTES)));
          truncated = true;
          response.destroy();
          finish();
          return;
        }
        chunks.push(chunk);
      });
      stream.on('end', () => { if (!truncated) finish(); });
      stream.on('error', (error) => { if (!truncated) reject(error); });
    });
    request.on('timeout', () => request.destroy(Object.assign(new Error('WEB_TIMEOUT'), { code: 'WEB_TIMEOUT' })));
    request.on('error', reject);
    request.end();
  });
}

function decodeBody(body: Buffer, contentType: string): string {
  const charset = contentType.match(/charset=([\w-]+)/i)?.[1] || body.subarray(0, 2048).toString('latin1').match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1] || 'utf-8';
  try { return new TextDecoder(charset.toLowerCase(), { fatal: false }).decode(body); } catch { return new TextDecoder('utf-8').decode(body); }
}

export async function fetchPublicPage(rawUrl: string, signal?: AbortSignal): Promise<{ url: string; contentType: string; body: string; truncated: boolean }> {
  let url = parsePublicUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let response: RawResponse;
    try {
      response = await requestOnce(url, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      const code = (error as { code?: string })?.code;
      if (code === 'WEB_ADDRESS_BLOCKED') throw new WebToolError('WEB_ADDRESS_BLOCKED', 403);
      if (code === 'WEB_TIMEOUT') throw new WebToolError('WEB_TIMEOUT', 504);
      throw new WebToolError('WEB_FETCH_FAILED', 502);
    }
    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      url = parsePublicUrl(new URL(String(response.headers.location), url).toString());
      continue;
    }
    if (response.status >= 400) throw new WebToolError(response.status === 404 ? 'WEB_PAGE_NOT_FOUND' : 'WEB_PAGE_UNAVAILABLE', response.status === 404 ? 404 : 502);
    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (contentType && !/text\/|application\/(xhtml\+xml|json|xml|rss\+xml|atom\+xml)/.test(contentType)) throw new WebToolError('WEB_CONTENT_UNSUPPORTED', 415);
    return { url: url.toString(), contentType, body: decodeBody(response.body, contentType), truncated: response.truncated };
  }
  throw new WebToolError('WEB_TOO_MANY_REDIRECTS', 508);
}

// --- fixed-host JSON/text helpers ---------------------------------------------------
async function getText(fetchImpl: FetchLike, url: string, signal: AbortSignal | undefined, init: RequestInit = {}): Promise<string> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, signal, headers: { 'User-Agent': API_USER_AGENT, ...(init.headers as Record<string, string> || {}) } });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new WebToolError('WEB_SERVICE_UNAVAILABLE', 502);
  }
  if (!response.ok) throw new WebToolError(response.status === 429 ? 'WEB_SERVICE_RATE_LIMITED' : 'WEB_SERVICE_UNAVAILABLE', response.status === 429 ? 429 : 502);
  return response.text();
}
async function getJson(fetchImpl: FetchLike, url: string, signal: AbortSignal | undefined, init: RequestInit = {}): Promise<Json> {
  try { return record(JSON.parse(await getText(fetchImpl, url, signal, init))); } catch (error) {
    if (error instanceof WebToolError || signal?.aborted) throw error;
    throw new WebToolError('WEB_SERVICE_UNAVAILABLE', 502);
  }
}

// --- web_search ----------------------------------------------------------------------
export interface SearchResult { readonly title: string; readonly url: string; readonly snippet: string }

function ddgTarget(href: string): string {
  const raw = decodeEntities(href);
  const absolute = raw.startsWith('//') ? 'https:' + raw : raw;
  try {
    const url = new URL(absolute, 'https://duckduckgo.com');
    if (url.hostname.endsWith('duckduckgo.com') && url.pathname === '/l/') return url.searchParams.get('uddg') || '';
    return url.toString();
  } catch { return ''; }
}

export function parseDuckDuckGoHtml(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  const blocks = html.split(/<div class="result results_links/).slice(1);
  for (const block of blocks) {
    if (/result--ad/.test(block.slice(0, 200))) continue;
    const link = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!link) continue;
    const url = ddgTarget(link[1]);
    if (!/^https?:\/\//.test(url)) continue;
    const snippet = stripTags(block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)?.[1] || '');
    results.push({ title: stripTags(link[2]).slice(0, 200), url: url.slice(0, MAX_URL), snippet: snippet.slice(0, 400) });
    if (results.length >= limit) break;
  }
  return results;
}

export interface WebToolsOptions {
  readonly fetchImpl?: FetchLike;
  readonly tavilyApiKey?: string;
  readonly braveApiKey?: string;
  readonly now?: () => Date;
}

export function createWebTools(options: WebToolsOptions = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const tavilyApiKey = (options.tavilyApiKey || '').trim();
  const braveApiKey = (options.braveApiKey || '').trim();

  async function search(args: unknown, signal?: AbortSignal) {
    const source = only(args, ['query', 'limit'], 'INVALID_WEB_SEARCH_ARGS');
    const query = text(source.query, MAX_QUERY, 'INVALID_WEB_SEARCH_QUERY');
    const limit = int(source.limit, 6, 1, 10, 'INVALID_WEB_SEARCH_LIMIT');
    let provider = 'DuckDuckGo';
    let results: SearchResult[];
    if (tavilyApiKey) {
      provider = 'Tavily';
      const data = await getJson(fetchImpl, 'https://api.tavily.com/search', signal, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tavilyApiKey}` },
        body: JSON.stringify({ query, max_results: limit, search_depth: 'basic' })
      });
      results = (Array.isArray(data.results) ? data.results : []).map(record).map((item) => ({ title: String(item.title || '').slice(0, 200), url: String(item.url || '').slice(0, MAX_URL), snippet: String(item.content || '').slice(0, 400) }));
    } else if (braveApiKey) {
      provider = 'Brave';
      const data = await getJson(fetchImpl, `https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({ q: query, count: String(limit), search_lang: 'tr' })}`, signal, {
        headers: { Accept: 'application/json', 'X-Subscription-Token': braveApiKey }
      });
      results = (Array.isArray(record(data.web).results) ? record(data.web).results as unknown[] : []).map(record).map((item) => ({ title: stripTags(String(item.title || '')).slice(0, 200), url: String(item.url || '').slice(0, MAX_URL), snippet: stripTags(String(item.description || '')).slice(0, 400) }));
    } else {
      const html = await getText(fetchImpl, 'https://html.duckduckgo.com/html/', signal, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: new URLSearchParams({ q: query, kl: 'tr-tr' }).toString()
      });
      if (/anomaly-modal|challenge-form/i.test(html)) throw new WebToolError('WEB_SEARCH_BLOCKED', 429);
      results = parseDuckDuckGoHtml(html, limit);
    }
    return { provider, query, results: results.filter((item) => item.url).slice(0, limit), note: 'Ayrıntı için ilgili sonucu web_page_read ile okuyabilirsin.' };
  }

  async function wikipedia(args: unknown, signal?: AbortSignal) {
    const source = only(args, ['query', 'language'], 'INVALID_WIKIPEDIA_ARGS');
    const query = text(source.query, 200, 'INVALID_WIKIPEDIA_QUERY');
    const language = source.language === undefined ? 'tr' : String(source.language);
    if (!/^(tr|en|de|fr|es|ar|ru|az)$/.test(language)) throw new WebToolError('INVALID_WIKIPEDIA_LANGUAGE', 400);
    const host = `https://${language}.wikipedia.org`;
    const found = await getJson(fetchImpl, `${host}/w/api.php?${new URLSearchParams({ action: 'query', list: 'search', srsearch: query, format: 'json', srlimit: '3', utf8: '1' })}`, signal);
    const hits = (Array.isArray(record(found.query).search) ? record(found.query).search as unknown[] : []).map(record);
    if (!hits.length) throw new WebToolError('WIKIPEDIA_NOT_FOUND', 404);
    const title = String(hits[0].title || '');
    const summary = await getJson(fetchImpl, `${host}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, signal);
    return {
      source: `Vikipedi (${language})`,
      title: String(summary.title || title).slice(0, 200),
      description: String(summary.description || '').slice(0, 300),
      extract: String(summary.extract || '').slice(0, 4000),
      url: String(record(record(summary.content_urls).desktop).page || `${host}/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`).slice(0, MAX_URL),
      otherMatches: hits.slice(1).map((hit) => String(hit.title || '').slice(0, 200))
    };
  }

  async function news(args: unknown, signal?: AbortSignal) {
    const source = only(args, ['query', 'limit'], 'INVALID_NEWS_ARGS');
    const query = source.query === undefined || source.query === '' ? '' : text(source.query, MAX_QUERY, 'INVALID_NEWS_QUERY');
    const limit = int(source.limit, 8, 1, 15, 'INVALID_NEWS_LIMIT');
    const params = new URLSearchParams({ hl: 'tr', gl: 'TR', ceid: 'TR:tr' });
    const url = query ? `https://news.google.com/rss/search?${new URLSearchParams({ q: query })}&${params}` : `https://news.google.com/rss?${params}`;
    const xml = await getText(fetchImpl, url, signal);
    const items = xml.split('<item>').slice(1, limit + 1).map((item) => {
      const field = (name: string) => decodeEntities(item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, '') || '').trim();
      const published = Date.parse(field('pubDate'));
      return {
        title: stripTags(field('title')).slice(0, 300),
        source: stripTags(field('source')).slice(0, 120),
        published: Number.isFinite(published) ? new Date(published).toISOString() : '',
        url: field('link').slice(0, MAX_URL)
      };
    }).filter((item) => item.title);
    return { source: 'Google Haberler', query: query || 'manşetler', items };
  }

  async function rates(args: unknown, signal?: AbortSignal) {
    const source = only(args, ['base', 'symbols', 'amount'], 'INVALID_RATES_ARGS');
    const base = (source.base === undefined ? 'USD' : String(source.base)).toUpperCase();
    if (!/^[A-Z]{3}$/.test(base)) throw new WebToolError('INVALID_RATES_BASE', 400);
    const symbols = source.symbols === undefined ? ['TRY', 'USD', 'EUR', 'GBP'] : Array.isArray(source.symbols) ? source.symbols.map((item) => String(item).toUpperCase()) : [];
    if (!symbols.length || symbols.length > 12 || symbols.some((item) => !/^[A-Z]{3}$/.test(item))) throw new WebToolError('INVALID_RATES_SYMBOLS', 400);
    const amount = source.amount === undefined ? 1 : Number(source.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw new WebToolError('INVALID_RATES_AMOUNT', 400);
    const data = await getJson(fetchImpl, `https://open.er-api.com/v6/latest/${base}`, signal);
    if (data.result !== 'success') throw new WebToolError('RATES_UNAVAILABLE', 502);
    const table = record(data.rates);
    const converted: Record<string, number> = {};
    for (const symbol of symbols) {
      const rate = Number(table[symbol]);
      if (Number.isFinite(rate)) converted[symbol] = Math.round(rate * amount * 10_000) / 10_000;
    }
    if (!Object.keys(converted).length) throw new WebToolError('RATES_SYMBOL_NOT_FOUND', 404);
    return { source: 'ExchangeRate-API (günlük referans kur, anlık piyasa fiyatı değildir)', base, amount, rates: converted, updated: String(data.time_last_update_utc || '').slice(0, 64) };
  }

  async function readPage(args: unknown, signal?: AbortSignal) {
    const source = only(args, ['url'], 'INVALID_WEB_PAGE_ARGS');
    const raw = text(source.url, MAX_URL, 'INVALID_WEB_PAGE_URL');
    const page = await fetchPublicPage(raw, signal);
    const isHtml = /html|xml/.test(page.contentType) || /^\s*</.test(page.body);
    const parsed = isHtml ? htmlToText(page.body) : { title: '', description: '', text: page.body.replace(/\s+\n/g, '\n').trim() };
    const content = redactPlaintextCredentials(parsed.text);
    return {
      url: page.url,
      title: redactPlaintextCredentials(parsed.title),
      description: redactPlaintextCredentials(parsed.description),
      content: content.slice(0, MAX_PAGE_TEXT),
      truncated: page.truncated || content.length > MAX_PAGE_TEXT
    };
  }

  return Object.freeze({ search, wikipedia, news, rates, readPage });
}
export type WebTools = ReturnType<typeof createWebTools>;

const fn = (name: string, description: string, properties: Json, required: string[] = []) => Object.freeze({
  type: 'function',
  function: Object.freeze({ name, description, parameters: Object.freeze({ type: 'object', properties: Object.freeze(properties), required: Object.freeze(required), additionalProperties: false }) })
});

export const WEB_TOOL_DEFINITIONS = Object.freeze({
  web_search: fn('web_search', 'İnternette güncel bilgi arar ve başlık, adres ve kısa özet listesi döndürür. Güncel olaylar, fiyatlar, kişiler, ürünler, yerler ya da bilmediğin/emin olmadığın her konu için kullan.', {
    query: { type: 'string', maxLength: MAX_QUERY, description: 'Arama sorgusu.' },
    limit: { type: 'integer', minimum: 1, maximum: 10, description: 'En fazla sonuç sayısı (varsayılan 6).' }
  }, ['query']),
  web_page_read: fn('web_page_read', 'Herkese açık bir web sayfasını açıp okunabilir metnini getirir. Arama sonucundaki ya da kullanıcının verdiği bir bağlantının ayrıntısı gerektiğinde kullan.', {
    url: { type: 'string', maxLength: MAX_URL, description: 'http(s) ile başlayan tam adres.' }
  }, ['url']),
  wikipedia_lookup: fn('wikipedia_lookup', 'Vikipedi\'de bir konuyu arar ve ansiklopedik özetini getirir. Kişiler, yerler, tarih, bilim ve kavramlar için kullan.', {
    query: { type: 'string', maxLength: 200, description: 'Konu ya da başlık.' },
    language: { type: 'string', enum: ['tr', 'en', 'de', 'fr', 'es', 'ar', 'ru', 'az'], description: 'Vikipedi dili (varsayılan tr).' }
  }, ['query']),
  news_search: fn('news_search', 'Güncel haber başlıklarını getirir. Sorgu verilmezse Türkiye manşetlerini döndürür.', {
    query: { type: 'string', maxLength: MAX_QUERY, description: 'Haber konusu (boş bırakılırsa manşetler).' },
    limit: { type: 'integer', minimum: 1, maximum: 15 }
  }),
  exchange_rates: fn('exchange_rates', 'Döviz kurlarını getirir ve tutar çevirir (günlük referans kur).', {
    base: { type: 'string', description: 'Kaynak para birimi, ISO kodu (örn. USD, EUR, TRY).' },
    symbols: { type: 'array', items: { type: 'string' }, maxItems: 12, description: 'Hedef para birimleri (örn. ["TRY","EUR"]).' },
    amount: { type: 'number', description: 'Çevrilecek tutar (varsayılan 1).' }
  })
});
