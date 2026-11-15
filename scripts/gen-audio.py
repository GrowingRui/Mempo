"""
Pre-generates pronunciation audio for every word with Piper (free, open-source
neural TTS, runs locally), so the app does not depend on the voices installed
on the user's device.

Setup (one time; everything lands in the git-ignored data/cache/):
    python -m venv data/cache/piper-venv
    data/cache/piper-venv/Scripts/python -m pip install piper-tts lameenc
    cd data/cache/piper-voices && ../piper-venv/Scripts/python -m piper.download_voices en_GB-cori-high

Run:
    data/cache/piper-venv/Scripts/python scripts/gen-audio.py            # new words -> public/audio/
    data/cache/piper-venv/Scripts/python scripts/gen-audio.py --fix      # re-make files that are too long (see below)
    data/cache/piper-venv/Scripts/python scripts/gen-audio.py --redo aide,ebb   # re-make these ids
    data/cache/piper-venv/Scripts/python scripts/gen-audio.py --sample   # a few words per voice -> data/cache/samples/

Existing files are skipped, so the script can be re-run after adding words.

Glitches (found 2026-11-15, "abandoned" sounded wrong): Piper's voice is a little random, and on a
lone word it sometimes doesn't stop: it drags the vowel out or adds a second burst of sound after a
pause ("aide" took up to 5 s). Two fixes:
  - The word is read with a full stop ("abandoned."), which tells the voice the sentence ends.
  - Each take is checked (one block of speech, not much longer than the word needs). A bad take is
    made again, up to TAKES times, and the best one is kept.
--fix re-makes every word this way but only replaces a file when the old one was clearly longer
(the length of an old file is worked out from its size: constant bitrate), so good files stay as they are.
"""

import array
import io
import json
import re
import sys
import wave
from pathlib import Path

import lameenc
from piper import PiperVoice
from piper.config import SynthesisConfig

ROOT = Path(__file__).resolve().parent.parent
VOICES_DIR = ROOT / "data" / "cache" / "piper-voices"
DATA_DIR = ROOT / "public" / "data"
OUT_DIR = ROOT / "public" / "audio"
VOICE = "en_GB-cori-high"
BITRATE = 48  # kbps, mono; plenty for a single spoken word
TAKES = 12  # most tries for one word
# Ways to read a word, tried in turn: "word." and "word;" (both end the phrase without a question or
# exclamation tune; ";" helps the words that drag on after "."), at learner speed and at normal speed.
READINGS = [(".", 1.1), (";", 1.1), (".", 1.0), (";", 1.0)]

SAMPLE_WORDS = ["house", "particular", "efficacy", "turmoil", "parliament", "aspiration"]
SAMPLE_VOICES = [
    "en_GB-cori-high",
    "en_GB-jenny_dioco-medium",
    "en_GB-alba-medium",
    "en_GB-northern_english_male-medium",
]


def audio_file_name(word_id: str) -> str:
    """Must match audioUrl() in src/lib/speech.ts."""
    name = re.sub(r"[^a-z0-9]+", "-", word_id.lower()).strip("-")
    if WINDOWS_RESERVED.fullmatch(name):
        name += "-w"  # "con.mp3" etc. can't exist on Windows
    return name + ".mp3"


WINDOWS_RESERVED = re.compile(r"con|prn|aux|nul|com[0-9]|lpt[0-9]")


def load_voice(name: str) -> PiperVoice:
    return PiperVoice.load(str(VOICES_DIR / f"{name}.onnx"))


def synth_pcm(voice: PiperVoice, text: str, length_scale: float = 1.1) -> tuple[bytes, int, int]:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        # 1.1: slightly slower than normal speech, for learners.
        voice.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=length_scale))
    buf.seek(0)
    with wave.open(buf, "rb") as wav:
        return wav.readframes(wav.getnframes()), wav.getframerate(), wav.getnchannels()


def to_mp3(pcm: bytes, rate: int, channels: int) -> bytes:
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(channels)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()


LOUD = 1500  # sample level that counts as sound (16-bit)
FRAME = 0.02  # seconds
GAP = 0.18  # a quieter stretch this long splits the sound in two blocks


def blocks(pcm: bytes, rate: int) -> list[tuple[float, float]]:
    """Blocks of sound as (start, end) in seconds; short dips inside a word don't split it, tiny blips are dropped."""
    a = array.array("h", pcm)
    step = int(rate * FRAME)
    loud = [max(map(abs, a[i : i + step]), default=0) >= LOUD for i in range(0, len(a), step)]
    out: list[list[float]] = []
    for i, on in enumerate(loud):
        if not on:
            continue
        t = i * FRAME
        if out and t - out[-1][1] <= GAP:
            out[-1][1] = t + FRAME
        else:
            out.append([t, t + FRAME])
    return [(s, e) for s, e in out if e - s >= 0.06]


