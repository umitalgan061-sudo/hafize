import { describe, expect, it } from 'vitest';
import { findAttachmentReferences } from './user-attachments.ts';

const IMG = '/api/images/img_' + 'a'.repeat(20);
const DOC = '/api/documents/doc_' + 'b'.repeat(20);

describe('attachment references in user messages', () => {
  it('finds a document reference', () => {
    expect(findAttachmentReferences(`Bu dosyaya bak\n[Ekli dosya: not.txt](${DOC})\n`)).toEqual([
      { kind: 'document', name: 'not.txt', url: DOC }
    ]);
  });

  it('finds an image reference', () => {
    expect(findAttachmentReferences(`![ekran goruntusu.png](${IMG})`)).toEqual([
      { kind: 'image', name: 'ekran goruntusu.png', url: IMG }
    ]);
  });

  it('finds several references in order, mixed kinds', () => {
    const source = ` once ![a.png](${IMG}) sonra [Ekli dosya: not.txt](${DOC}) ve ![b.png](${IMG}) tekrar`;
    expect(findAttachmentReferences(source).map((item) => item.name)).toEqual(['a.png', 'not.txt', 'b.png']);
    expect(findAttachmentReferences(source).map((item) => item.kind)).toEqual(['image', 'document', 'image']);
  });

  it('returns nothing for plain text', () => {
    expect(findAttachmentReferences('merhaba, nasilsin')).toEqual([]);
    expect(findAttachmentReferences('')).toEqual([]);
    expect(findAttachmentReferences(undefined as unknown as string)).toEqual([]);
  });

  it('ignores look-alike markdown that is not an attachment', () => {
    expect(findAttachmentReferences('[baglanti](https://example.com)')).toEqual([]);
    expect(findAttachmentReferences('![harici](https://example.com/a.png)')).toEqual([]);
    expect(findAttachmentReferences('[Ekli dosya: x](/api/other/thing)')).toEqual([]);
  });

  it('does not treat a missing name as a reference', () => {
    expect(findAttachmentReferences('![](/api/images/img_' + 'c'.repeat(20) + ')')).toEqual([
      { kind: 'image', name: 'görsel', url: '/api/images/img_' + 'c'.repeat(20) }
    ]);
  });
});
