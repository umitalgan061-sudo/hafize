// Source adapters for the research agent: academic indexes (arXiv, Crossref, PubMed) next to the
// general web engines in web-tools.ts, a content extractor (main text, JSON-LD structured data,
// tables, images, paywall and fact-check signals) and a credibility scorer.
import { createHash } from 'node:crypto';
import { decodeEntities, fetchPublicPage, htmlToText } from './web-tools.ts';
import { redactPlaintextCredentials } from './plaintext-credential-policy.ts';

export interface SourceCandidate {
  readonly url: string;
  readonly title: string;
  readonly snippet: string;
  readonly engine: string;
  readonly fetchedAt: string;
  readonly published?: string;
  readonly authors?: readonly string[];
  readonly citations?: number;
  readonly venue?: string;
  readonly doi?: string;
}

type Json = Record<string, unknown>;
const record = (value: unknown): Json => (value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {});
const clean = (value: unknown, max: number) => redactPlaintextCredentials(decodeEntities(String(value ?? '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()).slice(0, max);
const API_HEADERS = { 'User-Agent': 'Hafize/0.1 (personal research assistant; mailto:hafize@localhost)', Accept: 'application/json' };

async function getText(fetchImpl: typeof fetch, url: string, signal?: AbortSignal, accept = 'application/json'): Promise<string> {
  const response = await fetchImpl(url, { headers: { ...API_HEADERS, Accept: accept }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
  if (!response.ok) throw Object.assign(new Error('RESEARCH_SOURCE_UNAVAILABLE'), { code: 'RESEARCH_SOURCE_UNAVAILABLE', status: response.status });
  return response.text();
}

export function parseArxivAtom(xml: string, fetchedAt: string): SourceCandidate[] {
  return xml.split('<entry>').slice(1).map((entry) => {
    const field = (name: string) => entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] || '';
    const url = (field('id').trim() || '').replace(/^http:/, 'https:');
    return {
      url,
      title: clean(field('title'), 300),
      snippet: clean(field('summary'), 600),
      engine: 'arXiv',
      fetchedAt,
      published: field('published').trim().slice(0, 10),
      authors: [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((match) => clean(match[1], 80)).slice(0, 6),
      venue: 'arXiv'
    };
  }).filter((item) => /^https:\/\/arxiv\.org\//.test(item.url));
}

export function createResearchSources({ fetchImpl = globalThis.fetch, now = () => new Date() }: { readonly fetchImpl?: typeof fetch; readonly now?: () => Date } = {}) {
  async function arxiv(query: string, limit: number, signal?: AbortSignal): Promise<SourceCandidate[]> {
    const xml = await getText(fetchImpl, `https://export.arxiv.org/api/query?${new URLSearchParams({ search_query: `all:${query}`, start: '0', max_results: String(limit), sortBy: 'relevance' })}`, signal, 'application/atom+xml');
    return parseArxivAtom(xml, now().toISOString()).slice(0, limit);
  }

  async function crossref(query: string, limit: number, signal?: AbortSignal): Promise<SourceCandidate[]> {
    const data = record(JSON.parse(await getText(fetchImpl, `https://api.crossref.org/works?${new URLSearchParams({ query, rows: String(limit), select: 'DOI,title,author,published,container-title,is-referenced-by-count,abstract,URL' })}`, signal)));
    const items = Array.isArray(record(data.message).items) ? record(data.message).items as unknown[] : [];
    return items.map(record).map((item) => {
      const parts = (record(item.published)['date-parts'] as unknown[][] | undefined)?.[0] || [];
      const doi = String(item.DOI || '');
      return {
        url: doi ? `https://doi.org/${doi}` : String(item.URL || ''),
        title: clean((item.title as unknown[] | undefined)?.[0], 300),
        snippet: clean(item.abstract, 600),
        engine: 'Crossref',
        fetchedAt: now().toISOString(),
        published: parts.length ? parts.map((part) => String(part).padStart(2, '0')).join('-') : '',
        authors: (Array.isArray(item.author) ? item.author : []).map(record).map((author) => clean(`${author.given || ''} ${author.family || ''}`, 80)).filter(Boolean).slice(0, 6),
        citations: Number(item['is-referenced-by-count']) || 0,
        venue: clean((item['container-title'] as unknown[] | undefined)?.[0], 200),
        doi
      };
    }).filter((item) => item.url && item.title);
  }

  async function pubmed(query: string, limit: number, signal?: AbortSignal): Promise<SourceCandidate[]> {
    const search = record(JSON.parse(await getText(fetchImpl, `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: String(limit), sort: 'relevance' })}`, signal)));
    const ids = (record(search.esearchresult).idlist as unknown[] | undefined || []).map(String).filter((id) => /^\d+$/.test(id)).slice(0, limit);
    if (!ids.length) return [];
    const summary = record(JSON.parse(await getText(fetchImpl, `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'json' })}`, signal)));
    const result = record(summary.result);
    return ids.map((id) => record(result[id])).filter((item) => item.title).map((item) => ({
      url: `https://pubmed.ncbi.nlm.nih.gov/${String(item.uid)}/`,
      title: clean(item.title, 300),
      snippet: clean(`${item.fulljournalname || item.source || ''} ${item.pubdate || ''}`, 300),
      engine: 'PubMed',
      fetchedAt: now().toISOString(),
      published: clean(item.sortpubdate, 10).replace(/\//g, '-'),
      authors: (Array.isArray(item.authors) ? item.authors : []).map(record).map((author) => clean(author.name, 80)).slice(0, 6),
      venue: clean(item.fulljournalname || item.source, 200)
    }));
  }

  /** Reads a page and returns its main text plus structured signals. Public addresses only. */
  async function extract(url: string, signal?: AbortSignal) {
    const page = await fetchPublicPage(url, signal);
    const isHtml = /html|xml/.test(page.contentType) || /^\s*</.test(page.body);
    const html = isHtml ? page.body : '';
    const parsed = isHtml ? htmlToText(html) : { title: '', description: '', text: page.body };
    const structuredData: Json[] = [];
    for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const value = JSON.parse(match[1]!.trim()) as unknown;
        const items = Array.isArray(value) ? value : Array.isArray(record(value)['@graph']) ? record(value)['@graph'] as unknown[] : [value];
        for (const item of items.slice(0, 10)) structuredData.push(record(item));
      } catch {}
    }
    const typeOf = (item: Json) => String(Array.isArray(item['@type']) ? (item['@type'] as unknown[])[0] : item['@type'] || '');
    const article = structuredData.find((item) => /Article|Report|ScholarlyArticle|WebPage/i.test(typeOf(item)));
    const claimReviews = structuredData.filter((item) => typeOf(item) === 'ClaimReview').map((item) => ({
      claim: clean(item.claimReviewed, 300),
      rating: clean(record(item.reviewRating).alternateName || record(item.reviewRating).ratingValue, 80),
      by: clean(record(item.author).name, 120)
    }));
    const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].slice(0, 3).map((table) =>
      [...table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].slice(0, 15).map((row) => [...row[0].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].slice(0, 8).map((cell) => clean(cell[1], 120))).filter((row) => row.length)
    ).filter((rows) => rows.length > 1);
    const images = [...html.matchAll(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi)].slice(0, 5).map((match) => { try { return new URL(match[1]!, page.url).toString(); } catch { return ''; } }).filter((src) => /^https:/.test(src));
    const paywall = /isAccessibleForFree["']?\s*:\s*["']?false/i.test(html) || /\b(subscribe to (continue|read)|abone ol(un|arak) okuyun|paywall)\b/i.test(parsed.text.slice(0, 4_000));
    const text = redactPlaintextCredentials(parsed.text);
    return {
      url: page.url,
      title: clean(parsed.title || article?.headline, 300),
      description: clean(parsed.description, 500),
      mainText: text.slice(0, 40_000),
      published: clean(article?.datePublished || html.match(/<meta[^>]+property=["']article:published_time["'][^>]*content=["']([^"']+)/i)?.[1], 40),
      author: clean(record(Array.isArray(article?.author) ? (article!.author as unknown[])[0] : article?.author).name || html.match(/<meta[^>]+name=["']author["'][^>]*content=["']([^"']+)/i)?.[1], 120),
      structuredData: structuredData.slice(0, 5).map((item) => ({ type: typeOf(item), name: clean(item.name || item.headline, 200) })),
      claimReviews,
      tables,
      images,
      paywall,
      truncated: page.truncated
    };
  }

  return Object.freeze({ arxiv, crossref, pubmed, extract });
}
export type ResearchSources = ReturnType<typeof createResearchSources>;

// --- credibility ---------------------------------------------------------------------
const HIGH = /(^|\.)(gov|gov\.tr|edu|edu\.tr|ac\.uk|int|who\.int|europa\.eu|un\.org|oecd\.org|worldbank\.org|imf\.org|tuik\.gov\.tr|tcmb\.gov\.tr|resmigazete\.gov\.tr|nih\.gov|cdc\.gov|nature\.com|science\.org|sciencedirect\.com|springer\.com|wiley\.com|nejm\.org|thelancet\.com|bmj\.com|arxiv\.org|doi\.org|pubmed\.ncbi\.nlm\.nih\.gov|ieee\.org|acm\.org)$/i;
const GOOD = /(^|\.)(wikipedia\.org|britannica\.com|reuters\.com|apnews\.com|bbc\.(com|co\.uk)|nytimes\.com|theguardian\.com|ft\.com|economist\.com|bloomberg\.com|aa\.com\.tr|trthaber\.com|dw\.com|npr\.org|statista\.com|github\.com|mozilla\.org|python\.org|nodejs\.org|microsoft\.com|stackoverflow\.com)$/i;
const LOW = /(^|\.)(blogspot\.|wordpress\.com|medium\.com|quora\.com|reddit\.com|pinterest\.|tiktok\.com|facebook\.com|x\.com|twitter\.com|instagram\.com|eksisozluk\.com|forum)/i;

export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

/** 0..1 credibility from domain reputation, transport, recency, citation count and fact-check labels. */
export function scoreCredibility(source: { readonly url: string; readonly published?: string | undefined; readonly citations?: number | undefined; readonly engine?: string; readonly claimReviews?: readonly unknown[] }, now = new Date()): { score: number; reasons: string[] } {
  const domain = domainOf(source.url);
  const reasons: string[] = [];
  let score = 0.5;
  if (HIGH.test(domain)) { score += 0.3; reasons.push('kurumsal/akademik alan adı'); }
  else if (GOOD.test(domain)) { score += 0.15; reasons.push('bilinen yayın/başvuru kaynağı'); }
  else if (LOW.test(domain)) { score -= 0.2; reasons.push('kullanıcı içerikli platform'); }
  if (!source.url.startsWith('https://')) { score -= 0.05; reasons.push('şifresiz bağlantı'); }
  if (source.engine === 'Crossref' || source.engine === 'PubMed' || source.engine === 'arXiv') { score += 0.05; reasons.push('akademik dizin'); }
  if (Number(source.citations) > 0) { score += Math.min(0.15, Math.log10(Number(source.citations) + 1) / 20); reasons.push(`${source.citations} atıf`); }
  const published = source.published ? Date.parse(source.published) : NaN;
  if (Number.isFinite(published)) {
    const ageYears = (now.getTime() - published) / (365.25 * 86_400_000);
    if (ageYears > 5) { score -= 0.05; reasons.push('5 yıldan eski'); } else if (ageYears < 1) { score += 0.03; reasons.push('güncel'); }
  }
  if (source.claimReviews?.length) { score += 0.05; reasons.push('doğruluk kontrolü (ClaimReview) içeriyor'); }
  return { score: Math.round(Math.min(1, Math.max(0, score)) * 100) / 100, reasons };
}

export function snippetHash(text: string): string {
  return createHash('sha256').update(String(text)).digest('hex').slice(0, 16);
}

// --- citations -----------------------------------------------------------------------
const MONTHS_EN = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'];
export function formatCitation(style: 'apa' | 'ieee' | 'iso690', source: { readonly n: number; readonly url: string; readonly title: string; readonly authors?: readonly string[] | undefined; readonly published?: string | undefined; readonly venue?: string | undefined; readonly accessedAt: string }): string {
  const site = source.venue || domainOf(source.url);
  const year = source.published && /^\d{4}/.test(source.published) ? source.published.slice(0, 4) : 't.y.';
  const authors = source.authors?.length ? source.authors.slice(0, 3).join(', ') + (source.authors.length > 3 ? ' vd.' : '') : site;
  const accessed = new Date(source.accessedAt);
  if (style === 'apa') return `${authors}. (${year}). ${source.title}. ${site}. ${source.url}`;
  if (style === 'ieee') return `[${source.n}] ${authors}, "${source.title}," ${site}, ${year === 't.y.' ? 'n.d.' : year}. [Online]. Available: ${source.url} (accessed ${MONTHS_EN[accessed.getUTCMonth()]} ${accessed.getUTCDate()}, ${accessed.getUTCFullYear()}).`;
  return `${authors.toLocaleUpperCase('tr')}. ${source.title} [çevrimiçi]. ${site}, ${year}. Erişim adresi: ${source.url} [Erişim tarihi: ${accessed.toISOString().slice(0, 10)}].`;
}
