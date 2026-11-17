"""Contrôle du type réel (octets magiques) et de la durée d'un échantillon vocal.

Le type MIME déclaré par le client n'est jamais cru : seuls les en-têtes WAV (RIFF/WAVE)
et MP3 (ID3 ou trame MPEG) sont acceptés.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass

# Débits MPEG-1 Layer III (kbit/s) et fréquences MPEG-1 / MPEG-2 / MPEG-2.5.
_MP3_BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
_MP3_BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]


class InvalidAudio(ValueError):
    """Échantillon refusé : format inconnu, en-tête illisible ou durée hors bornes."""


@dataclass(frozen=True)
class AudioInfo:
    format: str  # "wav" | "mp3" | "m4a"
    duration_seconds: float

    @property
    def media_type(self) -> str:
        return {"wav": "audio/wav", "mp3": "audio/mpeg", "m4a": "audio/mp4"}[self.format]


def inspect(data: bytes) -> AudioInfo:
    if len(data) >= 12 and data[0:4] == b"RIFF" and data[8:12] == b"WAVE":
        return AudioInfo("wav", _wav_duration(data))
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return AudioInfo("m4a", _mp4_duration(data))
    offset = _skip_id3(data)
    if _is_mpeg_frame(data, offset):
        return AudioInfo("mp3", _mp3_duration(data, offset))
    raise InvalidAudio("Format non reconnu : seuls WAV, MP3 et M4A sont acceptés")


def check_sample(data: bytes, min_seconds: float, max_seconds: float, max_bytes: int) -> AudioInfo:
    if len(data) > max_bytes:
        raise InvalidAudio("Fichier trop volumineux")
    info = inspect(data)
    if not (min_seconds <= info.duration_seconds <= max_seconds):
        raise InvalidAudio(
            f"Durée {info.duration_seconds:.1f} s hors bornes ({min_seconds:.0f}–{max_seconds:.0f} s)"
        )
    return info


def _wav_duration(data: bytes) -> float:
    pos = 12
    byte_rate = None
    while pos + 8 <= len(data):
        chunk_id = data[pos:pos + 4]
        size = struct.unpack_from("<I", data, pos + 4)[0]
        body = pos + 8
        if chunk_id == b"fmt " and size >= 16:
            byte_rate = struct.unpack_from("<I", data, body + 8)[0]
        elif chunk_id == b"data":
            if not byte_rate:
                raise InvalidAudio("En-tête WAV incomplet")
            available = min(size, len(data) - body)
            return available / byte_rate
        pos = body + size + (size % 2)
    raise InvalidAudio("Bloc de données WAV introuvable")


def _find_box(data: bytes, start: int, end: int, box: bytes) -> int:
    pos = start
    while pos + 8 <= end:
        size = struct.unpack_from(">I", data, pos)[0]
        if data[pos + 4:pos + 8] == box:
            return pos
        if size == 1 and pos + 16 <= end:
            size = struct.unpack_from(">Q", data, pos + 8)[0]
        if size < 8:
            return -1
        pos += size
    return -1


def _mp4_duration(data: bytes) -> float:
    """Durée AAC/MP4 (format des enregistreurs iOS et Android), lue dans moov/mvhd."""
    moov = _find_box(data, 0, len(data), b"moov")
    if moov < 0:
        raise InvalidAudio("Fichier M4A incomplet")
    moov_end = min(len(data), moov + struct.unpack_from(">I", data, moov)[0])
    mvhd = _find_box(data, moov + 8, moov_end, b"mvhd")
    if mvhd < 0 or mvhd + 32 > len(data):
        raise InvalidAudio("Fichier M4A sans durée")
    if data[mvhd + 8] == 1:
        if mvhd + 40 > len(data):
            raise InvalidAudio("Fichier M4A sans durée")
        timescale, duration = struct.unpack_from(">IQ", data, mvhd + 28)
    else:
        timescale, duration = struct.unpack_from(">II", data, mvhd + 20)
    if timescale == 0:
        raise InvalidAudio("Fichier M4A sans durée")
    return duration / timescale


def _skip_id3(data: bytes) -> int:
    if len(data) >= 10 and data[0:3] == b"ID3":
        size = (data[6] & 0x7F) << 21 | (data[7] & 0x7F) << 14 | (data[8] & 0x7F) << 7 | (data[9] & 0x7F)
        return 10 + size
    return 0


def _is_mpeg_frame(data: bytes, offset: int) -> bool:
    return len(data) >= offset + 4 and data[offset] == 0xFF and (data[offset + 1] & 0xE0) == 0xE0


def _mp3_duration(data: bytes, offset: int) -> float:
    header = data[offset + 1], data[offset + 2]
    version_bits = (header[0] >> 3) & 0x03  # 3 = MPEG-1
    bitrate_index = (header[1] >> 4) & 0x0F
    table = _MP3_BITRATES_V1 if version_bits == 3 else _MP3_BITRATES_V2
    if bitrate_index in (0, 15):
        raise InvalidAudio("Débit MP3 non pris en charge")
    bitrate = table[bitrate_index] * 1000
    # Estimation à débit constant (suffisante pour borner 10–30 s).
    return (len(data) - offset) * 8 / bitrate
