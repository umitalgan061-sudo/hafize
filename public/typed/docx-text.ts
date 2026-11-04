// Turns a Word .docx into plain text the model can read, in the browser and without a library, the same way
// xlsx-text.ts reads a workbook: a .docx is a zip whose word/document.xml holds the text. Paragraphs become lines,
// table cells are separated by tabs, and the file itself never leaves this device.
import { readZip } from './xlsx-text.ts';

export class DocxError extends Error {}

const ENTITIES: Readonly<Record<string, string>> = Object.freeze({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" });
const unescape = (text: string): string => text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_match, name: string) => {
  if (name[0] === '#') return String.fromCodePoint(name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10));
  return ENTITIES[name.toLowerCase()] ?? '';
});

/** The text of a WordprocessingML body: runs joined, paragraphs on their own lines, cells split by tabs. */
export function documentXmlToText(xml: string): string {
  return unescape(xml
    // A cell's last paragraph ends with the cell, so a table row stays on one line.
    .replace(/<\/w:p>\s*<\/w:tc>/g, '</w:tc>')
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n')
    .replace(/<\/w:tc>/g, '\t')
    .replace(/<\/w:(?:p|tr)>/g, '\n')
    .replace(/<[^>]+>/g, ''))
    .replace(/\t+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The text of a PowerPoint .pptx, slide by slide in their order. */
export async function pptxToText(bytes: Uint8Array, inflate?: (bytes: Uint8Array) => Promise<Uint8Array>): Promise<string> {
  let entries: Map<string, Uint8Array>;
  try { entries = await readZip(bytes, inflate); } catch { throw new DocxError('Bu dosya geçerli bir .pptx değil.'); }
  const slides = [...entries.keys()].filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/\d+/g)?.pop()) - Number(b.match(/\d+/g)?.pop()));
  if (!slides.length) throw new DocxError('Bu dosya geçerli bir .pptx değil.');
  return slides.map((name, index) => {
    const xml = new TextDecoder().decode(entries.get(name));
    const text = unescape(xml.replace(/<\/a:p>/g, '\n').replace(/<[^>]+>/g, '')).replace(/\n{2,}/g, '\n').trim();
    return `[Slayt ${index + 1}]\n${text}`;
  }).join('\n\n');
}

/** The names and sizes inside a zip, read from its directory without unpacking anything. */
export function zipListing(bytes: Uint8Array): string {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at -= 1) if (view.getUint32(at, true) === 0x06054b50) { end = at; break; }
  if (end < 0) throw new DocxError('Bu dosya geçerli bir zip değil.');
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const lines: string[] = [];
  for (let index = 0; index < count && cursor + 46 <= bytes.length; index += 1) {
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    lines.push(`${name}${name.endsWith('/') ? '' : ` (${size} bayt)`}`);
    cursor += 46 + nameLength + view.getUint16(cursor + 30, true) + view.getUint16(cursor + 32, true);
  }
  return `${count} öğe:\n${lines.join('\n')}`;
}

export async function docxToText(bytes: Uint8Array, inflate?: (bytes: Uint8Array) => Promise<Uint8Array>): Promise<string> {
  let entries: Map<string, Uint8Array>;
  try { entries = await readZip(bytes, inflate); } catch { throw new DocxError('Bu dosya geçerli bir .docx değil.'); }
  const body = entries.get('word/document.xml');
  if (!body) throw new DocxError('Bu dosya geçerli bir .docx değil.');
  return documentXmlToText(new TextDecoder().decode(body));
}
