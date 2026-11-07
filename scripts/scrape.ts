// Phase 0: scrape the B2 / C1 / C2 word lists from minddory.com, clean them up,
// and write data/raw.json plus a human-readable report.
//
//   npm run data:scrape              # uses cached HTML in data/cache if present
//   npm run data:scrape -- --refresh # re-download the pages
//
// Clean-up rules:
//   1. Spelling variants ("harbor/harbour", "last minute" + "last-minute") become one entry:
//      word + variants.
//   2. Pure inflections (accessed, accesses, accessing) whose lemma is also on the list
//      are merged into the base card as `forms`. ECDICT decides what counts as a "pure
//      inflection": its lemma field must point at the base AND its Chinese gloss must be
//      only an inflection pointer ("access的过去式"). Words with their own meaning
//      (thrilled, savings, willing, accommodating) stay as separate cards.
//      Derived words (abandonment, abruptly) are different words and always stay separate.
//      Words ECDICT does not know (minimalised, refocusses) use plain suffix rules instead
//      (guessInflection), matched only against bases that are on the list.
//   3. Words listed in more than one level keep the lowest level (none found as of 2026-11-07).

import fs from 'node:fs';
import path from 'node:path';
import { loadEcdict, type EcdictEntry } from './lib/ecdict.ts';
import { KEEP_SEPARATE, MERGE } from './overrides.ts';

type Level = 'B2' | 'C1' | 'C2';

const SOURCES: { level: Level; slug: string }[] = [
  { level: 'B2', slug: 'fce' },
  { level: 'C1', slug: 'cae' },
  { level: 'C2', slug: 'cpe' },
];
const BASE_URL = 'https://minddory.com/english-vocabulary-list/';
const CACHE_DIR = 'data/cache';
const OUT_FILE = 'data/raw.json';
const REPORT_FILE = 'data/reports/phase0.md';
const LEVEL_RANK: Record<Level, number> = { B2: 0, C1: 1, C2: 2 };

export interface Example {
  text: string;
  /** Attribution URL (e.g. a Tatoeba sentence, CC BY). */
  source?: string;
  /** Set when the example came from a merged inflected form, e.g. "accessed". */
  form?: string;
}

export interface RawWord {
  /** Stable id derived from the headword, e.g. "carbon-dioxide". */
  id: string;
  word: string;
  level: Level;
  /** Alternative spellings, e.g. harbor -> ["harbour"]. */
  variants?: string[];
  /** Inflected forms merged into this card, e.g. access -> ["accessed", "accesses"]. */
  forms?: string[];
  examples: Example[];
}

interface Scraped {
  spellings: string[]; // first is the headword
  level: Level;
  example?: Example;
}

// ---------------------------------------------------------------- fetch + parse

