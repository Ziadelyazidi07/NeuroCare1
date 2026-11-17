"""Configuration par variables d'environnement (aucun secret dans le code)."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    internal_key: str
    data_dir: Path
    tts_engine: str
    cloning_engine: str
    max_sample_bytes: int = 5 * 1024 * 1024
    min_sample_seconds: float = 10.0
    max_sample_seconds: float = 30.0
    max_text_length: int = 300

    @staticmethod
    def from_env() -> "Settings":
        return Settings(
            internal_key=os.environ.get("INTERNAL_KEY", ""),
            data_dir=Path(os.environ.get("DATA_DIR", "/data")),
            tts_engine=os.environ.get("TTS_ENGINE", "espeak"),
            cloning_engine=os.environ.get("CLONING_ENGINE", "none"),
        )
