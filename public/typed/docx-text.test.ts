import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { DocxError, docxToText, documentXmlToText } from './docx-text.ts';

/** A real zip container with deflated entries, as Word writes them. */
function zip(files: Record<string, string>): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const raw = Buffer.from(text);
    const body = deflateRawSync(raw);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(raw.length, 22);
    head.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    local.push(head, nameBytes, body);
    central.push(entry, nameBytes);
    offset += head.length + nameBytes.length + body.length;
  }
  const centralBytes = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, centralBytes, end]));
}

const body = (inner: string) => `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${inner}</w:body></w:document>`;

describe('docx text', () => {
  it('keeps paragraphs on their own lines and Turkish letters as they are', async () => {
    const xml = body('<w:p><w:r><w:t>Yıllık izin</w:t></w:r><w:r><w:t xml:space="preserve"> listesi</w:t></w:r></w:p><w:p><w:r><w:t>Şubat &amp; Mart</w:t></w:r></w:p>');
    expect(await docxToText(zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': xml }))).toBe('Yıllık izin listesi\nŞubat & Mart');
  });

  it('puts table cells side by side, one row per line', () => {
    const xml = body('<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Ad</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Gün</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>Ali</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>5</w:t></w:r></w:p></w:tc></w:tr></w:tbl>');
    expect(documentXmlToText(xml)).toBe('Ad\tGün\nAli\t5');
  });

  it('refuses a file that is not a Word document', async () => {
    await expect(docxToText(new Uint8Array([1, 2, 3]))).rejects.toBeInstanceOf(DocxError);
    await expect(docxToText(zip({ 'xl/workbook.xml': '<x/>' }))).rejects.toThrow('.docx');
  });
});
