// Phase 1: add Chinese + Spanish translations, part of speech, phonetics and missing example
// sentences to data/raw.json, and write the app's word files.
//
//   npm run data:enrich
//
// Needs data/raw.json (npm run data:scrape) and data/dict/* (npm run data:fetch-dicts).
// Output: public/data/b2.json, c1.json, c2.json, index.json + data/reports/phase1.md
//
// Sources:
//   Chinese, part of speech, phonetics: ECDICT (MIT)
//   Spanish: English Wiktionary via kaikki.org (CC BY-SA): the translation tables of the English
//            entry, else Spanish entries whose English gloss is the word
//   English definitions: English Wiktionary via kaikki.org (CC BY-SA), the first senses of the entry
//   Missing examples: Tatoeba (CC BY 2.0 FR), only for cards with no example at all
//   Hand fixes: scripts/manual.ts; notes for sensitive words: scripts/sensitive.ts

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { loadEcdict, type EcdictEntry } from './lib/ecdict.ts';
import { MANUAL, MANUAL_EXAMPLES, type Glosses } from './manual.ts';
import { SENSITIVE, type SensitiveNote } from './sensitive.ts';
import type { Example, RawWord } from './scrape.ts';

type Level = 'B2' | 'C1' | 'C2';

export interface Sense {
  /** n, v, adj, adv, prep, conj, pron, interj, num, det, phr, abbr; '' if unknown. */
  pos: string;
  gloss: string[];
}

export interface Word {
  id: string;
  word: string;
  level: Level;
  phonetic?: string;
  /** Parts of speech, most important first. */
  pos: string[];
  zh: Sense[];
  es: Sense[];
  /** English definitions (the first senses, for learners). */
  en?: Sense[];
  /** Hand-written warning for offensive or sensitive words (scripts/sensitive.ts). */
  sensitive?: SensitiveNote;
  variants?: string[];
  forms?: string[];
  /** Set when the translations came from the base word, e.g. "focuses" -> "focus". */
  lemma?: string;
  examples: Example[];
}

const RAW_FILE = 'data/raw.json';
const KAIKKI_FILE = 'data/dict/kaikki-es.jsonl';
const REVERSE_FILE = 'data/dict/kaikki-es-reverse.jsonl';
const ES_FREQ_FILE = 'data/dict/es-freq.txt';
const TATOEBA_FILE = 'data/dict/tatoeba-eng.tsv';
const DEFS_FILE = 'data/dict/kaikki-en-defs.jsonl';
const OUT_DIR = 'public/data';
const REPORT_FILE = 'data/reports/phase1.md';

const MAX_POS = 3; // sense groups per language
const MAX_ZH = 4; // glosses per group
const MAX_ES = 4;
const MAX_NEW_EXAMPLES = 2;
const MAX_EN_POS = 2; // English definition groups
const MAX_EN = 2; // definitions per group
const MAX_DEF_LEN = 150;

// ---------------------------------------------------------------- helpers

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** Spellings to try in the dictionaries: hyphen/space/joined forms, accents removed. */
function spellings(w: string): string[] {
  const base = w.toLowerCase().trim();
  const plain = base.normalize('NFKD').replace(/[̀-ͯ]/g, '');
  return uniq([base, plain, plain.replace(/-/g, ' '), plain.replace(/ /g, '-'), plain.replace(/[- ]/g, '')]);
}

function allSpellings(w: RawWord): string[] {
  return uniq([w.word, ...(w.variants ?? [])].flatMap(spellings));
}

/**
 * American spellings of a British word, tried last: Wiktionary keeps translation tables on
 * one spelling only (endeavour -> endeavor, offence -> offense, enrol -> enroll, analysed -> analyzed).
 */
function americanSpellings(keys: string[]): string[] {
  const out = keys.flatMap((k) => {
    const a = k
      .replace(/our(s|ed|ing|able|ably|ite|ites)?\b/g, 'or$1')
      .replace(/([iy])s(e|ed|es|ing|ation|ations|er|ers)\b/g, '$1z$2')
      .replace(/ence\b/g, 'ense')
      .replace(/tre\b/g, 'ter')
      .replace(/sceptic/g, 'skeptic')
      .replace(/ll(ed|ing|er)\b/g, 'l$1')
      .replace(/(?<=[aeiou][^aeiou])l\b/g, 'll');
    return a === k ? [] : [a];
  });
  return uniq(out).filter((a) => !keys.includes(a));
}

/** Possible adjectives behind an -ly adverb: cheerfully -> cheerful, angrily -> angry, ably -> able. */
function adjectivesFor(adverb: string): string[] {
  if (!adverb.endsWith('ly')) return [];
  const stem = adverb.slice(0, -2);
  return uniq([
    stem,
    stem.replace(/i$/, 'y'), // angrily -> angry
    stem + 'le', // probably -> probable (stem "probab")
    stem.replace(/al$/, ''), // basically -> basic
    stem + 'e', // wholly -> whole
  ]).filter((s) => s.length > 2 && s !== adverb);
}

