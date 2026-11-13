// Word formation (Cambridge Use of English Part 3): for each card, find the base word it's built from
// (decision ← DECIDE, unbelievable ← BELIEVE) and save it as `base` in public/data/*.json.
//
// How a link is found:
//   1. Strip a prefix or suffix and try a few spelling repairs (decis|ion → decide, happi|ness → happy).
//   2. The candidate must be a common English word (ECDICT frequency, or a word in our lists).
//   3. The card's English definition must mention the candidate or one of its forms
//      ("decision: the act of deciding"). This check is what keeps out false pairs (cart|on → cart).
//   4. Repeat on the candidate (unbelievable → believable → believe), up to 3 steps, and keep the last one.
//
// Run: npm run data:families   (needs data/dict from `npm run data:fetch-dicts`)
// Writes data/reports/families.txt with every link, so the results can be checked by eye.

import fs from 'node:fs';
import readline from 'node:readline';
import { loadEcdict } from './lib/ecdict.ts';

const LEVEL_FILES = ['b2', 'c1', 'c2'].map((l) => `public/data/${l}.json`);
const DEFS_FILE = 'data/dict/kaikki-en-defs.jsonl';
const REPORT = 'data/reports/families.txt';
const WRITE = process.argv.includes('--write');

interface CardWord {
  id: string;
  word: string;
  lemma?: string;
  pos?: string[];
  forms?: string[];
  variants?: string[];
  en?: { pos: string; gloss: string[] }[];
  base?: string;
}

const levels = LEVEL_FILES.map((f) => ({ file: f, words: JSON.parse(fs.readFileSync(f, 'utf8')) as CardWord[] }));
const cards = levels.flatMap((l) => l.words);
const cardWords = new Set(cards.map((c) => c.word.toLowerCase()));

// ---------- dictionaries ----------

/**
 * The main definitions per word from English Wiktionary: the first entry of each part of speech
 * (a later one is a homograph: copper "police officer", from cop), its first two senses, without
 * slang, old or rare ones.
 */
const wikt = new Map<string, string[]>();
{
  const seenPos = new Set<string>();
  const rl = readline.createInterface({ input: fs.createReadStream(DEFS_FILE) });
  for await (const line of rl) {
    const e = JSON.parse(line) as { word: string; pos: string; senses: { gloss: string; tags?: string[] }[] };
    if (e.word.includes(' ') || seenPos.has(`${e.word}|${e.pos}`)) continue;
    seenPos.add(`${e.word}|${e.pos}`);
    const main = e.senses.filter((s) => !(s.tags ?? []).some((t) => /^(slang|archaic|obsolete|rare|dated)$/.test(t)));
    const list = wikt.get(e.word) ?? [];
    list.push(...main.slice(0, 2).map((s) => s.gloss));
    wikt.set(e.word, list);
  }
}
const ecdict = loadEcdict();

/** Common enough to be given as a base word: in our lists, or ranked in ECDICT's frequency lists. */
function common(w: string): boolean {
  if (cardWords.has(w)) return true;
  const e = ecdict.get(w);
  if (!e || !wikt.has(w)) return false;
  return rank(w) <= 25000 || !!e.collins || e.oxford === '1';
}

/** A word and its inflections: decide → decides, decided, deciding. */
function inflections(w: string): Set<string> {
  const out = new Set([w]);
  const ex = ecdict.get(w)?.exchange ?? {};
  for (const k of ['p', 'd', 'i', '3', 's', 'r', 't']) for (const f of (ex[k] ?? '').split(',')) if (f) out.add(f.toLowerCase());
  return out;
}

/**
 * A word's main definitions (Wiktionary, the card's own `en`, ECDICT's English column), lower-case.
 * Only the main senses: a rare one links false pairs (copper: "a policeman" → cop).
 */
function defText(w: string, card?: CardWord): string {
  const own = wikt.get(w) ?? [];
  // "offence: standard spelling of offense" → use offense's definitions.
  const alt = own.flatMap((g) => [...g.matchAll(/spelling of ([a-z]+)/g)].flatMap((m) => wikt.get(m[1]) ?? []));
  const ecd = (ecdict.get(w)?.definition ?? '').split('\n').slice(0, 2);
  const text = [...own, ...alt, ...(card?.en ?? []).flatMap((g) => g.gloss.slice(0, 2)), ...ecd].join(' ').toLowerCase();
  // "the act of deciding" names the base, but "act" itself isn't one (activation ← act).
  return text.replace(/\b(the |an? )?act of\b/g, ' ');
}

