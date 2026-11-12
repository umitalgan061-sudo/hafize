import { describe, expect, it } from 'vitest';
import { renderMarkdownInto, tokenizeCode } from '../markdown-renderer.ts';

const kinds = (text: string, language: string) => (tokenizeCode(text, language) as Array<[string, string]>).filter(([, kind]) => kind).map(([piece, kind]) => `${kind}:${piece}`);
const joined = (text: string, language: string) => (tokenizeCode(text, language) as Array<[string, string]>).map(([piece]) => piece).join('');

describe('code colours', () => {
  it('never change the code: the pieces put together are the text again', () => {
    const samples: Array<[string, string]> = [
      ['iller = [("Ankara", 5803482)]\n# toplam\nprint(f"Toplam: {sum(n for _, n in iller):,}")', 'python'],
      ['const a = `x ${b}`; // not\n/* açık kalan yorum', 'js'],
      ['SELECT ad, COUNT(*) FROM il WHERE nufus > 1000 -- büyükler', 'sql'],
      ['<a href="x">y</a><!-- z -->', 'html'],
      ['"kapanmamış dize\nsonraki satır', 'ts'],
      ['', 'python']
    ];
    for (const [text, language] of samples) expect(joined(text, language)).toBe(text);
  });

  it('mark comments, strings, numbers, keywords and constants', () => {
    expect(kinds('def f(x):\n    return None  # son', 'python')).toEqual(['k:def', 'k:return', 'l:None', 'c:# son']);
    expect(kinds('const n = 42; // sayı', 'js')).toEqual(['k:const', 'n:42', 'c:// sayı']);
    expect(kinds("select 'a''b' from t", 'sql')).toEqual(['k:select', "s:'a''b'", 'k:from']);
  });

  it('leave a language they do not know, and very long code, as it is', () => {
    expect(tokenizeCode('x = 1', 'brainfuck')).toEqual([['x = 1', '']]);
    const long = 'a = 1\n'.repeat(10_000);
    expect(tokenizeCode(long, 'python')).toEqual([[long, '']]);
  });

  it('a word inside a string or a comment is not a keyword', () => {
    expect(kinds('"return if" // for while', 'js')).toEqual(['s:"return if"', 'c:// for while']);
  });
});

describe('a rendered code block', () => {
  it('reads as exactly the code, for copying and reading aloud', () => {
    const created: Array<{ tag: string; className: string; textContent: string; children: unknown[] }> = [];
    const node = (tag: string) => {
      const self = { tag, className: '', children: [] as Array<{ textContent: string }>, attributes: {} as Record<string, string>,
        setAttribute(name: string, value: string) { self.attributes[name] = value; },
        removeAttribute() { /* not needed */ },
        appendChild(child: { textContent: string }) { self.children.push(child); return child; },
        replaceChildren() { self.children = []; },
        set textContent(value: string) { self.children = [{ textContent: value }]; },
        get textContent(): string { return self.children.map((child) => child.textContent).join(''); } };
      created.push(self as never);
      return self;
    };
    const doc = { createElement: node, createDocumentFragment: () => node('fragment'), createTextNode: (text: string) => ({ textContent: text }) };
    const container = node('div') as never as HTMLElement & { ownerDocument: unknown };
    (container as { ownerDocument: unknown }).ownerDocument = doc;
    const source = '```python\nx = "a"  # not\nprint(x)\n```';
    renderMarkdownInto(container, source);
    const code = created.find((item) => item.tag === 'code');
    expect(code?.textContent).toBe('x = "a"  # not\nprint(x)');
    expect(created.some((item) => (item.className === 'tok-s' || (item as never as { attributes: Record<string, string> }).attributes.class === 'tok-s') && item.textContent === '"a"')).toBe(true);
  });
});
