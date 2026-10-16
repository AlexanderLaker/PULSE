/**
 * CSV export shared by the views: RFC 4180 rows (fields quoted where they
 * hold a comma, a quote or a line break, quotes doubled, CRLF line ends) and
 * a download of a text as a file. The callers pass the figures already
 * formatted with lib/format.ts, so an export shows what the screen shows.
 */

/** One field, quoted when RFC 4180 requires it. */
export function csvField(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A free-text field (a driver's name, a search) made safe for a spreadsheet:
 * a cell that starts with =, +, -, @, a tab or a carriage return would open
 * as a formula in Excel or Sheets, so such a text gets a leading apostrophe,
 * which those programs show as text. The formatted figures ("+1.2%") do not
 * pass through here: they are numbers to a spreadsheet and should stay so.
 */
export function csvText(value: string | null | undefined): string {
  const text = value ?? '';
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** One row as a line, without its line end. */
export function csvLine(fields: ReadonlyArray<string | number | null | undefined>): string {
  return fields.map(csvField).join(',');
}

/**
 * A table as CSV: an optional preamble (rows of notes before the table,
 * separated from it by an empty row), the header, then the rows. Every line
 * ends in CRLF, the last one included.
 */
export function rowsToCsv(header: string[], rows: string[][], preamble: string[][] = []): string {
  const lines = [
    ...preamble.map(csvLine),
    ...(preamble.length ? [''] : []),
    csvLine(header),
    ...rows.map(csvLine),
  ];
  return `${lines.join('\r\n')}\r\n`;
}

/** Several tables in one file, each with its header, separated by an empty row. */
export function tablesToCsv(preamble: string[][], tables: Array<{ header: string[]; rows: string[][] }>): string {
  const blocks = tables.map((t) => [csvLine(t.header), ...t.rows.map(csvLine)].join('\r\n'));
  const head = preamble.length ? `${preamble.map(csvLine).join('\r\n')}\r\n\r\n` : '';
  return `${head}${blocks.join('\r\n\r\n')}\r\n`;
}

/** A file name from a title: letters, digits, dots and dashes, nothing else. */
export function safeFilename(title: string, extension: string): string {
  const stem = title.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  return `${stem || 'export'}.${extension}`;
}

/**
 * Downloads a text as a file through a temporary link. A CSV gets a UTF-8
 * byte-order mark, so a spreadsheet opens its percent signs and dashes as
 * they are. Returns false where the browser offers no object URLs.
 */
export function downloadText(filename: string, text: string, mime = 'text/csv;charset=utf-8'): boolean {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return false;
  const body = mime.startsWith('text/csv') && !text.startsWith('﻿') ? `﻿${text}` : text;
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // After the click has been dispatched; revoking at once can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return true;
}
