# Mempo: Project Plan

> **Mempo**: *Make words stick!* Your little companion for learning words.
> GitHub: `GrowingRui/Mempo` · Hosting: Vercel

A website for learning Cambridge vocabulary (B2 / C1 / C2) every day. You set a daily goal, swipe each card to say whether you know the word, review learned words with spaced repetition, and keep practising a "Don't know" list until you know those words. Every word has Chinese and Spanish translations and English example sentences.

**Budget: $0.** Hosting is on Vercel's free Hobby plan, which is free for personal, non-commercial use.

---

## 1. Data source

| Level | Source URL | Approx. words |
|---|---|---|
| B2 (FCE) | https://minddory.com/english-vocabulary-list/fce | ~2,719 |
| C1 (CAE) | https://minddory.com/english-vocabulary-list/cae | ~2,170 |
| C2 (CPE) | https://minddory.com/english-vocabulary-list/cpe | ~2,272 |

Each entry contains only **headword + level + one example sentence**, and some entries have no example.
The site has **no translations, definitions or part of speech**, so we add them ourselves (Phase 1).

Data problems to clean up:
- C2 lists inflected forms as separate entries (abandoning, abandonment, abandons).
- Spelling variants appear as one entry (ardor/ardour, appall/appal).
- Some words probably appear in more than one level.

> ⚠️ The word lists belong to minddory. Fine for personal use. If the site becomes public, check their terms
> or switch to open word sources.

### Free sources for translations and extra data (used once, at build time)

| Need | Source | Licence |
|---|---|---|
| Chinese translation + part of speech | ECDICT (github.com/skywind3000/ECDICT) | MIT |
| Spanish translation | Wiktionary data from kaikki.org | CC BY-SA |
| Missing or extra example sentences | Tatoeba (tatoeba.org downloads) | CC BY |
| Ranking Spanish translations (build time only) | FrequencyWords Spanish 50k (github.com/hermitdave/FrequencyWords) | CC BY-SA |
| English definitions (optional) | Free Dictionary API (dictionaryapi.dev) / Wiktionary | Free |

No paid APIs. All lookups run once on the local PC, and the results are saved into static JSON.

---

## 2. Architecture

```
BUILD TIME (local PC, run once)            RUNTIME (user's browser)
┌───────────────────────────────┐          ┌──────────────────────────────────┐
│ scripts/scrape   → raw.json   │          │ Static React app (PWA)           │
│ scripts/enrich   → b2.json    │ ─push──▶ │  - loads /data/b2|c1|c2.json     │
│                    c1.json    │  GitHub  │  - progress in IndexedDB /       │
│                    c2.json    │    ↓     │    localStorage (per browser)    │
└───────────────────────────────┘  Vercel  │  - works offline                 │
                                           └──────────────────────────────────┘
```

- **Frontend:** React + Vite + TypeScript
- **Swipe and animation:** Motion (Framer Motion) drag gestures
- **Styling:** Tailwind CSS
- **Storage:** IndexedDB (via `idb-keyval`) or localStorage. No backend at first.
- **Pronunciation:** browser `speechSynthesis` (free, no API)
- **Hosting:** Vercel Hobby (free). Connect the GitHub repo and Vercel redeploys automatically on every push.
- **Optional later:** sync progress between devices with Supabase (free tier).

### Word data format (`public/data/b2.json`)
Each file is an array of words, one per line. `public/data/index.json` holds the counts and the source/licence list (show it on an About screen).
```json
{
  "id": "access",
  "word": "access",
  "level": "B2",
  "phonetic": "ˈækses",
  "pos": ["n", "v"],
  "zh": [{ "pos": "n", "gloss": ["通路", "入口", "接近", "进入"] }, { "pos": "v", "gloss": ["访问", "存取"] }],
  "es": [{ "pos": "n", "gloss": ["acceso"] }, { "pos": "v", "gloss": ["acceder"] }],
  "variants": ["..."],
  "forms": ["accessed", "accesses", "accessing"],
  "lemma": "focus",
  "examples": [
    { "text": "Is there wheelchair access?", "source": "https://tatoeba.org/en/sentences/show/2550188" },
    { "text": "She accessed the information from the digital archive.", "form": "accessed" }
  ]
}
```
- `zh` / `es` are grouped by part of speech (n, v, adj, adv, prep, conj, pron, interj, num, det, phr, abbr; `""` if unknown), best meanings first.
- `phonetic`, `variants`, `forms` and `lemma` are optional. `lemma` is set when the translations came from the base word (e.g. the card "focuses").
- `source` on an example is the Tatoeba link (CC BY attribution); show it as a small link. `form` means the example uses that inflected form.

### User progress format (stored in the browser)
```json
{
  "settings": { "level": "B2", "dailyNew": 20, "showZh": true, "showEs": true, "swipeKnow": "left" },
  "cards": {
    "b2-0001": { "state": "review", "box": 3, "due": "2026-11-13", "streak": 2, "lapses": 1, "inDontKnow": false }
  },
  "history": { "2026-11-06": { "new": 20, "reviewed": 35 } }
}
```

---

## 3. Learning logic