/** Spanish adverb from an adjective: alegre -> alegremente, rápido -> rápidamente. */
function menteAdverb(adj: string): string | undefined {
  if (!/^[a-záéíóúñü]+$/.test(adj)) return undefined; // single words only
  if (adj.endsWith('o')) return adj.slice(0, -1) + 'amente';
  if (/(e|a|l|z|r|n|s)$/.test(adj) && !/(or|ón|án|ín|és)$/.test(adj)) return adj + 'mente';
  return undefined;
}

/** Split a gloss list on commas/semicolons that are not inside brackets. */
function splitGlosses(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of s) {
    if ('(（[【'.includes(c)) depth++;
    else if (')）]】'.includes(c)) depth = Math.max(0, depth - 1);
    if (depth === 0 && ',，;；'.includes(c)) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((g) => g.trim()).filter(Boolean);
}

function mergeSenses(senses: Sense[], maxGloss: number): Sense[] {
  const out: Sense[] = [];
  for (const s of senses) {
    const prev = out.find((o) => o.pos === s.pos);
    if (prev) prev.gloss = uniq([...prev.gloss, ...s.gloss]);
    else out.push({ pos: s.pos, gloss: uniq(s.gloss) });
  }
  return out.filter((s) => s.gloss.length).slice(0, MAX_POS).map((s) => ({ ...s, gloss: s.gloss.slice(0, maxGloss) }));
}

const fromManual = (g: Glosses): Sense[] => Object.entries(g).map(([pos, gloss]) => ({ pos, gloss: gloss ?? [] }));

// ---------------------------------------------------------------- Chinese (ECDICT)

const ECDICT_POS: Record<string, string> = {
  n: 'n', pl: 'n', v: 'v', vt: 'v', vi: 'v', aux: 'v', a: 'adj', adj: 'adj', s: 'adj',
  ad: 'adv', adv: 'adv', r: 'adv', prep: 'prep', conj: 'conj', pron: 'pron', int: 'interj',
  interj: 'interj', num: 'num', art: 'det', abbr: 'abbr',
};
/** "n. ...", "vt.& vi. ...", "a. ..." */
const ZH_LINE = /^([a-z]+)\.(?:\s*&\s*[a-z]+\.)?\s*(.*)$/;
/** "access的过去式", "raunchy的变形": a pointer to another word, not a meaning. */
const ZH_POINTER = /的(过去式|过去时|过去分词|现在分词|ing形式|复数|第三人称|变形|比较级|最高级)/;

interface ZhResult {
  senses: Sense[];
  /** True if only web ("[网络]") or specialist ("[计]") lines were found. */
  weak: boolean;
}

function parseZh(e: EcdictEntry): ZhResult {
  const general: Sense[] = [];
  const special: Sense[] = [];
  for (const raw of e.translation.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const tagged = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (tagged) {
      special.push({ pos: '', gloss: splitGlosses(tagged[2]) });
      continue;
    }
    const m = line.match(ZH_LINE);
    const pos = m && ECDICT_POS[m[1]] !== undefined ? ECDICT_POS[m[1]] : '';
    const text = m && ECDICT_POS[m[1]] !== undefined ? m[2] : line;
    const gloss = splitGlosses(text).filter((g) => !ZH_POINTER.test(g));
    if (gloss.length) general.push({ pos, gloss });
  }
  if (general.length) return { senses: mergeSenses(general, MAX_ZH), weak: false };
  return { senses: mergeSenses(special, MAX_ZH), weak: special.length > 0 };
}

