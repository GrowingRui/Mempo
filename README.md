<p align="center">
  <img src="public/pwa-192x192.png" alt="Mempo, a purple grape with a sprout" width="96" height="96">
</p>

<h1 align="center">Mempo</h1>

<p align="center"><b>Make words stick!</b> Your little companion for learning words.</p>

<p align="center"><a href="https://mempo.vercel.app/"><b>Open Mempo → mempo.vercel.app</b></a></p>

Mempo is a free web app for learning **B2, C1 and C2 English vocabulary** (the levels of the upper-intermediate, advanced and proficiency exams) a little every day. You swipe through word cards, say whether you know each word, and Mempo brings words back at the right time until they stick.

Every one of the **6,128 words** has Chinese (中文) and Spanish (Español) translations, example sentences and a British English recording.

<p align="center">
  <img src="docs/home.png" alt="Home screen: today's goal, reviews due, level choice and Start button" width="240">
  &nbsp;
  <img src="docs/card-back.png" alt="A word card showing translations, word forms and example sentences" width="240">
  &nbsp;
  <img src="docs/stats.png" alt="Stats screen: a 9 day streak and a chart of the last 14 days" width="240">
</p>

## What it does

- **Daily goal**: pick 10, 20, 30, 50 or any number of new words a day.
- **Swipe cards**: swipe or tap Know, Not sure or Don't know. Tap a card to flip it and see the meaning.
- **Spaced repetition**: words you know come back after 1, 3, 7, 14, 30 and 60 days, then count as mastered.
- **"Don't know" list**: words you missed, to practise until you get them right on two different days.
- **Level test**: 30 random words tell you which level to start with.
- **Word list**: search every word in English, Chinese or Spanish.
- **Stats**: daily streak, 14-day chart and progress per level.
- **Works offline**, can be **installed like an app**, and has a **dark mode**.
- **Free, no account, no ads.** Your progress stays on your device.

## How to use it