**Card states:** `new → learning → review → mastered`, plus a **"Don't know" list** that cards join and leave.

**Today's session order:**
1. Reviews that are due
2. "Don't know" words
3. N new words (N = the daily goal)

**Swipe "don't know":**
- The card goes back into the current session, about 3–5 cards later. It keeps coming back until it is answered "know".
- The card is added to the **"Don't know" list** and its review box resets to 1.

**Swipe "know":**
- The card moves up one box (Leitner system). Review intervals by box: **1 → 3 → 7 → 14 → 30 → 60 days**.
- A card leaves the "Don't know" list after **2 "know" answers in a row on different days**.
- After the 60-day box the card counts as `mastered`.

**Swipe direction:** a setting. Default is **left = know, right = don't know**, as requested.
Buttons and arrow keys also work.

---

## 4. Screens

1. **Home:** choose level, today's progress (new / reviews / don't know), streak, "Start" button
2. **Study (cards):**
   - Front: word, 🔊 button, example sentence.
   - Tap to flip; the back shows Chinese and Spanish translations and part of speech.
   - Swipe the card off in either direction, with a green or red colour hint.
3. **Review:** practise only cards that are due
4. **Don't know list:** list of hard words, plus a "Practise these" button
5. **Word list:** browse and search all words, filter by level and status
6. **Stats:** words learned per level, streak, daily history
7. **Settings:** daily goal, level, show Chinese/Spanish, swipe direction, dark mode, export/import progress

---

## 5. Implementation phases

### Phase 0: Data collection ✅ (done 2026-11-07)
- [x] `scripts/scrape.ts` fetches the three pages once (cached in `data/cache/`) and parses `{word, level, example}`
- [x] Clean up: spelling variants, inflected forms, duplicates across levels (rules below)
- [x] Output `data/raw.json` + review report `data/reports/phase0.md`

Commands: `npm run data:fetch-dicts` (downloads ECDICT into `data/dict/`), then `npm run data:scrape`.
Needs Node ≥ 23.6 (runs `.ts` directly, no dependencies).

Result: 7,161 scraped entries → **6,128 cards** (B2 2,672 · C1 1,847 · C2 1,609). (6,173 at first; Phase 1 added suffix rules that merged 45 more inflections ECDICT did not know, such as minimalised and refocusses.)

Clean-up rules as built:
- **IDs** are the slug of the headword (`carbon-dioxide`), not `b2-0001`, so they stay stable when the data is rebuilt and saved progress keeps pointing at the right card.
- **Spelling variants** become one card with `variants`: slashed pairs (harbor/harbour), hyphen/space differences (last minute / last-minute, co-operate / cooperate), and British -ise/-yse vs -ize/-yze. A word listed in two levels keeps the lowest.
- **Inflected forms** (accessed, accesses, accessing) merge into the base card as `forms`, and their example sentences come along. ECDICT's lemma data decides what counts as an inflection, with plain suffix rules for words ECDICT does not know. A form keeps its own card if it has a meaning of its own (daunting, relieved, concerning, statistics, odds) or was listed at an easier level than its base.
- **Derived words** (abandonment, abruptly) are different words and keep their own card.
- Hand corrections go in `scripts/overrides.ts` (`KEEP_SEPARATE`, `MERGE`).
- Examples keep their Tatoeba URL (`source`) for CC BY attribution. The 219 cards with no example were filled in Phase 1.

### Phase 1: Add translations and examples ✅ (done 2026-11-07)
- [x] ECDICT → Chinese meanings, part of speech, phonetics
- [x] kaikki.org Wiktionary → Spanish translations
- [x] Tatoeba → examples for cards that had none (prefers ~9-word sentences)
- [x] Output `public/data/b2.json`, `c1.json`, `c2.json`, `index.json`
- [x] Report `data/reports/phase1.md` → gaps fixed by hand in `scripts/manual.ts`

Commands: `npm run data:fetch-dicts` (downloads everything into `data/dict/`; needs `bzip2`, which Git Bash has), `npm run data:scrape`, then `npm run data:enrich`.

Result: Chinese, Spanish and at least one example for **all 6,128 cards**. Files: b2 943 KB, c1 623 KB, c2 530 KB (much smaller gzipped).

How it works:
- **Chinese:** ECDICT lines grouped by part of speech, up to 4 meanings each. Web ("[网络]") and specialist ("[计]") lines are used only when nothing else exists. Inflected cards with no meaning of their own use the base word's.
- **Spanish:** first the English entry's translation tables. Ranking: senses covered, whether the Spanish word glosses back to the English one, word frequency (FrequencyWords top 50k, build time only); regional/rare words drop. If the entry has no Spanish, Spanish entries whose English gloss is the word are used ("ocultar: to hide, conceal"). Then American spellings (endeavour → endeavor), the base word, and adjective + *-mente* for adverbs.
- **Hand fixes** (`scripts/manual.ts`): ~390 translations the sources missed or got wrong, plus 35 hand-written examples (no `source`). Re-check the report after each run.
- Known limits: Spanish from Wiktionary is sometimes off for less common words; `manual.ts` is the place to correct them as you notice them while studying. A few list entries look like errors in the source list (unscathing, bereftly, evokingly, vol); they are kept and translated as best as possible.

