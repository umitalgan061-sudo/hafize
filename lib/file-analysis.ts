export function parseCsv(source: string, delimiter: string): string[][] {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  function finishRow() {
    row.push(field);
    if (row.some(cell => cell.trim() !== '')) rows.push(row);
    row = []; field = ''; closed = false;
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (text[i+1] === '"') { field += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (ch === delimiter) {
      row.push(field); field = ''; closed = false;
    } else if (ch === '\n') finishRow();
    else if (ch === '"' && !field && !closed) quoted = true;
    else if (closed || ch === '"') throw Error('CSV tırnakları geçersiz.');
    else field += ch;
    if (row.length > 512 || rows.length > 50000) throw Error('Sınır 512 sütun ve 50.000 veri satırı.');
  }
  if (quoted) throw Error('Kapatılmamış CSV alanı.');
  finishRow();
  if (rows.length<2) throw Error('Başlık ve en az bir veri satırı gerekli.');
  const width = rows[0]!.length;
  if (rows.some(r => r.length !== width)) throw Error('Satırların sütun sayısı farklı. Ayırıcıyı kontrol et.');
  return rows;
}

export function groupValues(rows: string[][], key: number, column: number, comma: boolean) {
  const groups = new Map<string, {count:number; total:number}>();
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const raw = row[column]!.trim();
    const normalized = comma ? raw.replace(',', '.') : raw;
    if ((comma && raw.includes('.')) || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(normalized) || !Number.isFinite(Number(normalized))) { skipped++; continue; }
    const label = row[key]!.trim();
    const item = groups.get(label) || {count:0,total:0};
    item.count++; item.total += Number(normalized);
    if (!Number.isFinite(item.total)) throw Error('Toplam, sayı aralığını aştı.');
    groups.set(label,item);
  }
  return { groups:[...groups].sort((a,b)=>b[1].total-a[1].total), skipped };
}

export function inspectPatch(source: string) {
  const files: {path:string; added:number; removed:number; notes:string[]}[] = [];
  let file: typeof files[number] | undefined, next=0, oldLeft=0, newLeft=0;
  let previousPath='';
  for (const line of source.replace(/\r\n?/g,'\n').split('\n')) {
    if (!oldLeft && !newLeft && line.startsWith('--- ')) { previousPath=line.slice(4).split('\t')[0]!.replace(/^a\//,''); continue; }
    if (line.startsWith('diff --git ')) { file=undefined; oldLeft=0; newLeft=0; continue; }
    if (oldLeft===0 && newLeft===0 && line.startsWith('+++ ')) {
      const target=line.slice(4).split('\t')[0]!;
      file={path:target==='/dev/null' ? previousPath : target.replace(/^b\//,''), added:0, removed:0, notes:[]};
      files.push(file); continue;
    }
    const hunk=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file) {
      oldLeft=Number(hunk[2]??1); next=Number(hunk[3]); newLeft=Number(hunk[4]??1); continue;
    }
    if (!file || (!oldLeft && !newLeft)) continue;
    if (line.startsWith('+') && newLeft>0) {
      file.added++;
      if (/\b(?:TODO|FIXME)\b/.test(line) && file.notes.length<25) file.notes.push('L'+next+' '+line.slice(1,181).trim());
      next++; newLeft--;
    } else if (line.startsWith('-') && oldLeft>0) { file.removed++; oldLeft--; }
    else if (line.startsWith(' ') && oldLeft>0 && newLeft>0) { next++; oldLeft--; newLeft--; }
  }
  if (!files.length) throw Error('Birleşik diff biçiminde metinsel bir yama seç.');
  return files;
}
