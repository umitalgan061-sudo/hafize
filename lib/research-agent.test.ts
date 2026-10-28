import { describe, expect, it } from 'vitest';
import { createResearchAgent, numericConflict, selectPassages } from './research-agent.ts';
import { formatCitation, parseArxivAtom, scoreCredibility } from './research-sources.ts';

describe('research helpers', () => {
  it('detects numeric conflicts but ignores years and close values', () => {
    expect(numericConflict('Nüfus 85,3 milyon.', 'Nüfus 79 milyon.')).toBe(true);
    expect(numericConflict('Nüfus 85,3 milyon.', 'Nüfus 85,4 milyon.')).toBe(false);
    expect(numericConflict('2024 yılında açıldı.', '2023 yılında açıldı.')).toBe(false);
  });

  it('picks the passages that share terms with the question', () => {
    const text = ['Giriş paragrafı burada yer alıyor ve konu dışı bilgiler içeriyor.', 'Ankara Türkiye’nin başkentidir ve 1923’ten beri başkenttir, nüfusu yaklaşık beş milyondur.', 'Başka bir alakasız paragraf hava ve iklim üzerine konuşuyor uzun uzun.'].join('\n');
    expect(selectPassages(text, 'Türkiye’nin başkenti neresi?', 1)[0]).toContain('başkentidir');
  });

  it('parses arXiv feeds, scores credibility and formats citations', () => {
    const atom = '<feed><entry><id>http://arxiv.org/abs/1234.5678v1</id><published>2024-02-01T00:00:00Z</published><title>Deep Thing</title><summary>About things.</summary><author><name>Ada L.</name></author></entry></feed>';
    const [paper] = parseArxivAtom(atom, '2026-10-23T00:00:00Z');
    expect(paper).toMatchObject({ url: 'https://arxiv.org/abs/1234.5678v1', title: 'Deep Thing', authors: ['Ada L.'] });
    expect(scoreCredibility({ url: 'https://www.tuik.gov.tr/x' }).score).toBeGreaterThan(scoreCredibility({ url: 'https://someone.blogspot.com/x' }).score);
    const entry = { n: 1, url: 'https://example.org/a', title: 'Başlık', published: '2025-03-01', accessedAt: '2026-10-23T10:00:00Z' };
    expect(formatCitation('apa', entry)).toBe('example.org. (2025). Başlık. example.org. https://example.org/a');
    expect(formatCitation('ieee', entry)).toContain('[1] example.org, "Başlık,"');
  });
});

describe('research agent pipeline', () => {
  it('builds a cited report with clustered claims and conflicts', async () => {
    const webTools = {
      search: async () => ({ provider: 'Test', results: [
        { url: 'https://www.tuik.gov.tr/nufus', title: 'TÜİK nüfus', snippet: 'Türkiye nüfusu 85,3 milyon' },
        { url: 'https://blog.example.com/nufus', title: 'Blog', snippet: 'Türkiye nüfusu 79 milyon' }
      ] }),
      wikipedia: async () => { throw new Error('offline'); },
      news: async () => ({ items: [] })
    };
    const sources = {
      arxiv: async () => [], crossref: async () => [], pubmed: async () => [],
      extract: async (url: string) => ({
        url, title: url.includes('tuik') ? 'TÜİK nüfus' : 'Blog', description: '', published: '', author: '', structuredData: [], claimReviews: [], tables: [], images: [], paywall: false, truncated: false,
        mainText: url.includes('tuik') ? 'Türkiye nüfusu 2024 sonunda 85,3 milyon kişi olarak açıklandı.' : 'Bir bloga göre Türkiye nüfusu 79 milyon kişidir.'
      })
    };
    const models = {
      chatJson: async ({ purpose }: { purpose?: string }) => (purpose === 'research.plan' ? { queries: [] } : {
        claims: [
          { text: 'Türkiye nüfusu 85,3 milyondur.', sources: [1], stance: 'supports' },
          { text: 'Türkiye nüfusu 79 milyondur.', sources: [2], stance: 'contradicts' }
        ],
        gaps: ['İl bazında dağılım yok.'],
        summary: 'Türkiye nüfusu 85,3 milyondur [1].'
      }),
      embed: async () => null
    };
    const agent = createResearchAgent({ webTools, sources: sources as never, models: models as never });
    const report = await agent.run({ question: 'Türkiye nüfusu kaç milyon?', depth: 'quick' });
    expect(report.sources.map((source) => source.n)).toEqual([1, 2]);
    expect(report.findings[0]).toMatchObject({ text: 'Türkiye nüfusu 85,3 milyondur.', citations: [1, 2] });
    expect(report.findings[0]!.conflicts).toHaveLength(1);
    expect(report.bibliography.apa).toHaveLength(2);
    expect(report.engines.find((engine) => engine.engine === 'wikipedia')?.error).toBeTruthy();
  });
});
