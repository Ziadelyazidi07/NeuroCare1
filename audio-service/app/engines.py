"""Moteurs de synthèse et de clonage vocal.

* ``EspeakTtsEngine`` : TTS standard hors ligne (espeak-ng), sortie MP3 64 kbit/s mono via lame
  (ENF-13 : ≤ 150 Ko par rappel). Les données restent sur le serveur (pas d'API externe).
* ``UnavailableCloningEngine`` : le clonage (XTTS v2) demande un GPU ; tant qu'il n'est pas branché,
  le service le signale honnêtement et le backend applique la chaîne de repli (cahier §10.4-10.5).

La darija n'est pas prise en charge par les moteurs TTS : ses messages sont préenregistrés par des
locuteurs (repli niveau 3 côté backend).
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

# Codes de langue envoyés par le backend → voix espeak-ng.
_ESPEAK_VOICES = {"fr": "fr", "ar": "ar"}


class UnsupportedLanguage(Exception):
    pass


class EngineUnavailable(Exception):
    pass


class CloningUnavailable(Exception):
    pass


@dataclass(frozen=True)
class SynthesizedAudio:
    content: bytes
    media_type: str


class TtsEngine(Protocol):
    name: str

    def supports(self, language: str) -> bool: ...

    def synthesize(self, text: str, language: str) -> SynthesizedAudio: ...


class CloningEngine(Protocol):
    name: str

    def enroll(self, voice_dir: Path, sample: bytes, language: str) -> None: ...

    def synthesize(self, voice_dir: Path, text: str, language: str) -> SynthesizedAudio: ...


class EspeakTtsEngine:
    name = "espeak-ng"

    def __init__(self, binary: str = "espeak-ng", encoder: str = "lame") -> None:
        self._binary = shutil.which(binary)
        self._encoder = shutil.which(encoder)

    def supports(self, language: str) -> bool:
        return language in _ESPEAK_VOICES

    def synthesize(self, text: str, language: str) -> SynthesizedAudio:
        if not self.supports(language):
            raise UnsupportedLanguage(language)
        if self._binary is None:
            raise EngineUnavailable("espeak-ng absent")
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "out.wav"
            self._run([self._binary, "-v", _ESPEAK_VOICES[language], "-s", "140", "-w", str(wav), text])
            if self._encoder is None:
                return SynthesizedAudio(wav.read_bytes(), "audio/wav")
            mp3 = Path(tmp) / "out.mp3"
            self._run([self._encoder, "--quiet", "-m", "m", "-b", "64", str(wav), str(mp3)])
            return SynthesizedAudio(mp3.read_bytes(), "audio/mpeg")

    @staticmethod
    def _run(command: list[str]) -> None:
        try:
            subprocess.run(command, check=True, capture_output=True, timeout=15)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as exc:
            raise EngineUnavailable(type(exc).__name__) from exc


class NoTtsEngine:
    """TTS désactivé (TTS_ENGINE=none) : le backend passe au niveau 3."""

    name = "none"

    def supports(self, language: str) -> bool:
        return False

    def synthesize(self, text: str, language: str) -> SynthesizedAudio:
        raise EngineUnavailable("TTS désactivé")


class UnavailableCloningEngine:
    name = "none"

    def enroll(self, voice_dir: Path, sample: bytes, language: str) -> None:
        raise CloningUnavailable("Aucun moteur de clonage configuré")

    def synthesize(self, voice_dir: Path, text: str, language: str) -> SynthesizedAudio:
        raise CloningUnavailable("Aucun moteur de clonage configuré")


def build_tts(name: str) -> TtsEngine:
    return EspeakTtsEngine() if name == "espeak" else NoTtsEngine()


def build_cloning(name: str) -> CloningEngine:
    # Point d'extension : brancher ici XTTS v2 (GPU, licence à vérifier — cahier §10.5).
    return UnavailableCloningEngine()