def expected(word: str) -> float:
    """Roughly the longest a clean recording of the word takes, in seconds of sound."""
    return 0.45 + 0.085 * len(word)


def shortest(word: str) -> float:
    """Less sound than this means the end of the word was probably cut off."""
    return 0.3 + 0.03 * len(word)


def score(word: str, pcm: bytes, rate: int) -> float:
    """Lower is better: seconds of sound, plus penalties for extra blocks, for going past the expected length and for being cut short."""
    bs = blocks(pcm, rate)
    if not bs:
        return 99.0
    sound = bs[-1][1] - bs[0][0]
    return sound + 2.0 * (len(bs) - 1) + 3.0 * max(0.0, sound - expected(word)) + 5.0 * max(0.0, shortest(word) - sound)


def clean(word: str, pcm: bytes, rate: int) -> bool:
    bs = blocks(pcm, rate)
    return len(bs) == 1 and shortest(word) <= bs[0][1] - bs[0][0] <= expected(word)


def trim(pcm: bytes, rate: int, channels: int) -> bytes:
    """Keeps 0.1 s before the first sound and 0.2 s after the last (Piper adds some silence at both ends)."""
    bs = blocks(pcm, rate)
    if not bs:
        return pcm
    width = 2 * channels
    start = max(0, int((bs[0][0] - 0.1) * rate)) * width
    end = min(len(pcm), int((bs[-1][1] + 0.2) * rate) * width)
    return pcm[start:end]


def best_take(voice: PiperVoice, word: str) -> tuple[bytes, float, int]:
    """The best of up to TAKES takes as MP3, its score and how many takes it needed. Stops at the first clean take."""
    best = None
    for n in range(1, TAKES + 1):
        mark, speed = READINGS[(n - 1) % len(READINGS)] if n > 2 else READINGS[0]  # "word." twice first: usually fine
        pcm, rate, channels = synth_pcm(voice, word + mark, speed)
        s = score(word, pcm, rate)
        if best is None or s < best[0]:
            best = (s, pcm, rate, channels)
        if clean(word, pcm, rate):
            break
    s, pcm, rate, channels = best
    return to_mp3(trim(pcm, rate, channels), rate, channels), s, n


def mp3_seconds(path: Path) -> float:
    return path.stat().st_size * 8 / (BITRATE * 1000)


def all_words() -> list[tuple[str, str]]:
    index = json.loads((DATA_DIR / "index.json").read_text(encoding="utf-8"))
    words: dict[str, str] = {}
    for file_name in index["files"].values():
        for entry in json.loads((DATA_DIR / file_name).read_text(encoding="utf-8")):
            words.setdefault(entry["id"], entry["word"])
    return list(words.items())


def main() -> None:
    if "--sample" in sys.argv:
        out = ROOT / "data" / "cache" / "samples"
        out.mkdir(parents=True, exist_ok=True)
        for name in SAMPLE_VOICES:
            voice = load_voice(name)
            text = ". ".join(SAMPLE_WORDS) + "."
            (out / f"{name}.mp3").write_bytes(to_mp3(*synth_pcm(voice, text)))
            print("wrote", out / f"{name}.mp3")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    voice = load_voice(VOICE)
    words = all_words()
    fix = "--fix" in sys.argv
    redo = set(sys.argv[sys.argv.index("--redo") + 1].split(",")) if "--redo" in sys.argv else set()
    done = skipped = 0
    unsure: list[str] = []
    for i, (word_id, word) in enumerate(words, 1):
        path = OUT_DIR / audio_file_name(word_id)
        if path.exists() and word_id not in redo and not fix:
            skipped += 1
            continue
        check = fix and path.exists() and word_id not in redo
        # Old files have ~0.3 s of silence around the word, hence the margin.
        if check and mp3_seconds(path) <= expected(word) + 0.45:
            skipped += 1
            continue
        mp3, s, takes = best_take(voice, word)
        if check:
            old = mp3_seconds(path)
            new = len(mp3) * 8 / (BITRATE * 1000)
            # Replace only when the new take is clearly shorter.
            if old <= new + 0.4:
                skipped += 1
                continue
            print(f"fixed {word}: {old:.1f}s -> {new:.1f}s", flush=True)
        path.write_bytes(mp3)
        done += 1
        if s > expected(word) or s < shortest(word):
            unsure.append(f"{word} ({takes} takes, score {s:.2f})")
        if i % 500 == 0:
            print(f"{i}/{len(words)}", flush=True)
    print(f"done: {done} written, {skipped} kept, {len(words)} words total")
    if unsure:
        print("No clean take found (listen to these):", ", ".join(unsure))


if __name__ == "__main__":
    main()
