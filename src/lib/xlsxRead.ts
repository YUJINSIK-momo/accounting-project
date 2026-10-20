// 은행 결과 파일 읽기 — .xlsx(첫 시트) 와 .csv(UTF-8 · EUC-KR) 를 행 배열로 바꾼다
import { strFromU8, unzipSync } from 'fflate';

type Cell = string | number;

function colIndex(ref: string) {
  const letters = ref.replace(/\d/g, '');
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

export function readXlsx(buf: ArrayBuffer): Cell[][] {
  const files = unzipSync(new Uint8Array(buf));
  const xml = (path: string) => (files[path] ? new DOMParser().parseFromString(strFromU8(files[path]), 'application/xml') : null);
  const shared = xml('xl/sharedStrings.xml');
  const strings = shared ? Array.from(shared.getElementsByTagName('si')).map((si) => Array.from(si.getElementsByTagName('t')).map((t) => t.textContent ?? '').join('')) : [];
  // 첫 시트 경로는 workbook 관계에서 찾는다. 없으면 sheet1
  const rels = xml('xl/_rels/workbook.xml.rels');
  const wb = xml('xl/workbook.xml');
  const firstRid = wb?.getElementsByTagName('sheet')[0]?.getAttribute('r:id');
  const target = rels && firstRid ? Array.from(rels.getElementsByTagName('Relationship')).find((r) => r.getAttribute('Id') === firstRid)?.getAttribute('Target') : null;
  const sheetPath = target ? `xl/${target.replace(/^\/?xl\//, '')}` : 'xl/worksheets/sheet1.xml';
  const sheet = xml(sheetPath);
  if (!sheet) throw new Error('시트를 찾지 못했습니다');
  return Array.from(sheet.getElementsByTagName('row')).map((row) => {
    const out: Cell[] = [];
    for (const c of Array.from(row.getElementsByTagName('c'))) {
      const idx = colIndex(c.getAttribute('r') ?? 'A1');
      const t = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const value: Cell = t === 's' ? strings[Number(v)] ?? '' : t === 'inlineStr' ? c.getElementsByTagName('t')[0]?.textContent ?? '' : v !== '' && !Number.isNaN(Number(v)) ? Number(v) : v;
      out[idx] = value;
    }
    return Array.from(out, (x) => x ?? '');
  });
}

function parseCsv(text: string): Cell[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

export async function readTableFile(file: File): Promise<Cell[][]> {
  const buf = await file.arrayBuffer();
  if (/\.xlsx$/i.test(file.name)) return readXlsx(buf);
  if (/\.csv$/i.test(file.name) || file.type === 'text/csv') {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('euc-kr').decode(buf); // 은행 CSV 는 EUC-KR 이 많다
    return parseCsv(text.replace(/^﻿/, ''));
  }
  throw new Error('.xlsx 또는 .csv 파일만 읽을 수 있습니다 (.xls 는 엑셀에서 .xlsx 로 저장해 주세요)');
}
