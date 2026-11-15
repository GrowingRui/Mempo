/** Cache Storage name for pronunciation MP3s, shared by the service worker (src/sw.ts) and the page. */
export const AUDIO_CACHE = "mempo-audio-v1";

/**
 * Recordings that were re-made (2026-11-15: the voice dragged on or added a second sound after the word,
 * e.g. "abandoned", "aide"; see scripts/gen-audio.py). Phones keep played and downloaded audio, so the
 * service worker deletes these from the cache when a new version takes over, and the new file is fetched
 * the next time the word is played. When recordings change again, list them here and change REMADE_AUDIO_DATE
 * (each phone clears the list once per date).
 */
export const REMADE_AUDIO_DATE = "2026-11-15";
export const REMADE_AUDIO: string[] = [
  "abandoned", "abound", "advancement", "advantageous", "adversely", "advisory", "aide", "amend", "amendment", "append", "bereft", "bid", "bind", "bony", "bouquet", "breach", "bubbly", "bud", "commend", "condemn", "corona", "crab", "deaden", "decade", "deck", "demo", "depraved", "descend", "devotee", "doubly", "dread", "dreadful", "dub", "dumb", "ebb", "embed", "envy", "footnote", "hood", "infant", "legend", "machinery", "micrometre", "mode", "nano", "nod", "obey", "odd", "offend", "offhand", "opposed", "overcoat", "overshadow", "ph", "plead", "reassurance", "reassure", "rebound", "recondite", "recreate", "redraft", "reed", "roam", "rod", "rub", "suspend", "texts", "tread", "trio", "tub", "turnover", "unmanned", "unrest", "voter", "wind",
];
