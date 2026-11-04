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

export async function docxToText(bytes: Uint8Array, inflate?: (bytes: Uint8Array) => Promise<Uint8Array>): Promise<string> {
  let entries: Map<string, Uint8Array>;
  try { entries = await readZip(bytes, inflate); } catch { throw new DocxError('Bu dosya geçerli bir .docx değil.'); }
  const body = entries.get('word/document.xml');
  if (!body) throw new DocxError('Bu dosya geçerli bir .docx değil.');
  return documentXmlToText(new TextDecoder().decode(body));
}
