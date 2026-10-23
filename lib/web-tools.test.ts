import { describe, expect, it } from 'vitest';
import { loadAgentRegistry, resolveAgent } from './agent-runtime.ts';
import { redactPlaintextCredentials } from './plaintext-credential-policy.ts';
import { executeNvidiaToolCall, getAllowedNvidiaTools } from './tool-runtime.ts';
import { createWebTools, htmlToText, isPublicAddress, parseDuckDuckGoHtml, parsePublicUrl } from './web-tools.ts';

function fakeFetch(handler: (url: string, init?: RequestInit) => { status?: number; body: string }) {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const { status = 200, body } = handler(url, init);
    return new Response(body, { status });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const DDG = `
<div class="result results_links result--ad"><a class="result__a" href="https://ads.example/x">Reklam</a></div>
<div class="result results_links results_links_deep web-result "><h2 class="result__title"><a rel="nofollow" class="result__a" href="https://example.org/a">Birinci &amp; sonuç</a></h2>
<a class="result__snippet" href="https://example.org/a"><b>Türkiye</b> nüfusu 86 milyon</a></div>
<div class="result results_links results_links_deep web-result "><h2 class="result__title"><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fb&amp;rut=1">İkinci</a></h2>
<a class="result__snippet" href="x">Özet iki</a></div>`;

describe('address guard', () => {
  it('only treats public addresses as reachable', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.5', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) expect(isPublicAddress(ip), ip).toBe(true);
  });

  it('rejects non-web, credentialed, odd-port and local URLs before any request', () => {
    for (const url of ['file:///etc/passwd', 'ftp://example.com', 'http://user:pw@example.com', 'http://example.com:8080/', 'http://localhost/', 'http://printer.local/', 'http://127.0.0.1/', 'http://[::1]/', 'http://169.254.169.254/latest/meta-data', 'not a url']) {
      expect(() => parsePublicUrl(url), url).toThrow();
    }
    expect(parsePublicUrl('https://example.com/a#frag').toString()).toBe('https://example.com/a');
  });

  it('refuses to read local pages through the tool', async () => {
    const tools = createWebTools();
    await expect(tools.readPage({ url: 'http://127.0.0.1:4173/' })).rejects.toMatchObject({ code: 'WEB_URL_PORT_BLOCKED' });
    await expect(tools.readPage({ url: 'http://localhost/' })).rejects.toMatchObject({ code: 'WEB_ADDRESS_BLOCKED' });
  });
});

describe('parsers', () => {
  it('parses DuckDuckGo results, skipping ads and unwrapping redirects', () => {
    expect(parseDuckDuckGoHtml(DDG, 5)).toEqual([
      { title: 'Birinci & sonuç', url: 'https://example.org/a', snippet: 'Türkiye nüfusu 86 milyon' },
      { title: 'İkinci', url: 'https://example.com/b', snippet: 'Özet iki' }
    ]);
  });

  it('redacts credential-looking text instead of rejecting the whole page', () => {
    const redacted = redactPlaintextCredentials('Kurulum: api_key=abcdef123456 ve Authorization: Bearer abcdefghijkl sonra devam.');
    expect(redacted).not.toMatch(/abcdef123456|abcdefghijkl/);
    expect(redacted).toContain('[gizlendi]');
    expect(redacted).toContain('sonra devam.');
  });

  it('extracts readable text from HTML', () => {
    const page = htmlToText('<html><head><title>Başlık &amp; alt</title><meta name="description" content="Kısa açıklama"><script>evil()</script></head><body><nav>menü</nav><main><h1>Merhaba</h1><p>Birinci&nbsp;paragraf.</p><ul><li>bir</li><li>iki</li></ul><style>.x{}</style></main></body></html>');
    expect(page.title).toBe('Başlık & alt');
    expect(page.description).toBe('Kısa açıklama');
    expect(page.text).toContain('Merhaba');
    expect(page.text).toContain('Birinci paragraf.');
    expect(page.text).toContain('• bir');
    expect(page.text).not.toMatch(/evil|menü|\.x\{\}/);
  });
});

