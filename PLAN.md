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
- **Swipe and animation:** Motion (`motion` package, formerly Framer Motion) drag gestures
- **Styling:** Tailwind CSS
- **Storage:** IndexedDB (via `idb-keyval`) or localStorage. No backend at first.
- **Pronunciation:** pre-made MP3 per word in `public/audio/` (~35 MB), generated once by `scripts/gen-audio.py` with Piper TTS, British voice "cori" (free, runs locally, public-domain training data). Same accent on every device. Falls back to browser `speechSynthesis` if a file is missing. (Browser voices alone were not enough: they depend on the voices installed on the device, e.g. Firefox on a Spanish Windows read English with a Spanish voice.)
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
  "settings": { "level": "B2", "dailyNew": 20, "showZh": true, "showEs": true, "showEn": true, "swipeKnow": "left", "theme": "light", "maxReviews": 100 },
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
- The card goes back into the current session, about 10–15 cards later (changed from 3–5 on request, 2026-11-07). It keeps coming back until it is answered "know".
- The card is added to the **"Don't know" list** and its review box resets to 1.

**Swipe "know":**
- The card moves up one box (Leitner system). Review intervals by box: **1 → 3 → 7 → 14 → 30 → 60 days**.
- A card leaves the "Don't know" list after **2 "know" answers in a row on different days**.
- After the 60-day box the card counts as `mastered`.

**Swipe direction:** a setting. Default is **left = know, right = don't know**, as requested.
Buttons and arrow keys also work.

---

## 4. Screens

> **Layout since 2026-11-14 (see I below):** phones have a bottom tab bar (Today · Practice · Words · Stats; Settings is the gear on Today); tablets and computers have a sidebar (Today · Practice · Words · Stats · Settings). Study, quizzes and the level test are full-screen, without tabs or sidebar.

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

### Phase 2: Basic working app (MVP) ✅ (done 2026-11-07)
- [x] Vite + React + TS + Tailwind project setup (Vite 8, React 19, Tailwind 4, TypeScript 7)
- [x] `git init` and connect to the `GrowingRui/Mempo` GitHub repo (remote `origin`, pushed)
- [x] `src/config/site.ts` holds the app name, tagline and URLs in one place, so the app can be renamed later by editing one file
- [x] Home screen with level choice + daily goal
- [x] Card component: flip front and back, speech button
- [x] "Know" / "Don't know" buttons
- [x] Save progress to localStorage
- [x] First deploy to Vercel (check that the pipeline works early) (done by the user 2026-11-07)
- [x] Added on request: custom daily goal (1–500 words, "Custom" chip next to 10/20/30/50)
- [x] Added on request: a third answer, **"Not sure"**, between Know and Don't know

Commands: `npm run dev` (local dev server), `npm run build` (type-check + build to `dist/`), `npm run preview`.

How it works so far:
- Screens switch with React state (no router). Since 2026-11-09 each screen is also a browser history entry so the phone's Back button works (Backlog F). `src/lib/session.ts` picks today's new words in a fixed shuffled order (hash of the word id), so they're not alphabetical and the order is the same on every visit.
- The daily goal counts new words across all levels per calendar day (local time).
- `answer()` started as a simple placeholder; Phase 3 replaced it with full Leitner boxes (`src/lib/srs.ts`).
- Progress is saved under the localStorage key `mempo:progress`, in the format from section 2.

### Phase 3: Learning logic and swiping ✅ (done 2026-11-07)
- [x] Spaced repetition (Leitner boxes, due dates): `src/lib/srs.ts`
- [x] Session queue: due reviews → don't-know words → new words; failed cards are put back into the queue (`src/lib/session.ts`)
- [x] "Don't know" list logic (join and leave)
- [x] Swipe gestures with Motion (drag, colour hint, fly off, snap back): `src/components/SwipeCard.tsx`
- [x] Keyboard arrows for desktop
- [x] Review, Don't know list and Word list screens

How it works:
- **Boxes:** "know" moves a card up one box; boxes 1–6 mean 1 / 3 / 7 / 14 / 30 / 60 days. "Know" in box 6 makes it `mastered` (no more reviews). A new word you already know starts in **box 2** (due in 3 days), so known words don't come back the next day.
- **Not sure:** down one box, due tomorrow; not added to the "Don't know" list. **Don't know:** box 1, due tomorrow, added to the list. A *lapse* is counted when a card in box 2+ is answered "don't know".
- **Only the first answer of the day moves a card up.** Seeing a card again the same day (it came back in the session, or the list was practised twice) never pushes it further out; a wrong answer always counts.
- **Leaving the "Don't know" list:** 2 "know" answers on 2 different days in a row. Getting it right later on the same day you missed it doesn't count.
- **Inside a session:** a "don't know" card comes back 10–15 cards later, a "not sure" card 15–20 cards later (or at the end), until it's answered "know".
- **Reviews and the "Don't know" list cover all levels**; new words come from the chosen level. Home shows due reviews, list size and a breakdown on the Start button.
- **Swiping:** left / right follow the "know" side setting (default left = know), **up = not sure**. Release past 110 px or flick fast to answer; otherwise the card springs back. Tapping flips; a drag never flips. Keys: ← → ↑, Space / Enter flips, Esc leaves.
- **Review** opens the study screen with due cards only (shows the next review date if none). **Don't know** lists the words (most recently missed first) with a "Practise these" button. **Word list** searches English, Chinese and Spanish (accents ignored), filters by level and status, and opens a word to show its meanings and next review.
- Progress saved by Phase 2 still loads; the new rules apply from the next answer.

