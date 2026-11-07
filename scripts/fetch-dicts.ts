// Downloads the free dictionary files used by the build-time data pipeline into data/dict.
// They are large and git-ignored.
//
//   npm run data:fetch-dicts               # skip files that already exist
//   npm run data:fetch-dicts -- --refresh  # download everything again
//
// Files:
//   ecdict.csv           ECDICT (MIT): English -> Chinese, part of speech, inflections.
//   kaikki-es.jsonl      English Wiktionary via kaikki.org (CC BY-SA), cut down to just the
//                        Spanish translations (the dump is 534 MB gzipped and is deleted after).
//   kaikki-es-reverse.jsonl  Spanish entries of English Wiktionary with their English glosses,
//                        a fallback for words with no Spanish translation table (102 MB dump).
//   es-freq.txt          The 50,000 most common Spanish words with counts (FrequencyWords, from
//                        OpenSubtitles, CC BY-SA 4.0). Ranks Spanish translations; not shipped.
//   tatoeba-eng.tsv      Tatoeba English sentences (CC BY 2.0 FR): id <TAB> lang <TAB> text.
//                        Needs `bzip2` on the PATH (included with Git for Windows, macOS, Linux).

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import zlib from 'node:zlib';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const DIR = 'data/dict';
const refresh = process.argv.includes('--refresh');

async function open(url: string): Promise<Readable> {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  return Readable.fromWeb(res.body as any);
}

/**
 * Download to a file and check the byte count. Long streamed downloads can end early
 * without an error (seen with the 534 MB kaikki dump), so never trust them unchecked.
 */
async function download(url: string, file: string) {
  console.log(`Downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body as any), fs.createWriteStream(file));
  // Content-Length is the compressed size when the server gzips the response.
  const expected = res.headers.get('content-encoding') ? 0 : Number(res.headers.get('content-length'));
  const got = fs.statSync(file).size;
  if (expected && got !== expected) throw new Error(`${url}: got ${got} of ${expected} bytes; run again`);
}

/** Write to a temp file and rename at the end, so an interrupted download never looks finished. */
async function build(name: string, make: (tmp: string) => Promise<void>) {
  const file = `${DIR}/${name}`;
  if (fs.existsSync(file) && !refresh) {
    console.log(`${file} already exists (use --refresh to re-download)`);
    return;
  }
  const tmp = `${file}.part`;
  await make(tmp);
  fs.renameSync(tmp, file);
  console.log(`Saved ${file} (${(fs.statSync(file).size / 1e6).toFixed(1)} MB)`);
}

fs.mkdirSync(DIR, { recursive: true });

await build('ecdict.csv', (tmp) => download('https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv', tmp));

await build('es-freq.txt', (tmp) =>
  download('https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt', tmp),
);

await build('tatoeba-eng.tsv', async (tmp) => {
  const bz = spawn('bzip2', ['-dc'], { stdio: ['pipe', 'pipe', 'inherit'] });
  const exited = new Promise<void>((resolve, reject) => {
    bz.on('error', (e) => reject(new Error(`Could not run bzip2 (${e.message}). Install it or run this from Git Bash.`)));
    bz.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`bzip2 exited with ${code}`))));
  });
  const src = await open('https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2');
  await Promise.all([pipeline(src, bz.stdin), pipeline(bz.stdout, fs.createWriteStream(tmp)), exited]);
});

/**
 * Download a kaikki.org dump (gzipped JSON lines), keep what `pick` returns for each entry,
 * and delete the dump afterwards: only the small filtered file is needed.
 */
async function kaikkiSlice(tmp: string, url: string, minEntries: number, pick: (e: any) => object | undefined) {
  const gz = `${DIR}/${path.basename(url)}`;
  if (!fs.existsSync(gz)) {
    await download(url, `${gz}.part`);
    fs.renameSync(`${gz}.part`, gz);
  }
  console.log(`Filtering ${gz}`);
  const src = fs.createReadStream(gz).pipe(zlib.createGunzip());
  const out = fs.createWriteStream(tmp);
  let seen = 0;
  let kept = 0;
  for await (const line of readline.createInterface({ input: src, crlfDelay: Infinity })) {
    if (!line) continue;
    if (++seen % 200000 === 0) console.log(`  ${seen} entries read, ${kept} kept`);
    const rec = pick(JSON.parse(line));
    if (rec) {
      kept++;
      if (!out.write(JSON.stringify(rec) + '\n')) await new Promise((r) => out.once('drain', r));
    }
  }
  await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  console.log(`  ${seen} entries read, ${kept} kept`);
  if (seen < minEntries) throw new Error(`Only ${seen} entries read; the download looks incomplete. Delete ${gz} and run again.`);
  fs.rmSync(gz);
}

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

// English entries -> their Spanish translations. Each line:
//   {"word":"access","pos":"noun","es":[{"word":"acceso","sense":"..."}]}
// or, for alternative spellings without translations of their own (lookups follow these):
//   {"word":"utilise","pos":"verb","alt":["utilize"]}
await build('kaikki-es.jsonl', (tmp) =>
  kaikkiSlice(tmp, 'https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl.gz', 1_000_000, (e) => {
    // In the dump, translations sit on each sense; older exports put them on the entry.
    const all = [...(e.translations ?? []), ...(e.senses ?? []).flatMap((s: any) => s.translations ?? [])];
    const es = all
      .filter((t: any) => (t.lang_code ?? t.code) === 'es' && t.word)
      .map((t: any) => ({ word: t.word, ...(t.sense ? { sense: t.sense } : {}), ...(t.tags?.length ? { tags: t.tags } : {}) }));
    if (es.length) return { word: e.word, pos: e.pos, es };
    const alt = uniq((e.senses ?? []).flatMap((s: any) => (s.alt_of ?? []).map((a: any) => a.word)).filter(Boolean));
    if (alt.length) return { word: e.word, pos: e.pos, alt };
  }),
);

// Spanish entries with their English glosses, for words whose English entry has no Spanish
// translation table (e.g. "conceal"): "ocultar" is glossed "to hide, conceal". Each line:
//   {"word":"ocultar","pos":"verb","glosses":["to hide, conceal"]}
// Inflected forms ("ocultó") and alternative spellings are skipped.
await build('kaikki-es-reverse.jsonl', (tmp) =>
  kaikkiSlice(tmp, 'https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl.gz', 300_000, (e) => {
    const glosses = (e.senses ?? [])
      .filter((s: any) => !s.form_of && !s.alt_of && !(s.tags ?? []).some((t: string) => /form-of|alt-of|obsolete|archaic/.test(t)))
      .flatMap((s: any) => s.glosses?.slice(-1) ?? []);
    if (glosses.length) return { word: e.word, pos: e.pos, glosses };
  }),
);
