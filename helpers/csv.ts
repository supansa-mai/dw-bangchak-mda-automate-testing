import { readFile } from 'fs/promises';
import type { Download } from '@playwright/test';

/** File for `setInputFiles`, made in memory so each test builds the exact rows it needs */
export type FilePayload = { name: string; mimeType: string; buffer: Buffer };

const quote = (cell: string) => (/[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);

export function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(quote).join(',')).join('\r\n');
}

/** `bom: true` = how Excel saves "CSV UTF-8", which keeps Thai readable */
export function csvFile(name: string, rows: string[][], { bom = false } = {}): FilePayload {
  return { name, mimeType: 'text/csv', buffer: Buffer.from(`${bom ? '\uFEFF' : ''}${toCsv(rows)}`, 'utf8') };
}

export async function readDownload(download: Download) {
  return readFile(await download.path());
}

/** Rows as objects keyed by the header; quoted cells may hold commas, quotes ("") and line breaks */
export function parseCsv(buffer: Buffer) {
  const text = buffer
    .toString('utf8')
    .replace(/^\uFEFF/, '')
    .trim();
  const rows: string[][] = [[]];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      rows[rows.length - 1].push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      rows[rows.length - 1].push(cell);
      cell = '';
      rows.push([]);
    } else cell += char;
  }
  rows[rows.length - 1].push(cell);
  const [header, ...lines] = rows;
  return {
    header,
    records: lines.map((cells) => Object.fromEntries(header.map((name, i) => [name, cells[i]]))),
  };
}
