// Turns an Excel .xlsx into plain text the model can read, in the browser and without a library:
// an .xlsx is a zip of XML files, and the platform can already inflate. The result is uploaded like
// any other text attachment, so the file itself never leaves this device.

const MAX_INFLATED_BYTES = 64 * 1024 * 1024;
const MAX_ROWS_PER_SHEET = 20_000;
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;
// Excel's built-in formats that show a number as a date, a time of day, or a running total of time.
const BUILTIN_FORMATS: Readonly<Record<number, TimeKind>> = Object.freeze({ 14: 'date', 15: 'date', 16: 'date', 17: 'date', 22: 'date', 18: 'time', 19: 'time', 20: 'time', 21: 'time', 45: 'time', 47: 'time', 46: 'elapsed' });

type Inflate = (bytes: Uint8Array) => Promise<Uint8Array>;
type TimeKind = 'date' | 'time' | 'elapsed';

export class XlsxError extends Error {}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Lists the entries of a zip from its central directory, which is the only reliable index. */
export async function readZip(bytes: Uint8Array, inflate: Inflate = inflateRaw): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 65_557); at -= 1) {
    if (view.getUint32(at, true) === 0x06054b50) { end = at; break; }
  }
  if (end < 0) throw new XlsxError('Bu dosya geçerli bir .xlsx değil.');
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Uint8Array>();
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) throw new XlsxError('Bu dosya bozuk görünüyor.');
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!/\.(xml|rels)$/i.test(name)) continue;
    // A zip can claim a tiny size and unpack to gigabytes; both the claim and the result are checked.
    total += size;
    if (total > MAX_INFLATED_BYTES) throw new XlsxError('Bu Excel dosyası okunamayacak kadar büyük.');
    const dataStart = offset + 30 + view.getUint16(offset + 26, true) + view.getUint16(offset + 28, true);
    const raw = bytes.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0 ? raw : method === 8 ? await inflate(raw) : null;
    if (!content) throw new XlsxError('Bu Excel dosyasının sıkıştırması desteklenmiyor.');
    if (content.length > MAX_INFLATED_BYTES) throw new XlsxError('Bu Excel dosyası okunamayacak kadar büyük.');
    files.set(name, content);
  }
  return files;
}

function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === 'amp') return '&';
    if (lower === 'lt') return '<';
    if (lower === 'gt') return '>';
    if (lower === 'quot') return '"';
    if (lower === 'apos') return "'";
    const code = lower.startsWith('#x') ? parseInt(lower.slice(2), 16) : parseInt(lower.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

const attribute = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? '';
const textRuns = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]!)).join('');

function columnIndex(reference: string): number {
  let index = 0;
  for (const letter of reference.replace(/\d+$/, '')) index = index * 26 + letter.toUpperCase().charCodeAt(0) - 64;
  return index - 1;
}

/** What a custom number format shows. [h]:mm is a running total, the rest of its kind are clock or calendar. */
export function formatKind(formatCode: string): TimeKind | null {
  const quoted = formatCode.replace(/"[^"]*"|\\./g, '');
  if (/\[(h+|m+|s+)\]/i.test(quoted)) return 'elapsed';
  // Date codes use y, m, d or h outside quoted text and [colour] sections; "0.00" and "#,##0" do not.
  const code = quoted.replace(/\[[^\]]*\]/g, '');
  if (/[yd]/i.test(code)) return 'date';
  if (/[hs]/i.test(code)) return 'time';
  return /m/i.test(code) ? 'date' : null;
}

/** Which cell styles show a number as a date or a time, by style index. */
function timeStyles(xml: string): ReadonlyMap<number, TimeKind> {
  const custom = new Map<number, TimeKind>();
  for (const match of xml.matchAll(/<numFmt\b[^>]*>/g)) {
    const kind = formatKind(decodeXml(attribute(match[0], 'formatCode')));
    if (kind) custom.set(Number(attribute(match[0], 'numFmtId')), kind);
  }
  const styles = new Map<number, TimeKind>();
  const section = /<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml)?.[1] ?? '';
  [...section.matchAll(/<xf\b[^>]*>/g)].forEach((match, index) => {
    const format = Number(attribute(match[0], 'numFmtId'));
    const kind = BUILTIN_FORMATS[format] ?? custom.get(format);
    if (kind) styles.set(index, kind);
  });
  return styles;
}