### Between Phase 3 and 4 (added on request, 2026-11-07)
- [x] **Start over:** a "Start over" link under the Start button (only shown once there is progress) opens a confirmation dialog. It deletes all cards and daily history in this browser and keeps the level and daily goal. Move it into the Settings screen in Phase 4.
- [x] **Redesign, "Playful & bright"** (chosen by the user from 4 directions):
  - Colours (tokens in `src/index.css`): periwinkle-to-lilac background `#eef0ff → #f6eeff`, indigo text `#1f1a4d`, grape `#6b4ef5` as the main colour, mint `#1fbf78` = know, sunflower `#ffc233` = not sure, coral `#ff5a5f` = don't know, marker yellow `#ffe27a` behind the word in examples.
  - Fonts: Bricolage Grotesque (words, headings, buttons) + Figtree (body). Fraunces removed.
  - Chunky 3D keys: `.press` gives a solid edge underneath that disappears when pressed; set its colour with `[--edge:…]` and its height with `[--depth:…]`. `.press` / `.raised` live in `@layer components` so Tailwind utilities can override them.
  - Mascot **Mempo** (`src/components/Mascot.tsx`): a grape blob with a sprout, moods `happy` / `cheer` / `sad`. It is the logo and favicon, rides along the study progress bar, cheers on the done screen and looks sad in the Start over dialog.
  - No all-caps labels; section titles are sentence case.
- [x] **Level test** (`src/pages/LevelTest.tsx`, logic in `src/lib/leveltest.ts`): opened from "Not sure? Take a level test" next to "Your level" on Home.
  - 30 random words, 10 from each of B2 / C1 / C2, shuffled. Pick the meaning in 中文 or Español from 4 options (wrong options come from the same level and part of speech), or tap "I don't know".
  - Spanish cognates (e.g. *secular* = *secular*) are not asked, because they would be free points.
  - Result: score per level, a rough count of known words (score × level size), and a suggested level = the first level under 80%. One tap switches the level. The test never changes learning progress.

### Phase 4: Polish ✅ (done 2026-11-07)
- [x] Stats + daily streak
- [x] Settings screen (translation display, swipe direction, dark mode, move "Start over" here)
- [x] PWA: manifest + service worker (`vite-plugin-pwa`) so the app installs on a phone and works offline
- [x] Export / import progress as a JSON file (backup)
- [x] Mobile layout testing

How items 1 and 2 work:
- **Streak** (`src/lib/stats.ts`): a day counts if at least one card was answered. Not studying yet today doesn't break the streak; it ends at yesterday until midnight. Home's header shows a flame with the streak (grey until you study today); tapping it opens **Stats**.
- **Stats** (`src/pages/Stats.tsx`): streak and longest streak, words seen / mastered / days studied, a 14-day chart (new words at the bottom, reviews on top; tap a day for its numbers, a hidden table for screen readers) and a bar per level (mastered → reviewing → learning → don't know, rest = not seen) with the counts written underneath. Chart colours are `--color-bar-*` tokens, checked with the dataviz palette validator (light passes; in dark the yellow is a little brighter than its guideline, accepted to keep the app's "Not sure" yellow).
- **Settings** (`src/pages/Settings.tsx`, the sliders button on Home): theme Light (default) / Dark / Auto, Chinese and Spanish on/off (at least one stays on), swipe direction, and "Start over" (moved from Home; `src/components/ResetDialog.tsx`). Level and daily goal stay on Home.
- **Dark mode**: `:root.dark` in `src/index.css` gives the same colour names new values; `src/lib/theme.ts` sets the class and follows the device when on Auto; a small script in `index.html` sets it before the first paint. New tokens: `brand-ink` / `know-ink` / `dontknow-ink` for coloured text (lighter in dark), and `deep` (always-dark indigo) for text on yellow, the marker, Mempo's face and the dialog backdrop.

