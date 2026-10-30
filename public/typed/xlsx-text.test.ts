import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { excelDate, excelElapsed, formatKind, readZip, XlsxError, xlsxToText } from './xlsx-text.ts';

/** A real zip container, so the central-directory reader is exercised rather than mocked. */
function zip(files: Record<string, string>, { store = false } = {}): Uint8Array {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const raw = Buffer.from(text);
    const body = store ? raw : deflateRawSync(raw);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(store ? 0 : 8, 8);
    head.writeUInt32LE(body.length, 18);
    head.writeUInt32LE(raw.length, 22);
    head.writeUInt16LE(nameBytes.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(store ? 0 : 8, 10);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    local.push(head, nameBytes, body);
    central.push(entry, nameBytes);
    offset += head.length + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...local, directory, end]));
}

const workbook = {
  'xl/workbook.xml': '<workbook xmlns:r="x"><sheets><sheet name="Mesai &amp; İzin" sheetId="1" r:id="rId1"/><sheet name="Boş" sheetId="2" r:id="rId2"/><sheet name="Özet" sheetId="3" r:id="rId3"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="w" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="w" Target="/xl/worksheets/sheet3.xml"/></Relationships>',
  'xl/sharedStrings.xml': '<sst><si><t>Ad</t></si><si><t>Tarih</t></si><si><r><t>Ümit </t></r><r><t xml:space="preserve">ALGAN</t></r></si></sst>',
  'xl/styles.xml': '<styleSheet><numFmts><numFmt numFmtId="170" formatCode="dd\\.mm\\.yyyy"/><numFmt numFmtId="171" formatCode="#,##0.00&quot; TL&quot;"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="170"/><xf numFmtId="171"/><xf numFmtId="20"/></cellXfs></styleSheet>',
  'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="D1" t="inlineStr"><is><t>Not</t></is></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" s="2"><v>46325</v></c><c r="C2" s="3"><v>1250.5</v></c><c r="D2" t="str"><v>a&amp;b</v></c></row><row r="3"/><row r="4"><c r="A4" t="b"><v>1</v></c><c r="B4" s="4"><v>0.5</v></c></row></sheetData></worksheet>',
  'xl/worksheets/sheet2.xml': '<worksheet><sheetData/></worksheet>',
  'xl/worksheets/sheet3.xml': '<worksheet><sheetData><row r="1"><c r="B1"><v>42</v></c></row></sheetData></worksheet>'
};

describe('xlsx to text', () => {
  it('reads sheets in order, with shared strings, gaps, numbers, dates and times', async () => {
    const text = await xlsxToText(zip(workbook));
    expect(text).toBe([
      '# Sayfa: Mesai & İzin',
      'Ad\tTarih\t\tNot',
      'Ümit ALGAN\t2026-10-30\t1250.5\ta&b',
      'DOĞRU\t12:00',
      '',
      '# Sayfa: Özet',
      '\t42'
    ].join('\n'));
  });

  it('reads uncompressed entries too', async () => {
    expect(await xlsxToText(zip(workbook, { store: true }))).toContain('Ümit ALGAN');
  });

  it('does not mistake a number format with text for a date', async () => {
    expect(await xlsxToText(zip(workbook))).toContain('1250.5');
  });

  it('turns serial dates into readable ones', () => {
    expect(excelDate(46325)).toBe('2026-10-30');
    expect(excelDate(46325.5)).toBe('2026-10-30 12:00');
    expect(excelDate(0.75)).toBe('18:00');
  });

  it('tells running totals from clock times and dates', () => {
    expect(formatKind('[h]:mm')).toBe('elapsed');
    expect(formatKind('[hh]:mm:ss')).toBe('elapsed');
    expect(formatKind('hh:mm')).toBe('time');
    expect(formatKind('dd\\.mm\\.yyyy')).toBe('date');
    expect(formatKind('[Red]0.00')).toBeNull();
    expect(formatKind('#,##0.00" TL"')).toBeNull();
    expect(excelElapsed(1.0625)).toBe('25:30');
    expect(excelElapsed(0.9375)).toBe('22:30');
    expect(excelElapsed(5)).toBe('120:00');
  });

  it('shows a total over 24 hours as hours, never as a date in 1899', async () => {
    const text = await xlsxToText(zip({
      ...workbook,
      'xl/styles.xml': '<styleSheet><numFmts><numFmt numFmtId="170" formatCode="[h]:mm"/><numFmt numFmtId="171" formatCode="hh:mm"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="170"/><xf numFmtId="171"/></cellXfs></styleSheet>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1" s="1"><v>1.0625</v></c><c r="B1" s="2"><v>0.75</v></c></row></sheetData></worksheet>'
    }));
    expect(text).toContain('25:30\t18:00');
    expect(text).not.toContain('1899');
  });

  it('refuses what is not an xlsx, in Turkish', async () => {
    await expect(xlsxToText(new TextEncoder().encode('düz metin'))).rejects.toThrow(XlsxError);
    await expect(xlsxToText(zip({ 'a.xml': '<a/>' }))).rejects.toThrow('geçerli');
  });

  it('refuses a zip bomb from its claimed size, before inflating', async () => {
    const bytes = zip({ 'a.xml': 'x' });
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const central = bytes.length - 22 - 46 - 'a.xml'.length;
    view.setUint32(central + 24, 200 * 1024 * 1024, true);
    let inflated = false;
    await expect(readZip(bytes, async () => { inflated = true; return new Uint8Array(); })).rejects.toThrow('büyük');
    expect(inflated).toBe(false);
  });

  it('refuses a zip bomb that lies about its size', async () => {
    await expect(readZip(zip({ 'a.xml': 'x' }), async () => new Uint8Array(65 * 1024 * 1024))).rejects.toThrow('büyük');
  });
});
