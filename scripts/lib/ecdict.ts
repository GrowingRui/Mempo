// Loader for ECDICT (https://github.com/skywind3000/ECDICT, MIT licence).
// Expects data/dict/ecdict.csv, which `npm run data:fetch-dicts` downloads.

import fs from 'node:fs';

export interface EcdictEntry {
  word: string;
  phonetic: string;
  definition: string;
  translation: string;
  pos: string;
  collins: string;
  oxford: string;
  tag: string;
  bnc: string;
  frq: string;
  /** e.g. "0:access/1:dp" -> { '0': 'access', '1': 'dp' } */
  exchange: Record<string, string>;
}

export const ECDICT_PATH = 'data/dict/ecdict.csv';

/** Minimal RFC-4180 CSV parser (quoted fields may contain commas, quotes and newlines). */
function* parseCsv(text: string): Generator<string[]> {
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      yield row;
      row = [];
      field = '';
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

function parseExchange(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of s.split('/')) {
    const idx = part.indexOf(':');
    if (idx > 0) out[part.slice(0, idx)] = part.slice(idx + 1);
  }
  return out;
}

/**
 * Load ECDICT into a Map keyed by lowercase word.
 * Pass `only` to keep just the words you need (saves a lot of memory).
 */
export function loadEcdict(only?: Set<string>): Map<string, EcdictEntry> {
  if (!fs.existsSync(ECDICT_PATH)) {
    throw new Error(`${ECDICT_PATH} not found. Run: npm run data:fetch-dicts`);
  }
  const text = fs.readFileSync(ECDICT_PATH, 'utf8');
  const map = new Map<string, EcdictEntry>();
  let header = true;
  for (const r of parseCsv(text)) {
    if (header) {
      header = false;
      continue;
    }
    const key = (r[0] ?? '').toLowerCase();
    if (!key || (only && !only.has(key))) continue;
    // ECDICT has some case variants (e.g. "Access" and "access"); prefer the lowercase headword.
    if (map.has(key) && r[0] !== key) continue;
    map.set(key, {
      word: r[0],
      phonetic: r[1] ?? '',
      definition: (r[2] ?? '').replace(/\\n/g, '\n'),
      translation: (r[3] ?? '').replace(/\\n/g, '\n'),
      pos: r[4] ?? '',
      collins: r[5] ?? '',
      oxford: r[6] ?? '',
      tag: r[7] ?? '',
      bnc: r[8] ?? '',
      frq: r[9] ?? '',
      exchange: parseExchange(r[10] ?? ''),
    });
  }
  return map;
}