/** ECDICT phonetics use a Cyrillic schwa, ASCII stress marks ("'" primary, "," or "." secondary) and "^" for ɡ. */
const cleanPhonetic = (p: string) =>
  p.replace(/ә/g, 'ə').replace(/'/g, 'ˈ').replace(/[,.]/g, 'ˌ').replace(/\^/g, 'ɡ').trim();

// ---------------------------------------------------------------- Spanish (kaikki)

const KAIKKI_POS: Record<string, string> = {
  noun: 'n', verb: 'v', adj: 'adj', adv: 'adv', prep: 'prep', conj: 'conj', pron: 'pron',
  intj: 'interj', num: 'num', det: 'det', article: 'det', phrase: 'phr', prep_phrase: 'phr',
  proverb: 'phr', abbrev: 'abbr', initialism: 'abbr', contraction: 'abbr',
};

interface KaikkiRec {
  word: string;
  pos: string;
  es?: { word: string; sense?: string; tags?: string[] }[];
  alt?: string[];
}

async function loadKaikki(): Promise<Map<string, KaikkiRec[]>> {
  if (!fs.existsSync(KAIKKI_FILE)) throw new Error(`${KAIKKI_FILE} not found. Run: npm run data:fetch-dicts`);
  const map = new Map<string, KaikkiRec[]>();
  const rl = readline.createInterface({ input: fs.createReadStream(KAIKKI_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const r: KaikkiRec = JSON.parse(line);
    if (KAIKKI_POS[r.pos] === undefined) continue; // names, affixes, symbols
    const key = r.word.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

/** Tags that only describe grammar; any other tag (Mexico, colloquial, rare...) marks a word. */
const NEUTRAL_TAGS = /^(masculine|feminine|plural|singular|neuter|common-gender|by-personal-gender|transitive|intransitive|verb|noun|adjective|adverb|phrase|formal)$/;

/**
 * Spanish translations per part of speech, from the English entry's translation tables.
 * Score per Spanish word: +1 for each sense it translates, +2 if the Spanish entry glosses
 * back to the English word as its main meaning (+1 as a later meaning), plus a bonus for
 * common words (freqBonus). Regional, colloquial and rare words score less. This puts "abandonado" ahead of "desenfrenado" for "abandoned".
 */
/** Spanish word -> frequency rank (0 = most common), from es-freq.txt. */
let esFreq = new Map<string, number>();

function loadEsFreq() {
  if (!fs.existsSync(ES_FREQ_FILE)) throw new Error(`${ES_FREQ_FILE} not found. Run: npm run data:fetch-dicts`);
  const words = fs.readFileSync(ES_FREQ_FILE, 'utf8').split(/\r?\n/).map((l) => l.split(' ')[0]).filter(Boolean);
  esFreq = new Map(words.map((w, i) => [w, i]));
}

/**
 * Common Spanish words score higher; single words missing from the 50k list are usually rare
 * or regional ("joto", "sabientemente") and score lower. Phrases are neutral.
 */
function freqBonus(w: string): number {
  if (w.includes(' ')) return 0;
  const rank = esFreq.get(w.toLowerCase());
  if (rank === undefined) return -1;
  return rank < 3000 ? 1.5 : rank < 15000 ? 0.75 : 0;
}

/** Sort by score, best first, and drop extras that score far below the best one. */
function rankByScore(score: Map<string, number>): string[] {
  const sorted = [...score.entries()].sort((a, b) => b[1] - a[1]); // stable: ties keep first-seen order
  const top = sorted[0]?.[1] ?? 0;
  return sorted.filter(([, sc], i) => i === 0 || sc >= top - 2.5).map(([w]) => w);
}

function spanishFor(keys: string[], kaikki: Map<string, KaikkiRec[]>, reverse: Reverse): { senses: Sense[]; via?: string } {
  const lookup = (key: string) => (kaikki.get(key) ?? []).filter((r) => r.es);
  let recs: KaikkiRec[] = [];
  let via: string | undefined;
  let matched = keys[0];
  for (const k of keys) {
    recs = lookup(k);
    matched = k;
    if (recs.length) break;
  }
  if (!recs.length) {
    // Follow "alternative spelling of" links one step (e.g. "appal" -> "appall").
    for (const k of keys) {
      const alts = (kaikki.get(k) ?? []).flatMap((r) => r.alt ?? []);
      for (const a of alts) {
        recs = lookup(a.toLowerCase());
        if (recs.length) {
          via = a;
          matched = a.toLowerCase();
          break;
        }
      }
      if (recs.length) break;
    }
  }
  const senses: Sense[] = [];
  const posOrder = uniq(recs.map((r) => KAIKKI_POS[r.pos]));
  const back = reverse.get(matched) ?? [];
  for (const pos of posOrder) {
    const score = new Map<string, number>();
    const marked = new Set<string>();
    const neutral = new Set<string>();
    const seen = new Set<string>(); // word + sense, so a word counts once per sense
    for (const r of recs.filter((x) => KAIKKI_POS[x.pos] === pos)) {
      for (const t of r.es!) {
        const w = t.word.trim();
        const key = `${w}\u0000${t.sense ?? ''}`;
        if (!w || seen.has(key)) continue;
        seen.add(key);
        score.set(w, (score.get(w) ?? 0) + 1);
        if ((t.tags ?? []).some((g) => !NEUTRAL_TAGS.test(g))) marked.add(w);
        else neutral.add(w);
      }
    }
    for (const h of back) {
      if (h.pos === pos && score.has(h.es)) score.set(h.es, score.get(h.es)! + (h.rank < 10 ? 2 : 1) + (h.exact ? 0.5 : 0));
    }
    // A word is "marked" only if it never appears without a regional/register tag.
    for (const w of marked) if (!neutral.has(w)) score.set(w, score.get(w)! - 1.5);
    for (const [w, sc] of score) score.set(w, sc + freqBonus(w));
    const ranked = rankByScore(score);
    senses.push({ pos, gloss: ranked });
  }
  return { senses: mergeSenses(senses, MAX_ES), via };
}

/**
 * Reverse index from the Spanish side: English gloss piece -> Spanish words.
 * "ocultar: to hide, to conceal" gives conceal -> ocultar (verb). Rank = where the piece
 * appears (earlier gloss and earlier piece = more central meaning).
 */
/** exact: the whole gloss is the English word ("abandonado: abandoned"). */
type Reverse = Map<string, { es: string; pos: string; rank: number; exact: boolean }[]>;

async function loadReverse(): Promise<Reverse> {
  if (!fs.existsSync(REVERSE_FILE)) throw new Error(`${REVERSE_FILE} not found. Run: npm run data:fetch-dicts`);
  const map: Reverse = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(REVERSE_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const r: { word: string; pos: string; glosses: string[] } = JSON.parse(line);
    const pos = KAIKKI_POS[r.pos];
    if (pos === undefined || /^[A-Z]/.test(r.word)) continue;
    r.glosses.forEach((g, gi) => {
      const pieces = g.replace(/\([^)]*\)/g, ' ').split(/[,;]/);
      pieces.forEach((p, pi) => {
        const piece = p.trim().toLowerCase().replace(/^(to|a|an|the) /, '').replace(/\s+/g, ' ');
        if (!piece || piece.split(' ').length > 4) return;
        if (!map.has(piece)) map.set(piece, []);
        map.get(piece)!.push({ es: r.word, pos, rank: gi * 10 + pi, exact: pieces.length === 1 });
      });
    });
  }
  return map;
}

function spanishReverse(keys: string[], reverse: Reverse): Sense[] {
  for (const k of keys) {
    const hits = reverse.get(k);
    if (!hits?.length) continue;
    const posOrder = uniq([...hits].sort((a, b) => a.rank - b.rank).map((h) => h.pos));
    return mergeSenses(
      posOrder.map((pos) => {
        const best = new Map<string, number>();
        for (const h of hits.filter((x) => x.pos === pos)) best.set(h.es, Math.min(best.get(h.es) ?? Infinity, h.rank));
        const score = new Map([...best.entries()].map(([w, rank]) => [w, (rank < 10 ? 2 : 1) - (rank % 10) * 0.2 + freqBonus(w)]));
        return { pos, gloss: rankByScore(score) };
      }),
      3,
    );
  }
  return [];
}

// ---------------------------------------------------------------- Tatoeba

interface Needy {
  word: Word;
  /** Lowercase surface forms: the headword, variants, merged forms and ECDICT inflections. */
  forms: Set<string>;
  found: { text: string; id: string; score: number }[];
}

const NAMES = /\b(Tom|Mary|John|Ken|Mike|Jim|Bob|Jane|Layla|Sami|Mennad|Baya|Yanni|Skura|Ziri|Rima)\b/;

function scoreSentence(text: string, exactHeadword: boolean): number | undefined {
  const words = text.split(/\s+/).length;
  if (words < 3 || words > 30) return undefined;
  if (!/^[A-Z]/.test(text) || !/[.!?]$/.test(text) || /["“”]/.test(text)) return undefined; // quotes: often talk *about* the word
  let score = Math.abs(words - 9);
  if (words < 5 || words > 16) score += 10; // only if nothing better exists
  if (NAMES.test(text)) score += 3; // Tatoeba is full of Tom and Mary; prefer other sentences
  if (!exactHeadword) score += 1;
  return score;
}

async function addTatoebaExamples(needy: Needy[]) {
  if (!fs.existsSync(TATOEBA_FILE)) throw new Error(`${TATOEBA_FILE} not found. Run: npm run data:fetch-dicts`);
  // Index needy cards by the first token of each form, so each sentence costs a few Map lookups.
  const byFirst = new Map<string, { n: Needy; form: string }[]>();
  for (const n of needy) {
    // Hyphenated words are often written with a space too ("long-term" / "long term").
    for (const form of uniq([...n.forms].flatMap((f) => (f.includes('-') ? [f, f.replace(/-/g, ' ')] : [f])))) {
      const first = form.split(' ')[0];
      if (!byFirst.has(first)) byFirst.set(first, []);
      byFirst.get(first)!.push({ n, form });
    }
  }
  const rl = readline.createInterface({ input: fs.createReadStream(TATOEBA_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    const [id, , text] = line.split('\t');
    if (!text) continue;
    const plain = text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    const lower = ` ${plain.replace(/[^a-z'\- ]+/g, ' ').replace(/\s+/g, ' ')} `;
    const tokens = new Set(lower.trim().split(' '));
    for (const tok of tokens) {
      for (const { n, form } of byFirst.get(tok) ?? []) {
        // Whole-phrase match for multi-word forms ("dole out", "long term").
        if (form.includes(' ') && !lower.includes(` ${form} `)) continue;
        if (n.found.some((f) => f.text === text)) continue;
        const score = scoreSentence(text, form === n.word.word.toLowerCase());
        if (score === undefined) continue;
        n.found.push({ text, id, score });
      }
    }
  }
  for (const n of needy) {
    const best = n.found.sort((a, b) => a.score - b.score || Number(a.id) - Number(b.id)).filter((b, i) => i === 0 || b.score < 10)
      .slice(0, MAX_NEW_EXAMPLES);
    n.word.examples = best.map((b) => ({ text: b.text, source: `https://tatoeba.org/en/sentences/show/${b.id}` }));
  }
}

// ---------------------------------------------------------------- main

// ---------------------------------------------------------------- English definitions (kaikki)

interface DefRec {
  word: string;
  pos: string;
  senses: { gloss: string; tags?: string[] }[];
}

/** Usage labels that mark a sense as offensive; such words are listed in the report for scripts/sensitive.ts. */
const OFFENSIVE_TAGS = new Set(['offensive', 'slur', 'ethnic', 'derogatory', 'vulgar', 'pejorative']);
/** Senses a learner rarely needs; skipped unless nothing else is left. */
const OLD_TAGS = new Set(['obsolete', 'archaic', 'dated', 'rare']);

async function loadDefs(wanted: Set<string>): Promise<Map<string, DefRec[]>> {
  if (!fs.existsSync(DEFS_FILE)) throw new Error(`${DEFS_FILE} not found. Run: npm run data:fetch-dicts`);
  const map = new Map<string, DefRec[]>();
  const rl = readline.createInterface({ input: fs.createReadStream(DEFS_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line) continue;
    const r: DefRec = JSON.parse(line);
    if (!wanted.has(r.word) || KAIKKI_POS[r.pos] === undefined) continue;
    if (!map.has(r.word)) map.set(r.word, []);
    map.get(r.word)!.push(r);
  }
  return map;
}

/** Shortens a definition at a word boundary and drops a trailing full stop. */
function cleanDef(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  if (t.length > MAX_DEF_LEN) t = t.slice(0, t.lastIndexOf(' ', MAX_DEF_LEN)).replace(/[,;:(]$/, '') + '…';
  return t;
}

/** Senses left out of the definitions (unless the word is in scripts/sensitive.ts, or nothing else is left). */
const SLANG_TAGS = new Set([...OFFENSIVE_TAGS, 'slang', 'humorous', 'euphemistic']);

const STOP = new Set('the and for with that this from which who whom what are was were has have had not but any all its into onto than then such some one ones being been very more most also other their them they something someone someplace somebody used use using act way'.split(' '));

/** Content words of a definition, roughly stemmed, for comparing two definitions. */
function contentWords(s: string): Set<string> {
  const words = s.toLowerCase().match(/[a-z]+/g) ?? [];
  return new Set(words.filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, '')));
}

/** WordNet senses (ECDICT's English "definition" column) per part of speech, most common first. */
function wordnetSenses(definition: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const POS: Record<string, string> = { n: 'n', v: 'v', a: 'adj', s: 'adj', adj: 'adj', r: 'adv', adv: 'adv' };
  for (const line of definition.split('\n')) {
    const m = line.trim().match(/^(n|v|a|s|r|adj|adv)\.?\s+(.+)$/);
    if (!m) continue;
    const pos = POS[m[1]];
    map.set(pos, [...(map.get(pos) ?? []), m[2]]);
  }
  return map;
}

/**
 * Puts the Wiktionary definitions in WordNet's order. Wiktionary words them more simply but lists
 * them by history ("focus": optics first); WordNet lists the most common meaning first ("the
 * concentration of attention"). For each WordNet sense, the Wiktionary definition sharing the most
 * words with it moves up; the rest keep Wiktionary's order.
 */
function byWordnet(defs: string[], wn: string[] | undefined): string[] {
  if (!wn?.length) return defs;
  const words = defs.map(contentWords);
  const picked: number[] = [];
  for (const w of wn.slice(0, 3)) {
    const target = contentWords(w);
    let best = -1;
    let bestScore = 0;
    words.forEach((ws, i) => {
      if (picked.includes(i)) return;
      const score = [...ws].filter((x) => target.has(x)).length;
      if (score > bestScore) [best, bestScore] = [i, score];
    });
    if (best >= 0) picked.push(best);
  }
  return [...picked, ...defs.map((_, i) => i).filter((i) => !picked.includes(i))].map((i) => defs[i]);
}

/**
 * English definitions from the first spelling that has any, grouped by part of speech in the
 * card's part-of-speech order. Also returns the offensive labels found on any sense.
 */
function englishFor(keys: string[], defs: Map<string, DefRec[]>, posOrder: string[], wordnet: string, keepSlang: boolean): { senses: Sense[]; offensive: string[] } {
  const wn = wordnetSenses(wordnet);
  for (const k of keys) {
    const recs = defs.get(k);
    if (!recs?.length) continue;
    const offensive = uniq(recs.flatMap((r) => r.senses.flatMap((s) => (s.tags ?? []).filter((t) => OFFENSIVE_TAGS.has(t)))));
    const groups = new Map<string, string[]>();
    for (const r of recs) {
      const pos = KAIKKI_POS[r.pos];
      const tagged = (s: DefRec['senses'][number], set: Set<string>) => (s.tags ?? []).some((t) => set.has(t));
      let senses = r.senses.filter((s) => !tagged(s, OLD_TAGS));
      if (!keepSlang) senses = senses.filter((s) => !tagged(s, SLANG_TAGS));
      for (const s of senses.length ? senses : r.senses) {
        const list = groups.get(pos) ?? [];
        const def = cleanDef(s.gloss);
        if (def && !list.includes(def)) list.push(def);
        groups.set(pos, list);
      }
    }
    const rank = (pos: string) => (posOrder.includes(pos) ? posOrder.indexOf(pos) : posOrder.length);
    const senses = [...groups.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0])) // stable: Wiktionary's order otherwise
      .slice(0, MAX_EN_POS)
      .map(([pos, gloss]) => ({ pos, gloss: byWordnet(gloss, wn.get(pos)).slice(0, MAX_EN) }));
    return { senses, offensive };
  }
  return { senses: [], offensive: [] };
}

async function main() {
  if (!fs.existsSync(RAW_FILE)) throw new Error(`${RAW_FILE} not found. Run: npm run data:scrape`);
  const raw: { words: RawWord[] } = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));

  console.log('Loading ECDICT...');
  const keysFor = new Map(raw.words.map((w) => [w, allSpellings(w)]));
  const wanted = new Set([...keysFor.values()].flat());
  let dict = loadEcdict(wanted);
  // Second pass for base words of stray inflected cards ("focuses" -> "focus").
  const lemmas = new Set(
    [...dict.values()].map((e) => e.exchange['0']?.toLowerCase()).filter((l): l is string => !!l && !dict.has(l)),
  );
  if (lemmas.size) dict = new Map([...dict, ...loadEcdict(lemmas)]);

  console.log('Loading Wiktionary (kaikki) Spanish translations...');
  const kaikki = await loadKaikki();
  const reverse = await loadReverse();
  loadEsFreq();
  console.log('Loading Wiktionary (kaikki) English definitions...');
  const lemmaKeys = [...dict.values()].map((e) => e.exchange['0']?.toLowerCase()).filter((l): l is string => !!l);
  const defs = await loadDefs(new Set([...wanted, ...americanSpellings([...wanted]), ...lemmaKeys]));
  const flagged: { word: Word; tags: string[] }[] = [];
  let viaReverse = 0;
  const viaMente: string[] = [];

  const words: Word[] = [];
  const weakZh: Word[] = [];
  const viaAlt: { word: Word; alt: string }[] = [];
  const manualUsed: string[] = [];
  for (const r of raw.words) {
    const keys = keysFor.get(r)!;
    const entry = keys.map((k) => dict.get(k)).find(Boolean);
    let zh = entry ? parseZh(entry) : { senses: [], weak: false };
    let lemma: string | undefined;
    // An inflected form with no meaning of its own: use the base word's meaning.
    const lemmaKey = entry?.exchange['0']?.toLowerCase();
    if ((!zh.senses.length || zh.weak) && lemmaKey && dict.has(lemmaKey)) {
      const z = parseZh(dict.get(lemmaKey)!);
      if (z.senses.length) {
        zh = z;
        lemma = lemmaKey;
      }
    }

    const findSpanish = (ks: string[]): { senses: Sense[]; via?: string } => {
      const us = americanSpellings(ks);
      let found = spanishFor(ks, kaikki, reverse);
      if (!found.senses.length && us.length) found = spanishFor(us, kaikki, reverse);
      if (!found.senses.length) {
        found = { senses: spanishReverse([...ks, ...us], reverse) };
        if (found.senses.length) viaReverse++;
      }
      return found;
    };
    let es = findSpanish(keys);
    // Base word's Spanish for inflected cards that are used as verb/noun forms
    // ("concluded", "focuses"), not for -ed/-ing adjectives like "haunting" (those go to manual.ts).
    const usedAsForm =
      lemma !== undefined || /^[s3]+$/.test(entry?.exchange['1'] ?? '') || (zh.senses.length > 0 && zh.senses.every((s) => s.pos === 'v'));
    if (!es.senses.length && lemmaKey && usedAsForm) {
      es = findSpanish([lemmaKey]);
      if (es.senses.length) lemma ??= lemmaKey;
    }
    // -ly adverbs: Spanish adjective + -mente (cheerfully -> alegre -> alegremente).
    if (!es.senses.length && !r.word.includes(' ')) {
      for (const adj of adjectivesFor(r.word.toLowerCase())) {
        const a = findSpanish([adj]).senses.find((s) => s.pos === 'adj');
        const advs = uniq((a?.gloss ?? []).map(menteAdverb).filter((x): x is string => !!x)).slice(0, 2);
        if (advs.length) {
          es = { senses: [{ pos: 'adv', gloss: advs }] };
          if (!MANUAL[r.id]?.es) viaMente.push(`${r.word} → ${advs.join(', ')}`);
          break;
        }
      }
    }

    const w: Word = {
      id: r.id,
      word: r.word,
      level: r.level,
      ...(entry?.phonetic ? { phonetic: cleanPhonetic(entry.phonetic) } : {}),
      pos: [],
      zh: zh.senses,
      es: es.senses,
      ...(r.variants ? { variants: r.variants } : {}),
      ...(r.forms ? { forms: r.forms } : {}),
      ...(lemma ? { lemma } : {}),
      examples: r.examples,
    };
    const manual = MANUAL[r.id];
    if (manual) {
      manualUsed.push(r.id);
      if (manual.zh) w.zh = fromManual(manual.zh);
      if (manual.es) w.es = fromManual(manual.es);
    } else {
      if (zh.weak) weakZh.push(w);
      if (es.via) viaAlt.push({ word: w, alt: es.via });
    }
    w.pos = uniq([...w.zh, ...w.es].map((s) => s.pos).filter(Boolean));
    const keepSlang = !!SENSITIVE[r.id];
    const lemmaEntry = lemmaKey ? dict.get(lemmaKey) : undefined;
    let en = englishFor([...keys, ...americanSpellings(keys)], defs, w.pos, entry?.definition || lemmaEntry?.definition || '', keepSlang);
    // Inflected cards ("achieving", "focuses"): the base word's definitions when the card's own entry
    // has nothing, or nothing for the card's main part of speech ("achieving" only has the noun "an achievement").
    if (lemmaKey && lemmaKey !== r.word.toLowerCase() && !en.senses.some((s) => s.pos === w.pos[0])) {
      const base = englishFor([lemmaKey], defs, w.pos, lemmaEntry?.definition ?? '', keepSlang);
      if (base.senses.some((s) => s.pos === w.pos[0]) || !en.senses.length) en = { ...base, offensive: en.offensive };
    }
    if (en.offensive.length) flagged.push({ word: w, tags: en.offensive });
    if (MANUAL[r.id]?.en) en = { ...en, senses: fromManual(MANUAL[r.id]!.en!) };
    // Same key order as before for the old fields; en and sensitive go right after es.
    const { variants, forms, lemma: lm, examples, ...head } = w;
    words.push({
      ...head,
      ...(en.senses.length ? { en: en.senses } : {}),
      ...(SENSITIVE[r.id] ? { sensitive: SENSITIVE[r.id] } : {}),
      ...(variants ? { variants } : {}),
      ...(forms ? { forms } : {}),
      ...(lm ? { lemma: lm } : {}),
      examples,
    });
  }
  for (const id of [...Object.keys(MANUAL), ...Object.keys(MANUAL_EXAMPLES), ...Object.keys(SENSITIVE)]) {
    if (!words.some((w) => w.id === id)) console.warn(`manual.ts: unknown id "${id}"`);
  }

  // Examples for cards that have none.
  console.log('Searching Tatoeba for missing examples...');
  const needy: Needy[] = words
    .filter((w) => w.examples.length === 0)
    .map((w) => {
      const e = allSpellings(raw.words.find((r) => r.id === w.id)!).map((k) => dict.get(k)).find(Boolean);
      const infl = e ? Object.entries(e.exchange).filter(([k]) => k !== '0' && k !== '1').map(([, v]) => v) : [];
      const forms = new Set(
        [w.word, ...(w.variants ?? []), ...(w.forms ?? []), ...infl].map((f) => f.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')),
      );
      // Phrasal verbs: also match inflected verb + particle ("eked out").
      const [verb, ...rest] = w.word.toLowerCase().split(' ');
      if (rest.length && /^(out|over|up|down|off|on|in|away|back)$/.test(rest.at(-1)!)) {
        const ve = dict.get(verb);
        for (const v of Object.values(ve?.exchange ?? {})) if (/^[a-z]+$/.test(v)) forms.add([v, ...rest].join(' '));
      }
      return { word: w, forms, found: [] };
    });
  const needyBefore = needy.length;
  await addTatoebaExamples(needy);
  let handExamples = 0;
  for (const n of needy) {
    const hand = MANUAL_EXAMPLES[n.word.id];
    if (!n.word.examples.length && hand?.length) {
      n.word.examples = hand.map((text) => ({ text }));
      handExamples++;
    }
  }

  // Write files
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const levels: Level[] = ['B2', 'C1', 'C2'];
  const counts: Record<string, number> = {};
  for (const lv of levels) {
    const list = words.filter((w) => w.level === lv);
    counts[lv] = list.length;
    // One word per line: small file, readable diffs.
    fs.writeFileSync(path.join(OUT_DIR, `${lv.toLowerCase()}.json`), `[\n${list.map((w) => JSON.stringify(w)).join(',\n')}\n]\n`);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, 'index.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts: { ...counts, total: words.length },
        files: Object.fromEntries(levels.map((lv) => [lv, `${lv.toLowerCase()}.json`])),
        sources: [
          { what: 'Word lists (B2/C1/C2)', name: 'minddory.com English vocabulary lists', url: 'https://minddory.com/english-vocabulary-list/', licence: 'Personal use' },
          { what: 'Chinese translations, part of speech, phonetics', name: 'ECDICT', url: 'https://github.com/skywind3000/ECDICT', licence: 'MIT' },
          { what: 'Spanish translations and English definitions', name: 'English Wiktionary via kaikki.org', url: 'https://kaikki.org/', licence: 'CC BY-SA 4.0' },
          { what: 'Example sentences (with a source link)', name: 'Tatoeba', url: 'https://tatoeba.org/', licence: 'CC BY 2.0 FR' },
          { what: 'Pronunciation audio (generated by scripts/gen-audio.py)', name: 'Piper TTS, voice "cori" (en_GB, trained on LibriVox recordings)', url: 'https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_GB/cori/high', licence: 'Public domain (voice dataset)' },
        ],
      },
      null,
      1,
    ) + '\n',
  );
  console.log(`Wrote ${OUT_DIR}/{b2,c1,c2,index}.json`, counts);

  // Report
  const noZh = words.filter((w) => !w.zh.length);
  const noEs = words.filter((w) => !w.es.length);
  const noEx = words.filter((w) => !w.examples.length);
  const noEn = words.filter((w) => !w.en?.length);
  const withNote = words.filter((w) => w.sensitive);
  const flaggedNoNote = flagged.filter((f) => !SENSITIVE[f.word.id]);
  const fromLemma = words.filter((w) => w.lemma && !MANUAL[w.id]);
  const list = (ws: Word[]) => ws.map((w) => `${w.word} (${w.level})`).join(', ') || 'None.';
  const pct = (n: number) => `${((100 * n) / words.length).toFixed(1)}%`;
  const sizes = levels.map((lv) => `${lv.toLowerCase()}.json ${(fs.statSync(path.join(OUT_DIR, `${lv.toLowerCase()}.json`)).size / 1024).toFixed(0)} KB`);
  const report = `# Phase 1 report

Generated ${new Date().toISOString()}

## Coverage

| | Cards | Share |
|---|---|---|
| Chinese translation | ${words.length - noZh.length} / ${words.length} | ${pct(words.length - noZh.length)} |
| Spanish translation | ${words.length - noEs.length} / ${words.length} | ${pct(words.length - noEs.length)} |
| At least one example | ${words.length - noEx.length} / ${words.length} | ${pct(words.length - noEx.length)} |
| English definition | ${words.length - noEn.length} / ${words.length} | ${pct(words.length - noEn.length)} |

- Notes for sensitive words (scripts/sensitive.ts): ${withNote.length} (${withNote.filter((w) => w.sensitive!.level === 'offensive').length} offensive, the rest "use with care")

- Examples added for the ${needyBefore} cards that had none: ${needyBefore - noEx.length - handExamples} from Tatoeba, ${handExamples} hand-written (scripts/manual.ts)
- Translations taken from the base word (inflected cards such as "focuses"): ${fromLemma.length}
- Spanish found through an "alternative spelling of" link: ${viaAlt.length}
- Spanish found from the Spanish side of Wiktionary ("ocultar: to hide, conceal"): ${viaReverse}
- Spanish adverbs built as adjective + -mente: ${viaMente.length} (listed below; check them)
- Hand-written entries used from scripts/manual.ts: ${manualUsed.length}
- Output: ${sizes.join(', ')}

## No Chinese translation (${noZh.length})

Add these to scripts/manual.ts.

${list(noZh)}

## Chinese only from web or specialist glosses (${weakZh.length})

ECDICT had only "[网络]" (web) or field-specific lines such as "[计]" for these. Check them.

${weakZh.map((w) => `${w.word} (${w.level}): ${w.zh.flatMap((s) => s.gloss).join('，')}`).join('\n\n') || 'None.'}

## No Spanish translation (${noEs.length})

Add these to scripts/manual.ts.

${list(noEs)}

## Senses labelled offensive, with no note yet (${flaggedNoNote.length})

Wiktionary labels at least one sense of these offensive, vulgar or derogatory. Most are false
alarms (a rare slang sense); write a note in scripts/sensitive.ts for the ones a learner should be warned about.

${flaggedNoNote.map((f) => `${f.word.word} (${f.word.level}): ${f.tags.join(', ')}`).join('\n\n') || 'None.'}

## No English definition (${noEn.length})

${list(noEn)}

## Still no example sentence (${noEx.length})

${list(noEx)}

## Translations taken from the base word (${fromLemma.length})

${fromLemma.map((w) => `${w.word} → ${w.lemma}`).join(', ') || 'None.'}

## Spanish adverbs built with -mente (${viaMente.length})

${viaMente.join(', ') || 'None.'}

## Spanish through an alternative spelling (${viaAlt.length})

${viaAlt.map(({ word, alt }) => `${word.word} → ${alt}`).join(', ') || 'None.'}
`;
  fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`Wrote ${REPORT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
