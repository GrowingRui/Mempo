"""
Pre-generates pronunciation audio for every word with Piper (free, open-source
neural TTS, runs locally), so the app does not depend on the voices installed
on the user's device.

Setup (one time; everything lands in the git-ignored data/cache/):
    python -m venv data/cache/piper-venv
    data/cache/piper-venv/Scripts/python -m pip install piper-tts lameenc
    cd data/cache/piper-voices && ../piper-venv/Scripts/python -m piper.download_voices en_GB-cori-high

Run:
    data/cache/piper-venv/Scripts/python scripts/gen-audio.py            # all words -> public/audio/
    data/cache/piper-venv/Scripts/python scripts/gen-audio.py --sample   # a few words per voice -> data/cache/samples/

Existing files are skipped, so the script can be re-run after adding words.
"""

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


def synth_mp3(voice: PiperVoice, text: str) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        # Slightly slower than normal speech, for learners.
        voice.synthesize_wav(text, wav, syn_config=SynthesisConfig(length_scale=1.1))
    buf.seek(0)
    with wave.open(buf, "rb") as wav:
        rate, channels = wav.getframerate(), wav.getnchannels()
        pcm = wav.readframes(wav.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE)
    enc.set_in_sample_rate(rate)
    enc.set_channels(channels)
    enc.set_quality(2)
    return enc.encode(pcm) + enc.flush()


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
            (out / f"{name}.mp3").write_bytes(synth_mp3(voice, text))
            print("wrote", out / f"{name}.mp3")
        return

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    voice = load_voice(VOICE)
    words = all_words()
    done = skipped = 0
    for i, (word_id, word) in enumerate(words, 1):
        path = OUT_DIR / audio_file_name(word_id)
        if path.exists():
            skipped += 1
            continue
        path.write_bytes(synth_mp3(voice, word))
        done += 1
        if i % 250 == 0:
            print(f"{i}/{len(words)}")
    print(f"done: {done} new, {skipped} already there, {len(words)} words total")


if __name__ == "__main__":
    main()