How items 3–5 work:
- **Installable app**: `vite-plugin-pwa` in "injectManifest" mode with our own service worker, `src/sw.ts`. Install saves the app, fonts, icons and all three word lists (~2.7 MB) so everything works offline, including opening any address (it serves `index.html`). Icons in `public/` are made from `public/favicon.svg` by `npm run icons` (`pwa-assets.config.ts`); the padded ones get the light background.
- **Pronunciation offline**: MP3s are not saved on install (~51 MB). Each one is saved the first time it plays (cache `mempo-audio-v1`). The service worker always fetches and stores the whole file and then answers the `<audio>` element's byte-range request from it, because partial (206) answers can't be cached. Settings → Offline shows how many are saved and has "Save all for offline" (6 downloads at a time, can be stopped and continued). Without a saved file the device's own voice reads the word, as before.
- **Updates**: a new version doesn't take over by itself, so a study session is never cut off. A toast at the top says "A new version is ready" with **Update** / Later (`src/components/UpdatePrompt.tsx`); it also says once that the app now works offline. An open app checks for a new version every hour.
- **Backup** (Settings → Your progress, `src/lib/backup.ts`): "Download backup" saves `mempo-backup-YYYY-MM-DD.json` = `{ app, version, exportedAt, progress }` (progress in the section 2 format). "Restore backup" reads a file, shows what's in it (date, words, days of history) and replaces this browser's progress and settings after a confirmation. Broken entries are skipped (`normalizeProgress` in `src/lib/storage.ts`, which now also cleans what's loaded from localStorage); a file that isn't a backup gives a clear message. `ResetDialog` and the restore dialog share `src/components/ConfirmDialog.tsx`.
- **Phone layout**: every screen checked at 320 / 360 / 390 / 430 px wide, light and dark, plus short screens. Fixes: Home's header no longer overlaps or truncates the tagline on small phones; tiles, level names and the "Custom" chip fit at 320 px; the study card's minimum height drops on short screens (under 720 px tall), so the answer buttons stay on screen on an iPhone SE in Safari.

### After Phase 4 (added on request, 2026-11-07)
- [x] **"Install app" button** (`src/lib/install.ts`, `src/components/Install.tsx`):
  - Home: a small "Get the app" card under Start, with **Install** and × (× hides it for good in this browser, key `mempo:install-dismissed`). Settings → Offline: an "Install the app" row that always explains the situation.
  - Chrome / Edge / Samsung Internet: the button opens the browser's own install dialog (`beforeinstallprompt`, caught in `main.tsx` before React renders). iPhone / iPad: a sheet with Share → Add to Home Screen. Android without the event (Firefox): menu → Install. Safari on a Mac: File → Add to Dock.
  - Hidden when running as the installed app ("You're using the installed app") and right after installing. Desktop Firefox can't install, so Settings says which browsers can.
- [x] **README.md** for the GitHub repo: what Mempo is, how to use it, installing on each device, offline use, backups, developer commands, credits. Screenshots in `docs/`.

### Phase 5: Deploy to Vercel ✅ (done 2026-11-07)
- [x] Push the repo to GitHub (`GrowingRui/Mempo`)
- [x] vercel.com → "Add New Project" → import the repo → framework preset **Vite** → Deploy
- [x] Free URL: `https://mempo.vercel.app`
- [x] Every `git push` to `main` redeploys automatically

### Phase 6 (optional): Sync across devices
- [ ] Supabase free tier: Google login + a `progress` table
- [ ] Sync localStorage ↔ Supabase when the user is logged in

### Phase 7 (optional, later): AI features
Only after the core app works. Each AI call costs a little money, so this breaks the $0 budget.
- [ ] Vercel serverless function calls an AI API; the API key stays in Vercel environment variables, never in the browser
- [ ] Generate new example sentences or short stories that use the learner's own words
- [ ] Check sentences the learner writes with a new word, and give feedback
- [ ] Daily usage limit to keep costs small

### Backlog: next ideas (noted 2026-11-07)
Pick any of these up whenever we want; each still needs approval before work starts.

**A. Tests for the learning logic** ✅ (done 2026-11-07)
- [x] Vitest added (free, open source). `npm test` runs everything once, `npm run test:watch` reruns on every change. Config: `vitest.config.ts` (kept apart from `vite.config.ts`, so no PWA/Tailwind plugins load).
- [x] 75 tests in `src/lib/*.test.ts` (shared builders in `src/lib/test-helpers.ts`). They aren't part of the website build.
  - `srs.test.ts`: boxes and intervals, mastered, "not sure" / "don't know", lapses, only the first answer of the day moves a card up, leaving the "Don't know" list after 2 "know" days, history counts, `isDue`, `statusOf`, `nextReview`
  - `session.test.ts`: daily goal left, session order (reviews → don't know → new), new words only from the chosen level and in a stable order, review / dontknow modes, `requeue` gaps (10–15 and 15–20 cards)
  - `stats.test.ts`: streak (today not done yet, gaps, longest, across year end), 14-day chart, per-level breakdown
  - `storage.test.ts`: cleaning saved/restored progress, backup file reading and its error messages, date helpers
- Checked that the tests catch real mistakes: changing the 60-day interval or the "2 days to leave Don't know" rule makes 4 tests fail.
- Run `npm test` before pushing changes to the learning logic.

**B. Learning improvements** ✅ (done 2026-11-07)
- [x] **Active recall mode** (chosen by the user): "Recall" button on Home, its own screen (`src/pages/Recall.tsx`, logic in `src/lib/recall.ts`). Three exercises, 15 words a round, only words you've studied, weakest first ("Don't know" → due → low boxes → the rest):
  - **Meaning → word:** see 中文 / Español, pick the English word from 4 (wrong choices share the level and part of speech, never the same meaning)
  - **Listen → word:** hear the audio, pick the written word
  - **Spell it:** see the meaning, a gap-fill example and the first letter, type the word. Forms and spelling variants count; one typo shows "Almost!" but counts as wrong
  - A Spanish meaning that spells out the answer (secular = secular, aluminio = aluminium) is hidden when Chinese is shown too
  - It doesn't move cards between boxes. At the end, missed words can be added to "Don't know" with one tap
- [x] English definitions on the card back, after 中文 / Español, with an "English" toggle in Settings → Meanings. Up to 2 definitions for up to 2 parts of speech; 99% of words have them. Wording from English Wiktionary (`data/dict/kaikki-en-defs.jsonl`, a new step in `npm run data:fetch-dicts`), put in WordNet's "most common meaning first" order (ECDICT's English column), slang and old senses left out. Inflected cards ("achieving") use the base word. Hand-written definitions for poor cases: `en` in `scripts/manual.ts`. Word files grew from 2.1 MB to 3.2 MB (much less gzipped)
- [x] "Report a translation" link on the back of the card. No server: it opens a pre-filled GitHub issue on the public repo with what's shown now, the suggestion, and a line ready to paste into `scripts/manual.ts` (`src/lib/report.ts`)
- [x] Notes for sensitive / offensive words (decision 5): 26 hand-written notes in `scripts/sensitive.ts`. **Offensive** (gook, retard, cripple, gypsy): red "Offensive" tag on the front of the card and a red note on the back. **Use with care** (22, e.g. queer, dumb, fat, bloody, damn, screw, alien, rape): normal words with a rude or hurtful use, yellow note on the back only. Notes also show in the word list. The enrich report lists the other words Wiktionary flags (mostly false alarms such as one rare slang sense of "plumber")
- [x] Daily review cap: Settings → "Reviews per day" (50 / **100** / 200 / no limit). Today's session takes the most overdue reviews first; the rest wait for the next days. "Reviews due" on Home still lets you do them all

**C. Keeping users coming back** ✅ (done 2026-11-08)
- [x] **Daily reminder notification** (done and live 2026-11-08, tested by the user on a real device). Real web push, still $0, chosen by the user over an Android-only no-server version:
  - Settings → **Daily reminder**: switch + time (06:00–23:00, default 19:00). Only on days not studied yet; mentions the streak if it's still alive ("Keep your 5-day streak going 🔥"). Per device, not in backups. On iPhone / iPad Safari it explains to install first (push works only in the installed app, iOS 16.4+)
  - App side: `src/lib/reminder.ts`, `src/components/Reminder.tsx`; `src/sw.ts` shows the notification, a tap opens Mempo. `App.tsx` tells the server after the first study of the day (and when the time zone or push address changes)
  - Server: one Vercel function, `api/reminders.ts` (POST save, DELETE remove, GET send with `CRON_SECRET`). Stores per device: push address, time, time zone, last day studied + streak, last day sent. Upstash Redis (free) over its REST API; in memory when run locally. Expired subscriptions (404/410) are deleted. Tests: `api/_reminders.test.ts`
  - Scheduler: `.github/workflows/reminders.yml` calls the send endpoint every 15 min. A reminder can be up to ~15 min late (plus GitHub's own delay); one that's more than 3 h late is skipped for that day
  - `npm run dev` / `npm run preview` also serve `/api/*` (plugin in `vite.config.ts`), with keys from `.env.local` (git-ignored)
  - **Live setup (done 2026-11-08):** Vercel → Storage / Marketplace → add **Upstash for Redis** (free) to the project; Vercel env vars `VAPID_PRIVATE_KEY` and `CRON_SECRET` (values in `.env.local`); GitHub repo secret `CRON_SECRET` (same value). The Upstash database is the free one from 22 Oct 2026, shared with another project; Mempo uses only the key `mempo:reminders`
- [x] **Move to another device** (done and live 2026-11-08). The simpler step before real sync (Phase 6):
  - Settings → **Move to another device**: "Show QR code" / "Enter a code" (`src/components/Move.tsx`, `src/lib/move.ts`)
  - A QR code can't hold the backup itself (~3 KB max, a few hundred words), so it holds a link with a one-time code: `…/?move=K7M2QX9D`. The app gzips the backup file's contents (`backupJson` in `src/lib/backup.ts`) and uploads it; the worst case (all 6,133 words + 2 years of history) is ~43 KB
  - Server: `api/move.ts` (POST → code, GET ?code= → data). Kept 10 min in the same Upstash Redis as reminders under `mempo:move:<code>`, then Redis deletes it. Codes are 8 characters of Crockford base32 (no I/L/O/U; typing O counts as 0, I/L as 1). Not deleted when read, so a cancelled restore can be retried. Tests: `api/_move.test.ts`, `src/lib/move.test.ts`
  - Receiving: scanning opens the app on Settings and asks "Bring over this progress?" (same dialog and cleaning as Restore backup); the code is removed from the address. Typing the code works too, which iPhones need when Mempo is installed (the camera opens Safari, which has separate storage)
  - No new Vercel settings: it uses the Upstash keys the reminders already have
- [x] **Usage stats** (done and live 2026-11-08). Our own counter, $0, chosen by the user over Vercel Analytics: Vercel's free analytics resets visitors every day and custom events need the paid plan, so it can't show whether people come back
  - App (`src/lib/usage.ts`): each device makes up a random 16-hex-digit id (`mempo:device`). At most two pings a UTC day: **open** (start, and when an open app comes back into view) and **study** (first answered card; counts as an open too). No IP, device details, words or answers. Failed pings are retried next time. Per device, not in backups
  - Settings → **Privacy → Anonymous usage counts**: on by default; switching off sends nothing and forgets the id
  - Server: `api/stats.ts`. POST records the ping in the shared Upstash Redis: `mempo:stats:first` (id → first day) and day sets `mempo:stats:{new,open,study}:<day>` (expire after 400 days). Max 500 new devices a day, so nobody can flood the database. Tests: `api/_stats.test.ts`, `src/lib/usage.test.ts`
  - **Report:** open `https://mempo.vercel.app/api/stats?key=<STATS_KEY>` (bookmark it; `&format=json` for raw numbers). Devices ever, active in 7 / 30 days, how many new devices came back **the next day / within a week / in weeks 2–4** (only windows that are over), and a 30-day table (opened, studied, new, returning). The key is `STATS_KEY` in Vercel env vars, or `CRON_SECRET` if that isn't set
  - The service worker no longer answers `/api/…` page visits with the app, so the report opens in a browser where Mempo is installed

**D. App in more languages** ✅ step 1 done and live 2026-11-08 · step 2 optional, future
The app's own texts (buttons, hints, messages) in other languages. Separate from the word meanings on the cards, which don't change.
Some users need the interface (Settings especially) in their own language. **Decided by the user 2026-11-08: Chinese and Spanish first, German later.**
- [x] **Step 1: 中文 + Español interface** (done and live 2026-11-08):
  - **Language picker at the top of Settings**: English · 中文 · Español, each written in its own language, with a 🌐 icon so it can be found even in a language you can't read. **The default stays English** (decided by the user 2026-11-07: don't switch automatically from the phone's language)
  - The picker switches the **whole app**, not just Settings (a translated Settings page followed by an English Home screen would feel broken)
  - Move every English text (~300, ~15 screens) into one table with one version per language; no paid service or big library. Built so that adding a language later only means adding its column
  - Plurals ("1 word / 5 words") and dates per language with the browser's built-in `Intl` rules
  - Card meanings stay as they are (中文 / Español meanings + English definitions)
  - Check every screen at phone size in each language; Chinese uses the phone's own font (not in the app's fonts)
  - Translation check: the user reviews Chinese and Spanish
  - Show on localhost and get approval before pushing
  - How it works as built:
    - Texts in `src/i18n/en.tsx` (the master), `zh.tsx`, `es.tsx`. TypeScript checks that every language has every key with the same parameters. Texts with numbers are small functions (`words(5)` → "5 words" / "5 个词" / "5 palabras"); numbers and dates use each language's own format
    - Components read texts with `useT()`; code outside React (error messages in `src/lib/*.ts`) uses `tr()`. Both follow `settings.lang` (`"en" | "zh" | "es"`, default `en`), which is saved with the other settings, so backups and "Move to another device" bring it along
    - Server error messages stay in English on the server; the app shows its own translated message based on the error status
    - The daily reminder notification is sent in the app's language (`lang` is stored with the reminder in `api/reminders.ts`)
    - Not translated: the word content (examples, English definitions, notes on sensitive words), the app name, and what reaches the developer (feedback email subject and details, which now include "App language")
    - Tests: `src/i18n/i18n.test.ts`, plus language cases in `api/_reminders.test.ts`
    - Checked every screen at 320 px in all three languages; a few Spanish/Chinese texts were shortened to fit (taglines, "词库", swipe-side buttons)
    - Final check 2026-11-08: all Chinese and Spanish texts reviewed (including plurals, dates and the reminder notification), 167 tests pass, type-check clean
- [ ] **Step 2 (optional, future): Deutsch.** Not planned yet; only if wanted later
  - Copy `src/i18n/zh.tsx` to `de.tsx` and translate it, add it to `LANGS` / `MESSAGES` in `src/i18n/index.tsx`, to `Lang` in `src/lib/types.ts` and `cleanSettings` in `src/lib/storage.ts`, and to `TEXT` / `LANGS` in `api/reminders.ts`
  - Check layouts: German words are long ("Weiß ich nicht") and may overflow buttons
  - Translation check ideally by a native speaker
  - German meanings on the cards (about half a day to a day more): a German interface without German meanings would feel half done. Same free source and pipeline as Spanish (Wiktionary translation tables via kaikki.org), then a quality check

**E. Feedback and problem reports** ✅ (done and live 2026-11-08)
A way for users to send suggestions or report problems to xiarui091@gmail.com without leaving the app. About an hour of work.
- [x] **Form in the app:** "Send feedback" item in the Settings / menu. Type (Bug / Suggestion / Wrong word info / Other), message, and an optional email field only for those who want a reply. Sending shows "Thanks! Sent" and the user stays in the app. No mail app needed, so it works on phones, laptops and the installed app
- [x] **Details added automatically:** app version, device / browser, current screen, and the word when reported from a card, so bugs can be reproduced without asking back
- [x] **Server:** new Vercel function `api/feedback.ts`, same pattern as `api/move.ts` / `api/reminders.ts`. Emails the message to xiarui091@gmail.com through **Resend** (free: 3,000 emails/month; its test sender `onboarding@resend.dev` can deliver to the account's own address without verifying a domain). The user's email, if given, becomes **Reply-To**, so pressing Reply in Gmail answers them. Tests: `api/_feedback.test.ts`
- [x] **Spam protection:** hidden trap field that only bots fill in; 5 messages per hour per network address (only a hash is kept) and 100 a day in total, counted in the shared Upstash Redis under `mempo:feedback:*` (expiring keys); maximum message length
- [x] **Fallback:** if sending fails, the form shows "Send by email instead", a `mailto:` link with the message pre-filled. The address is hidden from bots: stored in two parts (`site.feedbackMail`) and only joined in the browser, so it isn't in the built files
- [x] **One-time setup for the user (~5 min):** sign up at resend.com with xiarui091@gmail.com, create an API key, add `RESEND_API_KEY` to Vercel env vars and `.env.local`
- [x] **Card report (decided 2026-11-08):** "Report a problem" on the card back now sends through this form (word, what's shown and the `scripts/manual.ts` line are attached). A small "Open a GitHub issue" link stays for people who prefer it public
- Shown on localhost and approved; a real test email arrived. Resend key (sending access only) is in Vercel and `.env.local`

**F. Phone Back button** ✅ (done 2026-11-09)
Before, screens switched only in memory, so Android's Back button (and the browser's) closed Mempo instead of going back.
- [x] Every screen is a browser history entry (`src/lib/nav.ts`; the address doesn't change). **Back goes one screen back** (Practise → the "Don't know" list → Home); **Back on Home leaves the app**
- [x] The app's own ← / × / "Back to home" buttons do the same as the phone's Back. At the end of a session started from the "Don't know" list the button says "Back" instead of "Back to home"
- [x] **Back with a dialog open closes only the dialog** (feedback / report, confirmations, Move to another device, install steps): `useCloseOnBack()` in each dialog
- [x] A reload stays on the same screen; a Move QR link opens Settings and Back goes Home
- Tests: `src/lib/nav.test.ts` (fake browser history, including the asynchronous `history.go`). Checked in real Chrome on localhost and approved by the user

**G. Ideas from popular vocabulary apps** (noted 2026-11-13)
Compared with Anki, Quizlet, Memrise, Duolingo, WordUp, Vocabulary.com, Drops and Lingvist. All $0. Each still needs approval before work starts. **Decided by the user 2026-11-13: start with 2 (word formation).** ✅ 2 done. ✅ 5 done 2026-11-14. ✅ 1 done 2026-11-14. ✅ 4 done 2026-11-14.
- [x] **1. "Skip words you know"** (WordUp, Lingvist, Vocabulary.com). Done 2026-11-14, so B2–C2 learners don't swipe through hundreds of easy words. Home → "Skip words you know" (under Exam practice; hidden once every word of the level has been seen):
  - A page shows the next 20 new words of your level, in the order the daily session would bring them. Tick the ones you know ("Tick all" helps), or "Show the next 20". Words you don't tick stay in the study list
  - Check: "what does it mean?" on about one in four ticked words (at least 3), in Spanish if the app is in Spanish and Spanish meanings are on, else Chinese. 80% or more right: every ticked word is skipped except the missed ones. Less: only the words answered right are skipped. Undo on the result screen
  - Skipped = last box, due in 60 days, no daily history (the goal and streak don't change). At that one check-in "Know" makes it Mastered, a miss sends it back to normal study. Shown as "Reviewing" in the word list until then
  - The place in the list is saved per level in this browser (`mempo:skip:<level>`, not in backups), so the next visit carries on; at the end of the level it starts over with the words still new
  - Code: `src/lib/skip.ts` (tests `skip.test.ts`), `src/pages/Skip.tsx`, screen `{ name: "skip" }`. The question card is shared with the level test (`src/components/MeaningQuestion.tsx`, `makeQuestion` in `leveltest.ts`); `upcomingNew` in `session.ts` gives the study order. Texts under `skip` in en / zh / es
- [x] **2. Word formation exercise** (Cambridge Use of English Part 3; Vocabulary.com question types). Done and live 2026-11-13. Moves to its own **Exam practice** section (see H below):
  - **Word formation**: an example sentence with a gap, the base word in capitals (DECIDE), type the form that fits. Only the exact form counts, as in the exam: "decision" when the gap needs "decisions" shows "Right word, wrong form"; one typo shows "Almost!". The meaning appears after answering
  - Studied words first (weakest first), then other words from your level, so a round is full from day one. Missed studied words can go to "Don't know" as in the other exercises
  - Data: `base` on 1,631 of 6,128 cards (about 1,600 with a usable sentence), made by `scripts/families.ts` (`npm run data:families`, also runs after `data:enrich`). It strips prefixes / suffixes with spelling repairs (decis|ion → decide) and keeps a link only if the word's main dictionary definition mentions the base ("the act of deciding"); negative prefixes (un-, in-, dis-, mis-, non- …) need "not / lack / without …" in the definition. Up to 3 steps (unacceptable ← acceptable ← ACCEPT), never to a much rarer word. No -ed / -ing (their examples are mostly verbs). Bad pairs found by eye are in `BLOCK`; every link is listed in `data/reports/families.txt`
  - App: `formGap`, `checkForm`, `formPool` in `src/lib/recall.ts` (tests in `recall.test.ts`); texts in en / zh / es
- [ ] **3. Matching game against the clock** (Quizlet Match, Drops). Match words to meanings in a grid, a quick extra mode next to Recall. ~½ day
- [x] **4. Streak freeze + badges** (Duolingo). Done 2026-11-14
  - **Streak freeze:** you start with 1, hold at most 2, and earn 1 for every 7 days studied in a row. A missed day uses one if the streak is running; the frozen day keeps the streak but doesn't add to it (Duolingo's rule). With none left a missed day ends it. Shown on Stats (❄ "Streak freezes: 1 of 2" + how it works), as a snowflake on that day in the 14-day chart, and as "A streak freeze saved your streak yesterday" on Stats and Home
  - Worked out from the daily history alone (`streakOf` in `src/lib/stats.ts` walks day by day from the first day studied), so nothing new is stored and backups / Move keep it. The reminder's streak uses the same rule
  - **Badges** (`src/lib/badges.ts`, also nothing stored): longest streak 7 / 30 / 100 / 365 days; 100 / 500 / 1,000 / 2,500 new words studied ("Skip words you know" doesn't count); B2 / C1 / C2 finished (every word seen or skipped). A Badges card on Stats (earned in colour, the rest grey with how far along), and "New badge!" at the end of the session that earned it
  - Code: `src/components/Badges.tsx` (medal and snowflake drawings), ice colours `--color-ice*` in `src/index.css`. Tests in `stats.test.ts` and `badges.test.ts`. Texts `stats.freeze*` and `badges` in en / zh / es
- [x] **5. Word of the day** (WordUp, Vocabulary.com). Done 2026-11-14. A card on Home (word, pronunciation, meaning, example) and the word in the daily reminder
  - Same word for everyone at a level on a day, picked from the date alone (`src/lib/wotd.ts`, tests in `wotd.test.ts`): it steps through the level's words by a golden-ratio stride, so every word comes once before any repeats and neighbouring days aren't alphabetical neighbours. Left out: inflected cards (`lemma`), sensitive words, words without an example or meaning
  - Reminder: the server still knows no words. The service worker (`src/sw.ts`) replaces the body with "Word of the day: … · meaning", reading the level and languages the app saves in Cache Storage (`mempo-prefs`) and the word list from the offline cache. If either is missing, the old text is shown
- [ ] **6. Your own words / lists** (Anki, Quizlet). Star cards into "My list", or add words you meet while reading. ~1 day
- [ ] **7. Speak it** (Memrise, Duolingo). Say the word, the browser's free speech recognition checks it (good in Chrome / Android, weaker on iPhone). ~½ day
- [ ] **8. Better scheduling (FSRS)** (Anki). The modern spaced repetition method; invisible to users, fewer wasted reviews. ~1 day
- [ ] **9. Topics** (Drops, Memrise): work, health, environment… Every word needs a topic tag first. ~1 day
- [ ] **10. Short stories with your words**: part of Phase 7 (needs a paid AI API)
- Left out: native-speaker video clips (Memrise, WordUp), because of licensing

**H. Exam practice section** (decided by the user 2026-11-13)
Recall checks words you've already studied; exam tasks train a skill and may use words you haven't studied yet. So they get their own place: an **"Exam practice"** button on Home next to Recall, opening a screen with the Cambridge *Reading and Use of English* task types (the same four in B2 First, C1 Advanced and C2 Proficiency). Only tasks that work are shown, no "coming soon" items.
- [x] **Step 1: the section + Part 3 Word formation** (done and live 2026-11-13). After answering, the meaning shows in every chosen language (as a question, look-alike Spanish meanings stay hidden). Home → **Exam practice** (under Recall) → "Part 3 · Word formation". Screen `{ name: "exam" }` in `src/lib/nav.ts`, so Back works as on the other screens. The quiz screen is shared: `src/pages/Recall.tsx` takes `section="recall" | "exam"` and shows only that section's exercises (each exercise has its section and exam part number in `KINDS`). Unlike Recall, it works before you've studied anything. Logic in `src/lib/exam.ts` (tests: `exam.test.ts`); texts under `exam` in en / zh / es
- [x] **Part 1: Multiple-choice cloze, first batch** (done 2026-11-14). A gap and 4 words of close meaning, only one fits; rounds of 8 as in the paper. After answering, the sentence fills in with a short note (English) on why
  - **Hand-written, not generated** (decided 2026-11-14): a count showed ~1,200 of our 7,257 example sentences could be turned into questions automatically, but in a sample most had a "wrong" choice that also fits (*neighbouring / adjacent*), the wrong form, or weak context. Real Cambridge questions (sample papers, practice books, sites) are copyrighted, so they are not copied; ours follow the same style
  - `src/data/part1.json`: 30 B2 questions. 19 test a Mempo B2 word (`card` links it, so a miss can go on "Don't know"), 11 test everyday collocations (*pay attention, take advantage*). Checked by the user 2026-11-14. Logic `buildCloze` / `loadCloze` in `src/lib/exam.ts`; a test checks every question (one gap, 4 different choices, linked card exists)
  - C1 / C2 users get the B2 questions until their own exist
- [x] **Part 1: C1 / C2 first batch** (done 2026-11-14, checked by the user on localhost): 30 C1 (21 linked to a card: *comply with, in breach of, from the outset, against all the odds* …) and 30 C2 (20 linked: *with hindsight, commensurate with, eke out, at a low ebb* …), the rest fixed phrases and idioms (*come into force, at loggerheads, bury the hatchet*). Same rules as B2: only one choice may fit, the others are near in meaning but fail on the collocation or the preposition
- [ ] **Part 1: more questions.** ~100 per level (B2 → C1 → C2), each batch checked before going live. Notes in Chinese / Spanish too, maybe
- [x] **Link to the official sample papers** (done 2026-11-14). An "Official sample papers" card under the tasks on the Exam practice screen, with B2 First · C1 Advanced · C2 Proficiency (your level first and highlighted). Each opens Cambridge's free preparation page (sample tests online and to download) in a new tab. We link to the preparation pages, not the test files, because those links change; the URLs are in `site.samplePapers` (`src/config/site.ts`). Linking is fine, copying isn't. Texts `exam.papers*` in en / zh / es
- [ ] **Part 2: Open cloze** (later, with Phase 7). A gap with no options; the answer is a grammar word (*which, despite, unless*). Not really vocabulary, and needs our own texts
- [ ] **Part 4: Key word transformation** (later, with Phase 7). Rewrite a sentence with a given word in 2–5 words. Needs hand-written questions or AI to check the answers
- [ ] **Later idea: exam-style texts.** In the real exam each part is one short text with 8 gaps, not single sentences. Join 8 example sentences into one set so it feels closer to the paper

**I. Phone and web layout** ✅ (done 2026-11-14, approved by the user)
Before, every screen was one narrow column (max ~450 px) on every device, and on phones the Start button sat ~1,400 px down Home. Like Duolingo, Quizlet, Busuu and Memrise, the navigation now changes shape with the screen. Colours unchanged.
- [x] **Phones (< 768 px):** bottom tab bar **Today · Practice · Words · Stats** (`TabBar` in `src/components/AppNav.tsx`). Today shows only today: the progress card with Start / Keep going inside it (on the first screen), the 3 counters, Word of the day, and **Your plan** (level + daily goal), open for someone new and folded to one line ("B2 · Upper-intermediate · 20 new a day", **Change**) once they've started
- [x] **New Practice tab** (`src/pages/Practice.tsx`, screen `{ name: "practice" }`): "Don't know" list (red count), Recall, Exam practice, Skip words you know (until the level is all seen), Level test. Cards in one column on phones, 2 columns wider
- [x] **Tablets (768–1279 px):** sidebar with icons only (`Sidebar`), one content column; Today also shows Recall / Exam practice / Skip as 3 cards
- [x] **Computers (≥ 1280 px):** sidebar with names (Today · Practice · Words · Stats · Settings); Today has the main column (progress, counters, practice cards) and a **right column** (streak card, Word of the day, Your plan always open). Settings: learning preferences left, device + data right. Stats: 2 × 2 (streak | tiles, chart | by level; the chart grows to fill its card). Word list and "Don't know": 2 columns
- [x] Study, Recall, Exam practice, Skip and the level test stay one narrow column, without tab bar or sidebar. The "Don't know" list has the sidebar but no tab bar (its Practise button sits there)
- [x] **Back button:** `nav().tab()` in `src/lib/nav.ts`. Switching tabs replaces the entry instead of adding one, so Back from any tab goes to Today and Back on Today leaves the app; a screen opened from a tab goes back to that tab. Tests in `nav.test.ts`
- [x] Texts `nav`, `practice`, `home.morePractice` / `yourPlan` / `change` / `planGoal` in en / zh / es. Checked at 320 / 360 / 390 / 820 / 1100 / 1440 px, all three languages, light and dark
- Fixed 2026-11-14: in dark mode the yellow marker behind the word in example sentences covered only the lower half, so the dark word sat half on the dark card. Now it covers the whole word in dark mode (`--marker-top` in `src/index.css`); light mode unchanged

**Not needed for now (decided by the user 2026-11-07):** credits / licences (About screen, minddory terms). Keep things as they are.

---

## 6. Folder structure

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
├── api/                # Vercel serverless functions: reminders, move, feedback, stats (+ _*.test.ts)
├── .github/workflows/  # reminders.yml: calls /api/reminders every 15 min
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
| Pronunciation (Piper TTS MP3s, made once on the local PC) | $0 |
| Upstash Redis (reminders, move codes, feedback limits, usage stats; free tier, shared) | $0 |
| Resend (feedback emails, free 3,000/month) | $0 |
| GitHub Actions (reminder scheduler every 15 min) | $0 |
| Custom domain (optional) | ~$10/year |