### Phase 2: Basic working app (MVP) (in progress, started 2026-11-07)
- [x] Vite + React + TS + Tailwind project setup (Vite 8, React 19, Tailwind 4, TypeScript 7)
- [x] `git init` and connect to the `GrowingRui/Mempo` GitHub repo (remote `origin` set; first push pending)
- [x] `src/config/site.ts` holds the app name, tagline and URLs in one place, so the app can be renamed later by editing one file
- [x] Home screen with level choice + daily goal
- [x] Card component: flip front and back, speech button
- [x] "Know" / "Don't know" buttons
- [x] Save progress to localStorage
- [ ] First deploy to Vercel (check that the pipeline works early)

Commands: `npm run dev` (local dev server), `npm run build` (type-check + build to `dist/`), `npm run preview`.

How it works so far:
- Screens switch with React state (no router yet). `src/lib/session.ts` picks today's new words in a fixed shuffled order (hash of the word id), so they're not alphabetical and the order is the same on every visit.
- The daily goal counts new words across all levels per calendar day (local time).
- `answer()` in `session.ts` is a simple placeholder: "know" → box +1, due tomorrow; "don't know" → box 1 and added to the "Don't know" list. Phase 3 replaces it with full Leitner boxes and re-queueing.
- Progress is saved under the localStorage key `mempo:progress`, in the format from section 2.

### Phase 3: Learning logic and swiping (4–6 days)
- [ ] Spaced repetition (Leitner boxes, due dates)
- [ ] Session queue: due reviews → don't-know words → new words; failed cards are put back into the queue
- [ ] "Don't know" list logic (join and leave)
- [ ] Swipe gestures with Motion (drag, colour hint, fly off, snap back)
- [ ] Keyboard arrows for desktop
- [ ] Review, Don't know list and Word list screens

### Phase 4: Polish (3–5 days)
- [ ] Stats + daily streak
- [ ] Settings screen (translation display, swipe direction, dark mode)
- [ ] PWA: manifest + service worker (`vite-plugin-pwa`) so the app installs on a phone and works offline
- [ ] Export / import progress as a JSON file (backup)
- [ ] Mobile layout testing

### Phase 5: Deploy to Vercel (half a day)
- [ ] Push the repo to GitHub
- [ ] vercel.com → "Add New Project" → import the repo → framework preset **Vite** → Deploy
- [ ] Free URL: `https://mempo.vercel.app` (or a similar name if that one is taken)
- [ ] Every `git push` to `main` redeploys automatically

### Phase 6 (optional): Sync across devices
- [ ] Supabase free tier: Google login + a `progress` table
- [ ] Sync localStorage ↔ Supabase when the user is logged in

### Phase 7 (optional, later): AI features
Only after the core app works. Each AI call costs a little money, so this breaks the $0 budget.
- [ ] Vercel serverless function calls an AI API; the API key stays in Vercel environment variables, never in the browser
- [ ] Generate new example sentences or short stories that use the learner's own words
- [ ] Check sentences the learner writes with a new word, and give feedback
- [ ] Daily usage limit to keep costs small

---

## 6. Planned folder structure

```
Mempo/
├── PLAN.md
├── scripts/            # build-time data pipeline (not deployed)
│   ├── fetch-dicts.ts  # downloads dictionaries into data/dict
│   ├── scrape.ts       # Phase 0 → data/raw.json
│   ├── enrich.ts       # Phase 1 → public/data/*.json
│   ├── overrides.ts    # hand corrections to merging
│   └── manual.ts       # hand-written translations and examples
├── data/               # raw + downloaded dictionary files (git-ignored if large)
├── public/
│   └── data/           # final b2.json, c1.json, c2.json (deployed)
├── src/
│   ├── components/     # Card, SwipeDeck, ProgressBar, ...
│   ├── pages/          # Home, Study, Review, DontKnow, WordList, Stats, Settings
│   ├── config/         # site.ts: app name, tagline, URLs (the single place to rename the app)
│   ├── lib/            # srs.ts (spaced repetition), storage.ts, session.ts
│   └── main.tsx
└── package.json
```

---

## 7. Open decisions (defaults in bold)

1. Swipe direction: **left = know** (adjustable in settings)
2. Inflected forms: **decided 2026-11-07:** inflections merge into the base word (abandon / abandoning → one card); derived words such as abandonment keep their own card
3. Public or private: **private / personal use** for now
4. Framework: **React + Vite + TypeScript**
5. Offensive words and slurs (gook, retard, …): **decided 2026-11-07:** they stay in the vocabulary. Possible future feature: a dedicated explanation for sensitive and offensive terms, covering their meaning, historical context and appropriate usage.

## 8. Cost summary

| Item | Cost |
|---|---|
| Vercel Hobby hosting | $0 |
| GitHub repo | $0 |
| Dictionary data (ECDICT, Wiktionary, Tatoeba, FrequencyWords) | $0 |
| Pronunciation (browser speech) | $0 |
| Custom domain (optional) | ~$10/year |