/** Short everyday words that turn up in definitions but are never a base word (theory ← the). */
const STOPWORDS = new Set(['the', 'and', 'for', 'but', 'not', 'off', 'out', 'any', 'all', 'one', 'who', 'its', 'was', 'are', 'has', 'can', 'may']);

/**
 * Pairs the rules get wrong, checked by eye in data/reports/families.txt: "word>base" stops the
 * chain at that step (the word keeps any earlier link). Add to this list when a bad pair shows up.
 */
const BLOCK = new Set([
  'tatter>tat', 'lousy>louse', 'funky>funk', 'electronic>electron', 'irony>iron', 'relative>relation', 'batter>bat',
  'boundary>bound', 'fatal>fate', 'destiny>destine', 'transitive>transit', 'humanise>humane', 'classic>class',
  'footage>foot', 'gamely>game', 'intension>intense', 'hinder>hind', 'banish>ban', 'armory>arm', 'flagging>flag',
  'jarring>jar', 'strapping>strap', 'pressure>press', 'fruition>fruit', 'mercurial>mercury', 'insight>sight',
  'manage>man', 'incorporate>corporate', 'partial>part', 'formal>form', 'exception>except', 'mislead>lead',
]);

// ---------- candidate bases ----------

// [suffix, endings to put back]. Bad guesses are fine: the definition check throws them out.
const SUFFIXES: [string, string[]][] = [
  ['isation', ['ise', 'ize']], ['ization', ['ize', 'ise']], ['ification', ['ify']], ['ication', ['icate', 'ish', 'y']], ['ation', ['', 'e', 'ate']],
  ['ition', ['', 'e']], ['ption', ['be', 've', 'me']], ['uction', ['uce']], ['ution', ['ute', 've']],
  ['ension', ['end']], ['ansion', ['and']], ['ission', ['it']], ['ssion', ['ss', 'de', 'eed']], ['sion', ['de', 'd', 'se', 't']],
  ['ion', ['', 'e']], ['ment', ['']], ['ness', ['', 'y']], ['ity', ['', 'e', 'ous']], ['ility', ['le']], ['iety', ['ious']],
  ['ance', ['', 'e', 'ant']], ['ence', ['', 'e', 'ent']], ['ancy', ['ant']], ['ency', ['ent']], ['ant', ['', 'e']], ['ent', ['', 'e']],
  ['er', ['', 'e']], ['or', ['', 'e']], ['ist', ['', 'y', 'ism']], ['ism', ['', 'e']], ['ian', ['', 'y', 'ia']],
  ['ee', ['', 'e']], ['ure', ['', 'e']], ['al', ['', 'e']], ['ial', ['', 'y', 'e']], ['ical', ['ic', 'y']],
  ['ship', ['']], ['hood', ['']], ['dom', ['']], ['age', ['', 'e']], ['ery', ['', 'e']], ['th', ['', 'e']], ['y', ['', 'e']],
  ['able', ['', 'e', 'ate']], ['ible', ['', 'e', 'd', 'de']], ['ful', ['', 'y']], ['less', ['', 'y']],
  ['ous', ['', 'e', 'y', 'ion']], ['ious', ['y', 'ion', 'e']], ['ive', ['', 'e', 'ion', 'd', 'de']], ['ative', ['', 'e', 'ate']],
  ['ic', ['', 'e', 'y']], ['ish', ['', 'e']], ['ary', ['', 'e']], ['ory', ['', 'e']],
  ['ise', ['', 'e', 'y']], ['ize', ['', 'e', 'y']], ['ify', ['', 'e', 'y']], ['en', ['', 'e']],
  ['ly', ['', 'le', 'e']], ['ily', ['y']], ['ally', ['', 'al']],
  // No -ed / -ing: those cards are mostly verb forms in their examples ("Who designed this building?").
];
// Only prefixes that flip or spoil the meaning, as in the exam (re-, over-, out- … gave too many false
// pairs such as research ← search). The definition must also say so ("not", "lack of", "wrongly" …).
const PREFIXES = ['un', 'in', 'im', 'il', 'ir', 'dis', 'mis', 'non'];
const NEGATIVE = /\b(not|no|lack|lacking|without|absence|opposite|reverse|fail|failure|wrong|wrongly|badly|incorrectly|un[a-z]+)\b/;