async function getHtml(slug: string, refresh: boolean): Promise<string> {
  const file = path.join(CACHE_DIR, `${slug}.html`);
  if (!refresh && fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  const url = BASE_URL + slug;
  console.log(`Downloading ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mempo word-list builder (personal use)' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const html = await res.text();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(file, html);
  return html;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

const clean = (s: string) => decodeEntities(s).replace(/\s+/g, ' ').trim();

/** Each entry looks like: <li>word <span>B2</span> <q cite="https://tatoeba...">Example.</q></li> */
const ENTRY_RE = /<li>([^<]+?)\s*<span>(B2|C1|C2)<\/span>\s*(?:<q(?:\s+cite="([^"]*)")?>([\s\S]*?)<\/q>)?\s*<\/li>/g;

function parsePage(html: string, expected: Level): Scraped[] {
  const out: Scraped[] = [];
  for (const m of html.matchAll(ENTRY_RE)) {
    const level = m[2] as Level;
    if (level !== expected) throw new Error(`Unexpected level ${level} on ${expected} page`);
    const spellings = clean(m[1]).split('/').map((s) => s.trim()).filter(Boolean);
    const text = m[4] !== undefined ? clean(m[4].replace(/<[^>]+>/g, '')) : '';
    out.push({
      spellings,
      level,
      example: text ? { text, ...(m[3] ? { source: decodeEntities(m[3]) } : {}) } : undefined,
    });
  }
  // Sanity check against the "The list (N words)" heading.
  const stated = html.match(/The list \((\d+) words\)/);
  if (stated && Number(stated[1]) !== out.length) {
    throw new Error(`${expected}: page says ${stated[1]} words but ${out.length} were parsed`);
  }
  if (out.length === 0) throw new Error(`${expected}: no entries parsed; did the page layout change?`);
  return out;
}

// ---------------------------------------------------------------- clean-up

const slugify = (w: string) =>
  w
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Key under which spelling variants meet: ignores case, hyphens and spaces, and maps British
 * -ise/-yse to -ize/-yze. So "co-ordinate" = "coordinate", "last minute" = "last-minute",
 * "utilised" = "utilized". A false match ("promise" -> "promize") only matters if both
 * spellings are on the list, which none are.
 */
const foldKey = (w: string) =>
  w
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z]+/g, '')
    .replace(/([iy])s(e|ed|es|ing|ation|ations|er|ers|able|ably|ingly|ement)$/, '$1z$2');

const INFLECTION_POINTER = /(过去式|过去时|过去分词|现在分词|ing形式|复数|第三人称)/;
/** "v. ...", "vt. ...", "vt.& vi. ..." */
const VERB_LINE = /^(v|vt|vi|aux)\.(\s*&\s*(vt|vi)\.)?\s*/;
/** Any part-of-speech line: "a. ...", "n. ...", "prep. ...", "vt.& vi. ..." */
const POS_LINE = /^[a-z]+\.(\s*&\s*[a-z]+\.)?\s*/;

/**
 * True if ECDICT gives this word a meaning of its own, apart from being a form of a verb
 * or noun: an adjective, noun, preposition... line that is not an inflection pointer
 * such as "access的过去式". Bracketed field notes ("[计] ...") are ignored.
 */
function hasOwnSense(e: EcdictEntry): boolean {
  return e.translation
    .split('\n')
    .map((l) => l.trim())
    .some((l) => POS_LINE.test(l) && !VERB_LINE.test(l) && !INFLECTION_POINTER.test(l));
}

/**
 * Suffix rules for words ECDICT does not know: "minimalised" -> minimalise (d),
 * "refocusses" -> refocus (3), "reinterpreting" -> reinterpret (i). `isListed` says whether a
 * candidate base is on the word list; only listed bases count. Type letters match ECDICT's.
 */
function guessInflection(w: string, isListed: (w: string) => boolean): { base: string; type: string } | undefined {
  const rules: [RegExp, string[], string][] = [
    [/(ss|sh|ch|x|z)es$/, ['$1'], '3'],
    [/sses$/, ['s'], '3'], // refocusses -> refocus
    [/ies$/, ['y'], '3'],
    [/s$/, [''], '3'],
    [/es$/, [''], '3'], // refocuses -> refocus
    [/ied$/, ['y'], 'd'],
    [/ed$/, ['', 'e'], 'd'],
    [/([b-df-hj-np-tv-z])\1ed$/, ['$1'], 'd'], // refocussed -> refocus
    [/ing$/, ['', 'e'], 'i'],
    [/([b-df-hj-np-tv-z])\1ing$/, ['$1'], 'i'],
  ];
  for (const [re, ends, type] of rules) {
    if (!re.test(w)) continue;
    for (const end of ends) {
      const base = w.replace(re, end);
      if (base.length > 2 && base !== w && isListed(base)) return { base, type };
    }
  }
  return undefined;
}

async function main() {
    const refresh = process.argv.includes('--refresh');

    // 1. Scrape
    const scraped: Scraped[] = [];
    for (const { level, slug } of SOURCES) {
      const entries = parsePage(await getHtml(slug, refresh), level);
      console.log(`${level}: ${entries.length} entries`);
      scraped.push(...entries);
    }

    // 2. Build entries keyed by headword; fold spelling variants and cross-level duplicates.
    const byKey = new Map<string, RawWord>(); // foldKey of any spelling -> entry
    const entries: RawWord[] = [];
    const crossLevel: string[] = [];
    for (const s of scraped) {
      const existing = s.spellings.map((sp) => byKey.get(foldKey(sp))).find(Boolean);
      if (existing) {
        if (existing.level !== s.level) crossLevel.push(`${existing.word} (${existing.level}) + ${s.spellings.join('/')} (${s.level})`);
        if (LEVEL_RANK[s.level] < LEVEL_RANK[existing.level]) existing.level = s.level;
        for (const sp of s.spellings) {
          if (sp.toLowerCase() !== existing.word.toLowerCase() && !existing.variants?.includes(sp)) {
            (existing.variants ??= []).push(sp);
          }
          byKey.set(foldKey(sp), existing);
        }
        if (s.example && !existing.examples.some((e) => e.text === s.example!.text)) existing.examples.push(s.example);
        continue;
      }
      const [word, ...variants] = s.spellings;
      const entry: RawWord = {
        id: slugify(word),
        word,
        level: s.level,
        ...(variants.length ? { variants } : {}),
        examples: s.example ? [s.example] : [],
      };
      entries.push(entry);
      for (const sp of s.spellings) byKey.set(foldKey(sp), entry);
    }

    // 3. Merge pure inflections into their base word.
    console.log('Loading ECDICT...');
    const dict = loadEcdict(new Set(scraped.flatMap((s) => s.spellings.map((sp) => sp.toLowerCase()))));
    // Candidates: entries whose ECDICT lemma ("0:access") is another word on the list.
    const candidates: { entry: RawWord; base: RawWord; e: EcdictEntry }[] = [];
    for (const entry of entries) {
      const e = dict.get(entry.word.toLowerCase());
      const lemma = e?.exchange['0']?.toLowerCase();
      const listedBase = lemma && lemma !== entry.word.toLowerCase() ? byKey.get(foldKey(lemma)) : undefined;
      if (listedBase && listedBase !== entry) {
        candidates.push({ entry, base: listedBase, e: e! });
        continue;
      }
      // Not in ECDICT, or its lemma is not on the list or wrong ("refocused" -> "refocuse"):
      // try plain suffix rules against the list.
      if (e && lemma === undefined && Object.keys(e.exchange).length) continue; // a base word itself
      const guess = guessInflection(entry.word.toLowerCase(), (w) => byKey.has(foldKey(w)));
      const base = guess && byKey.get(foldKey(guess.base));
      if (base && base !== entry) {
        candidates.push({
          entry,
          base,
          e: e ? { ...e, exchange: { ...e.exchange, '0': guess.base, '1': guess.type } } : ({ translation: '', exchange: { '0': guess.base, '1': guess.type } } as unknown as EcdictEntry),
        });
      }
    }
    // The C1/C2 lists pad word families with every inflection (specified, specifies,
    // specifying). Two or more listed inflections of one base marks such a family.
    const paddedFamilySize = new Map<RawWord, number>();
    for (const { entry, base } of candidates) {
      if (entry.level !== 'B2') paddedFamilySize.set(base, (paddedFamilySize.get(base) ?? 0) + 1);
    }

    const merged: { form: RawWord; base: RawWord }[] = [];
    const keptLexical: { word: RawWord; base: RawWord }[] = [];
    for (const { entry, base, e } of candidates) {
      // ECDICT "1:" = what kind of form this is: s = plural, 3 = 3rd person, d/p = -ed, i = -ing.
      const formType = e.exchange['1'] ?? '';
      const isSForm = /^[s3]+$/.test(formType);
      let keep: boolean;
      const ids = [entry.word, ...(entry.variants ?? [])].map(slugify);
      if (ids.some((id) => KEEP_SEPARATE.has(id))) keep = true;
      else if (ids.some((id) => MERGE.has(id))) keep = false;
      // Listed at an easier level than its base, so it was chosen as a word in its own right.
      else if (LEVEL_RANK[entry.level] < LEVEL_RANK[base.level]) keep = true;
      // Plural nouns and -s verbs repeat the base meaning (exceptions go in KEEP_SEPARATE).
      else if (isSForm) keep = false;
      else if (entry.level !== 'B2' && (paddedFamilySize.get(base) ?? 0) >= 2) keep = false;
      // A lone -ed/-ing form with an adjective or noun sense (daunting, savings) keeps its card.
      else keep = hasOwnSense(e);
      if (keep) keptLexical.push({ word: entry, base });
      else merged.push({ form: entry, base });
    }
    const removed = new Set<RawWord>();
    for (const { form, base } of merged) {
      // Follow the chain in case the base itself was merged (should not happen, but be safe).
      let target = base;
      while (removed.has(target)) target = merged.find((m) => m.form === target)!.base;
      (target.forms ??= []).push(form.word, ...(form.variants ?? []));
      for (const ex of form.examples) target.examples.push({ ...ex, form: form.word });
      if (LEVEL_RANK[form.level] < LEVEL_RANK[target.level]) target.level = form.level;
      removed.add(form);
    }
    const words = entries.filter((e) => !removed.has(e));

    // 4. Final checks + sort
    const ids = new Set<string>();
    for (const w of words) {
      if (ids.has(w.id)) throw new Error(`Duplicate id: ${w.id}`);
      ids.add(w.id);
      w.forms?.sort();
    }
    words.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.word.localeCompare(b.word));

    const count = (lv: Level) => words.filter((w) => w.level === lv).length;
    const counts = { B2: count('B2'), C1: count('C1'), C2: count('C2'), total: words.length };
    fs.writeFileSync(
      OUT_FILE,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: 'https://minddory.com/english-vocabulary-list/ (fce, cae, cpe). Personal use only.',
          counts,
          words,
        },
        null,
        1,
      ) + '\n',
    );
    console.log(`Wrote ${OUT_FILE}:`, counts);

    // 5. Report
    const scrapedCount = (lv: Level) => scraped.filter((s) => s.level === lv).length;
    const noExample = words.filter((w) => w.examples.length === 0);
    const withVariants = words.filter((w) => w.variants);
    const report = `# Phase 0 report

Generated ${new Date().toISOString()}

## Counts

| Level | Scraped | After clean-up |
|---|---|---|
| B2 | ${scrapedCount('B2')} | ${counts.B2} |
| C1 | ${scrapedCount('C1')} | ${counts.C1} |
| C2 | ${scrapedCount('C2')} | ${counts.C2} |
| **Total** | **${scraped.length}** | **${counts.total}** |

- Inflected forms merged into their base word: ${merged.length}
- Looked inflected but kept as their own card (own meaning in ECDICT): ${keptLexical.length}
- Entries with spelling variants: ${withVariants.length}
- Words listed in more than one level: ${crossLevel.length}
- Words with no example sentence: ${noExample.length} (Phase 1 fills these from Tatoeba)

## Spelling variants (${withVariants.length})

${withVariants.map((w) => `${w.word} / ${w.variants!.join(' / ')}`).join(', ')}

## Words listed in more than one level (${crossLevel.length})

${crossLevel.join('\n') || 'None.'}

## Kept as separate cards (${keptLexical.length})

These look like inflections of another listed word, but ECDICT gives them their own meaning.

${keptLexical.map(({ word, base }) => `${word.word} (${word.level}) ← ${base.word} (${base.level})`).join(', ')}

## Merged inflections (${merged.length})

${words
  .filter((w) => w.forms)
  .map((w) => `- **${w.word}** (${w.level}): ${w.forms!.join(', ')}`)
  .join('\n')}

## No example sentence (${noExample.length})

${noExample.map((w) => `${w.word} (${w.level})`).join(', ')}
`;
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, report);
    console.log(`Wrote ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