1. Open [mempo.vercel.app](https://mempo.vercel.app/).
2. Choose **your level** (B2, C1 or C2). Not sure? Tap **Take a level test**.
3. Choose **how many new words a day** you want.
4. Tap **Start**. For each card:
   - Read the word and the example. Tap 🔊 to hear it.
   - Tap the card to see the translations.
   - Answer:

     | Answer | Swipe | Button | Keyboard |
     |---|---|---|---|
     | Know | left | ✓ Know | ← |
     | Not sure | up | ? Not sure | ↑ |
     | Don't know | right | ✕ Don't know | → |

     You can swap left and right in **Settings**. On a computer, **Space** flips the card and **Esc** leaves.
5. Words you don't know come back a few cards later, until you know them.
6. Come back tomorrow. **Start** always shows reviews that are due first, then your "Don't know" words, then new words. Study every day to keep your 🔥 streak.

The tiles on the home screen open **Reviews due** (only the words to review today), **Don't know** (your hard words, with a "Practise these" button) and **All words**. The 🔥 button opens **Stats**, the sliders button opens **Settings**.

## Install it on your phone or computer

Mempo is a web app: you install it from the browser, not from an app store. It then gets its own icon, opens full screen, and works without internet. The app also shows these steps: tap **Install** on the home screen or in **Settings → Offline**.

### iPhone and iPad

1. Open [mempo.vercel.app](https://mempo.vercel.app/) in **Safari**.
2. Tap the **Share** button (a square with an arrow, at the bottom on iPhone, at the top on iPad).
3. Scroll down and tap **Add to Home Screen**, then **Add**.

On iOS 16.4 or later, Chrome and Edge have the same Share → Add to Home Screen option.

### Android

1. Open [mempo.vercel.app](https://mempo.vercel.app/) in **Chrome** (Edge and Samsung Internet work too).
2. Tap **Install** in Mempo, or open the browser menu **⋮** and tap **Install app** (or **Add to Home screen**).
3. Confirm. Mempo appears with your other apps.

### Windows, Mac, Linux and Chromebook

- **Chrome or Edge**: click **Install** in Mempo, or the install icon at the right end of the address bar, or menu → **Install Mempo**. It opens in its own window and gets a Start menu, Dock or launcher entry.
- **Safari on a Mac** (macOS 14 Sonoma or later): menu bar → **File** → **Add to Dock**.
- **Firefox** on a computer can't install web apps. Mempo still works in a normal tab.

### Uninstall

Remove it like any other app: long-press the icon and choose Remove (phones), or open the app's menu → Uninstall (Chrome and Edge on computers). On iPhone, deleting the app also deletes its progress, so download a backup first.

## Offline use

After your first visit, Mempo and all its words work without internet.

Pronunciations are saved as you hear them. To save all of them at once (about 51 MB), go to **Settings → Offline → Save all for offline**. If a recording isn't saved yet, your device's own voice reads the word.

When a new version of Mempo is out, a message says **"A new version is ready"**. Tap **Update** when you're ready; it never interrupts a study session.

## Your progress and backups

There's no account: your progress is saved **in this browser on this device**. That means:

- A different phone, computer or browser starts empty.
- On iPhone, the installed app and Safari keep separate progress.
- Clearing your browser data deletes your progress.

To keep it safe or move it, use **Settings → Your progress**:

- **Download backup** saves a small file (`mempo-backup-YYYY-MM-DD.json`).
- **Restore backup** loads that file on any device or browser. It shows what's in the file and asks before replacing the progress there.
- **Start over** deletes all your progress (your settings stay).

## Settings

- **Theme**: Light, Dark or Auto (follows your device).
- **Translations**: show Chinese, Spanish or both.
- **Swiping**: "Know" on the left (default) or on the right.
- **Offline**: install the app and save pronunciations.
- **Your progress**: backup, restore, start over.

## For developers

Built with React 19, TypeScript, Vite, Tailwind CSS 4 and Motion; `vite-plugin-pwa` with Workbox for offline use. There's no backend: word data is static JSON and progress lives in `localStorage`. Hosted on Vercel, which redeploys on every push to `main`.

```bash
npm install
npm run dev        # development server (the offline service worker is off here)
npm run build      # type-check and build into dist/
npm run preview    # serve the build, with the service worker, to test offline and install
npm run icons      # regenerate app icons from public/favicon.svg
```

Needs Node 23.6 or later.

The word data in `public/data/` is already built. To rebuild it (only needed when changing the data pipeline):

```bash
npm run data:fetch-dicts   # download the dictionaries into data/dict/ (needs bzip2)
npm run data:scrape        # word lists → data/raw.json
npm run data:enrich        # translations and examples → public/data/*.json
```

Pronunciations in `public/audio/` were made once with `scripts/gen-audio.py` (Piper TTS).

Where things are:

| Path | What |
|---|---|
| `src/pages/` | screens: Home, Study, Don't know, Word list, Level test, Stats, Settings |
| `src/components/` | cards, dialogs, install and update prompts |
| `src/lib/` | spaced repetition (`srs.ts`), session order, storage, backup, offline, install |
| `src/sw.ts` | service worker (offline app and pronunciation cache) |
| `src/config/site.ts` | app name, tagline and links |
| `scripts/` | data pipeline (scrape, enrich, hand corrections) |
| `PLAN.md` | design notes and how each part works |

## Credits and licences

| What | Source | Licence |
|---|---|---|
| Word lists (B2 / C1 / C2) | [minddory.com](https://minddory.com/english-vocabulary-list/) | personal use |
| Chinese translations, part of speech, phonetics | [ECDICT](https://github.com/skywind3000/ECDICT) | MIT |
| Spanish translations | English Wiktionary via [kaikki.org](https://kaikki.org/) | CC BY-SA 4.0 |
| Example sentences (linked on each card) | [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR |
| Pronunciations | [Piper TTS](https://github.com/rhasspy/piper), voice "cori" (en_GB) | public-domain voice data |
| Fonts | Bricolage Grotesque, Figtree (via Fontsource) | OFL |

Mempo is a personal, non-commercial project. It is not affiliated with Cambridge University Press & Assessment or any exam board.