describe('web tools', () => {
  it('searches with DuckDuckGo when no API key is configured', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: DDG }));
    const result = await createWebTools({ fetchImpl }).search({ query: 'Türkiye nüfusu', limit: 1 });
    expect(result.provider).toBe('DuckDuckGo');
    expect(result.results).toHaveLength(1);
    expect(calls[0]).toBe('https://html.duckduckgo.com/html/');
  });

  it('uses Tavily when a key is configured', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ body: JSON.stringify({ results: [{ title: 'T', url: 'https://t.example', content: 'c' }] }) }));
    const result = await createWebTools({ fetchImpl, tavilyApiKey: 'tvly-test' }).search({ query: 'x' });
    expect(result).toMatchObject({ provider: 'Tavily', results: [{ title: 'T', url: 'https://t.example', snippet: 'c' }] });
    expect(calls[0]).toBe('https://api.tavily.com/search');
  });

  it('looks up Wikipedia summaries', async () => {
    const { fetchImpl } = fakeFetch((url) => url.includes('/w/api.php')
      ? { body: JSON.stringify({ query: { search: [{ title: 'Ankara' }, { title: 'Ankara İli' }] } }) }
      : { body: JSON.stringify({ title: 'Ankara', description: 'Türkiye\'nin başkenti', extract: 'Ankara, Türkiye\'nin başkentidir.', content_urls: { desktop: { page: 'https://tr.wikipedia.org/wiki/Ankara' } } }) });
    const result = await createWebTools({ fetchImpl }).wikipedia({ query: 'Ankara' });
    expect(result).toMatchObject({ title: 'Ankara', extract: 'Ankara, Türkiye\'nin başkentidir.', url: 'https://tr.wikipedia.org/wiki/Ankara', otherMatches: ['Ankara İli'] });
  });

  it('reads Google News RSS items', async () => {
    const rss = '<rss><channel><item><title>Başlık bir - Kaynak</title><link>https://news.google.com/a</link><pubDate>Thu, 22 Oct 2026 10:00:00 GMT</pubDate><source url="x">Kaynak</source></item><item><title>İki</title><link>https://news.google.com/b</link></item></channel></rss>';
    const { fetchImpl, calls } = fakeFetch(() => ({ body: rss }));
    const result = await createWebTools({ fetchImpl }).news({ query: 'ekonomi', limit: 5 });
    expect(result.items[0]).toEqual({ title: 'Başlık bir - Kaynak', source: 'Kaynak', published: '2026-10-22T10:00:00.000Z', url: 'https://news.google.com/a' });
    expect(result.items).toHaveLength(2);
    expect(calls[0]).toContain('q=ekonomi');
  });

  it('converts currencies', async () => {
    const { fetchImpl } = fakeFetch(() => ({ body: JSON.stringify({ result: 'success', rates: { TRY: 49.68, EUR: 0.89 }, time_last_update_utc: 'Fri, 23 Oct 2026' }) }));
    const result = await createWebTools({ fetchImpl }).rates({ base: 'usd', symbols: ['TRY', 'EUR'], amount: 100 });
    expect(result).toMatchObject({ base: 'USD', amount: 100, rates: { TRY: 4968, EUR: 89 } });
  });

  it('validates arguments and surfaces upstream failures with safe codes', async () => {
    const tools = createWebTools();
    await expect(tools.search({ query: '' })).rejects.toMatchObject({ code: 'INVALID_WEB_SEARCH_QUERY' });
    await expect(tools.search({ query: 'x', url: 'y' })).rejects.toMatchObject({ code: 'INVALID_WEB_SEARCH_ARGS' });
    await expect(tools.rates({ base: 'DOLAR' })).rejects.toMatchObject({ code: 'INVALID_RATES_BASE' });
    await expect(tools.wikipedia({ query: 'x', language: 'xx' })).rejects.toMatchObject({ code: 'INVALID_WIKIPEDIA_LANGUAGE' });
    const failing = createWebTools(fakeFetch(() => ({ status: 503, body: 'down' })));
    await expect(failing.search({ query: 'x' })).rejects.toMatchObject({ code: 'WEB_SERVICE_UNAVAILABLE', status: 502 });
  });
});

describe('tool runtime wiring', () => {
  it('offers web tools only when wired, and only to the main agent', async () => {
    const registry = await loadAgentRegistry();
    const hafize = resolveAgent(registry, 'hafize-general')!;
    const reviewer = resolveAgent(registry, 'agency-code-reviewer')!;
    const webTools = createWebTools(fakeFetch(() => ({ body: DDG })));
    const names = (agent: typeof hafize, context: object) => getAllowedNvidiaTools(agent, context).map((tool) => tool.function.name);
    expect(names(hafize, {})).not.toContain('web_search');
    expect(names(hafize, { webTools })).toEqual(expect.arrayContaining(['web_search', 'web_page_read', 'wikipedia_lookup', 'news_search', 'exchange_rates']));
    expect(names(reviewer, { webTools })).not.toContain('web_search');

    const traceId = '00000000-0000-4000-8000-000000000001';
    const call = { id: 'c1', type: 'function', function: { name: 'web_search', arguments: '{"query":"Türkiye"}' } };
    await expect(executeNvidiaToolCall(hafize, call, { traceId, agent: hafize, webTools })).resolves.toMatchObject({ ok: true, value: { provider: 'DuckDuckGo' } });
    await expect(executeNvidiaToolCall(reviewer, call, { traceId, agent: reviewer, webTools })).resolves.toMatchObject({ ok: false, error: 'TOOL_NOT_AUTHORIZED' });
  });
});