/** Position in ECDICT's frequency lists (lower = more common); Infinity if unranked. */
function rank(w: string): number {
  const e = ecdict.get(w);
  const r = (s: string | undefined) => (Number(s) > 0 ? Number(s) : Infinity);
  return Math.min(r(e?.frq), r(e?.bnc));
}

function candidates(w: string, defs: string): string[] {
  const out = new Set<string>();
  if (NEGATIVE.test(defs)) for (const p of PREFIXES) if (w.startsWith(p) && w.length - p.length >= 3) out.add(w.slice(p.length));
  for (const [suf, ends] of SUFFIXES) {
    if (!w.endsWith(suf) || w.length - suf.length < 3) continue;
    const stem = w.slice(0, -suf.length);
    const stems = [stem];
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) stems.push(stem.slice(0, -1)); // beginner → begin
    if (stem.endsWith('i')) stems.push(stem.slice(0, -1) + 'y'); // happi|ness → happy
    for (const s of stems) for (const e of ends) out.add(s + e);
  }
  out.delete(w);
  return [...out];
}

/** One step back: the best base whose form appears in the definition of `w`. */
function stepBack(w: string, card?: CardWord): string | undefined {
  const text = defText(w, card);
  const tokens = text.split(/[^a-z]+/).filter(Boolean);
  const own = new Set([w, ...(card?.forms ?? []), ...(card?.variants ?? [])].map((x) => x.toLowerCase()));
  // A base is normally more common than the words made from it; a much rarer one is a false pair
  // (political → polity, digital → digit).
  const limit = rank(w) * 2;
  /** Where the definition first mentions a form of c ("activation: the act of activating" → activate). */
  const firstMention = (c: string) => {
    const forms = inflections(c);
    const i = tokens.findIndex((t) => forms.has(t));
    return i < 0 ? Infinity : i;
  };
  const found = candidates(w, text)
    .filter((c) => c.length >= 3 && !STOPWORDS.has(c) && !BLOCK.has(`${w}>${c}`) && common(c) && !own.has(c) && rank(c) <= limit)
    .map((c) => ({ c, at: firstMention(c) }))
    .filter((x) => x.at < Infinity);
  // The one mentioned first wins (humanise: "to make human or humane" → human); then the longest.
  return found.sort((a, b) => a.at - b.at || b.c.length - a.c.length)[0]?.c;
}

function baseOf(card: CardWord): { base: string; chain: string[] } | undefined {
  const w = card.word.toLowerCase();
  if (card.lemma || !/^[a-z]+$/.test(w)) return undefined; // inflected cards, phrases, hyphenated
  const chain: string[] = [];
  let cur = w;
  for (let i = 0; i < 3; i++) {
    const next = stepBack(cur, i === 0 ? card : undefined);
    if (!next || chain.includes(next) || next === w) break;
    chain.push(next);
    cur = next;
  }
  if (!chain.length) return undefined;
  return { base: chain[chain.length - 1], chain };
}

// ---------- run ----------

const lines: string[] = [];
let linked = 0;
for (const lvl of levels) {
  for (const card of lvl.words) {
    const r = baseOf(card);
    delete card.base;
    if (!r) continue;
    card.base = r.base;
    linked++;
    lines.push(`${card.word}\t${[card.word, ...r.chain].join(' ← ')}`);
  }
}
fs.mkdirSync('data/reports', { recursive: true });
fs.writeFileSync(REPORT, lines.join('\n') + '\n');
console.log(`${linked} of ${cards.length} cards have a base word. Report: ${REPORT}`);
if (WRITE) {
  for (const lvl of levels) fs.writeFileSync(lvl.file, '[\n' + lvl.words.map((w) => JSON.stringify(w)).join(',\n') + '\n]\n');
  console.log('Saved `base` into', LEVEL_FILES.join(', '));
}

// Debug: `node scripts/families.ts --why unconvincing` shows the candidates and why each was kept or dropped.
const why = process.argv[process.argv.indexOf('--why') + 1];
if (process.argv.includes('--why') && why) {
  const card = cards.find((c) => c.word === why);
  const text = defText(why, card);
  console.log({ text, negative: NEGATIVE.test(text), rank: rank(why) });
  for (const c of candidates(why, text)) console.log(c, { common: common(c), rank: rank(c), forms: [...inflections(c)].filter((f) => text.includes(f)) });
}