/** 1.0625 days of [h]:mm reads 25:30, however long the total grows. */
export function excelElapsed(serial: number): string {
  const minutes = Math.round(Math.abs(serial) * 1440);
  const text = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  return serial < 0 ? `-${text}` : text;
}

export function excelDate(serial: number): string {
  const whole = new Date(EXCEL_EPOCH_MS + Math.round(serial * DAY_MS)).toISOString();
  if (serial < 1) return whole.slice(11, 16); // only a time of day
  return Number.isInteger(serial) ? whole.slice(0, 10) : `${whole.slice(0, 10)} ${whole.slice(11, 16)}`;
}

function timeText(serial: number, kind: TimeKind): string {
  if (kind === 'elapsed') return excelElapsed(serial);
  return kind === 'time' ? excelDate(serial - Math.floor(serial)) : excelDate(serial);
}

function sheetRows(xml: string, shared: readonly string[], styles: ReadonlyMap<number, TimeKind>): { rows: string[]; truncated: boolean } {
  const rows: string[] = [];
  let truncated = false;
  for (const rowMatch of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    if (rows.length >= MAX_ROWS_PER_SHEET) { truncated = true; break; }
    const cells: string[] = [];
    for (const cell of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = cell[1] ?? '';
      const body = cell[2] ?? '';
      const type = attribute(head, 't');
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '';
      let value = '';
      if (type === 's') value = shared[Number(raw)] ?? '';
      else if (type === 'inlineStr') value = textRuns(body);
      else if (type === 'str' || type === 'e') value = decodeXml(raw);
      else if (type === 'b') value = raw === '1' ? 'DOĞRU' : 'YANLIŞ';
      else if (raw !== '') {
        const kind = styles.get(Number(attribute(head, 's')));
        value = kind && Number.isFinite(Number(raw)) ? timeText(Number(raw), kind) : raw;
      }
      const column = attribute(head, 'r') ? columnIndex(attribute(head, 'r')) : cells.length;
      cells[column] = value.replace(/[\t\r\n]+/g, ' ').trim();
    }
    const line = Array.from(cells, (value) => value ?? '').join('\t').trimEnd();
    if (line) rows.push(line);
  }
  return { rows, truncated };
}

/** Sheet by sheet, tab separated, in the order the workbook shows them. */
export async function xlsxToText(bytes: Uint8Array, inflate: Inflate = inflateRaw): Promise<string> {
  const files = await readZip(bytes, inflate);
  const decoder = new TextDecoder();
  const read = (name: string) => { const file = files.get(name); return file ? decoder.decode(file) : ''; };
  const workbook = read('xl/workbook.xml');
  if (!workbook) throw new XlsxError('Bu dosya geçerli bir .xlsx değil.');
  const shared = [...read('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => textRuns(match[1]!));
  const styles = timeStyles(read('xl/styles.xml'));
  const targets = new Map([...read('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((match) => [attribute(match[0], 'Id'), attribute(match[0], 'Target')] as const));
  const parts: string[] = [];
  for (const match of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const target = targets.get(attribute(match[0], 'r:id')) ?? '';
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
    const { rows, truncated } = sheetRows(read(path), shared, styles);
    if (!rows.length) continue;
    parts.push(`# Sayfa: ${decodeXml(attribute(match[0], 'name'))}\n${rows.join('\n')}${truncated ? `\n[Bu sayfanın yalnızca ilk ${MAX_ROWS_PER_SHEET} satırı eklendi.]` : ''}`);
  }
  return parts.join('\n\n');
}
