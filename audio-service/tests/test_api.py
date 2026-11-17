"""Tests du contrat du microservice audio (cahier §10.1)."""

from __future__ import annotations

import io
import struct
import wave
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.audio_validation import InvalidAudio, check_sample, inspect
from app.config import Settings
from app.engines import CloningUnavailable, EngineUnavailable, SynthesizedAudio, UnsupportedLanguage
from app.main import create_app

KEY = "test-internal-key"
HEADERS = {"X-Internal-Key": KEY}


def wav_bytes(seconds: float, rate: int = 8000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * int(seconds * rate))
    return buffer.getvalue()


def mp3_bytes(seconds: float, kbps: int = 64) -> bytes:
    # En-tête MPEG-1 Layer III, 64 kbit/s (index 5), 44,1 kHz, suivi de données factices.
    header = bytes([0xFF, 0xFB, 0x50, 0xC4])
    return header + b"\x00" * (int(seconds * kbps * 1000 / 8) - 4)


def m4a_bytes(duration: int, timescale: int = 1000, version: int = 0) -> bytes:
    """M4A minimal : ftyp puis moov/mvhd, comme produit par les enregistreurs iOS/Android."""
    if version == 1:
        mvhd_body = bytes([1, 0, 0, 0]) + bytes(16) + struct.pack(">IQ", timescale, duration)
    else:
        mvhd_body = bytes(4) + bytes(8) + struct.pack(">II", timescale, duration)
    mvhd_body += bytes(80)
    mvhd = struct.pack(">I", 8 + len(mvhd_body)) + b"mvhd" + mvhd_body
    moov = struct.pack(">I", 8 + len(mvhd)) + b"moov" + mvhd
    ftyp = struct.pack(">I", 24) + b"ftypM4A " + bytes(4) + b"isomM4A "
    return ftyp + moov + bytes(64)


class FakeTts:
    name = "fake-tts"

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

    def supports(self, language: str) -> bool:
        return language in ("fr", "ar")

    def synthesize(self, text: str, language: str) -> SynthesizedAudio:
        if not self.supports(language):
            raise UnsupportedLanguage(language)
        if self.fail:
            raise EngineUnavailable("panne")
        return SynthesizedAudio(f"TTS:{language}:{text}".encode(), "audio/mpeg")


class FakeCloning:
    name = "fake-clone"

    def enroll(self, voice_dir: Path, sample: bytes, language: str) -> None:
        (voice_dir / "embedding.bin").write_bytes(b"emb")

    def synthesize(self, voice_dir: Path, text: str, language: str) -> SynthesizedAudio:
        return SynthesizedAudio(f"CLONE:{text}".encode(), "audio/mpeg")


class NoCloning:
    name = "none"

    def enroll(self, voice_dir: Path, sample: bytes, language: str) -> None:
        raise CloningUnavailable("absent")

    def synthesize(self, voice_dir: Path, text: str, language: str) -> SynthesizedAudio:
        raise CloningUnavailable("absent")


def client(tmp_path: Path, tts=None, cloning=None) -> TestClient:
    settings = Settings(internal_key=KEY, data_dir=tmp_path, tts_engine="fake", cloning_engine="fake")
    return TestClient(create_app(settings, tts or FakeTts(), cloning or FakeCloning()))


# ---------- Sécurité ----------

def test_health_is_public(tmp_path):
    response = client(tmp_path).get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "UP"


@pytest.mark.parametrize("headers", [{}, {"X-Internal-Key": "mauvaise"}])
def test_internal_key_is_required(tmp_path, headers):
    response = client(tmp_path).post("/synthesize", json={"text": "x", "language": "fr"}, headers=headers)
    assert response.status_code == 401
    assert response.json()["code"] == "INVALID_INTERNAL_KEY"


def test_empty_configured_key_rejects_everything(tmp_path):
    settings = Settings(internal_key="", data_dir=tmp_path, tts_engine="fake", cloning_engine="fake")
    api = TestClient(create_app(settings, FakeTts(), FakeCloning()))
    assert api.post("/synthesize", json={"text": "x", "language": "fr"}, headers={"X-Internal-Key": ""}).status_code == 401


# ---------- Voix ----------

def test_enroll_voice_then_synthesize_with_clone_and_delete(tmp_path):
    api = client(tmp_path)
    created = api.post("/voices", files={"file": ("s.wav", wav_bytes(12), "audio/wav")},
                       data={"language": "fr"}, headers=HEADERS)
    assert created.status_code == 201
    voice_id = created.json()["voiceId"]
    assert created.json()["status"] == "READY"

    audio = api.post("/synthesize", json={"voiceId": voice_id, "text": "Baba", "language": "fr"}, headers=HEADERS)
    assert audio.status_code == 200
    assert audio.content == b"CLONE:Baba"

    assert api.delete(f"/voices/{voice_id}", headers=HEADERS).status_code == 204
    assert api.post("/synthesize", json={"voiceId": voice_id, "text": "x", "language": "fr"},
                    headers=HEADERS).status_code == 404
    # Idempotent.
    assert api.delete(f"/voices/{voice_id}", headers=HEADERS).status_code == 204


def test_enroll_without_cloning_engine_reports_failure_and_keeps_nothing(tmp_path):
    api = client(tmp_path, cloning=NoCloning())
    response = api.post("/voices", files={"file": ("s.mp3", mp3_bytes(15), "audio/mpeg")}, headers=HEADERS)
    assert response.status_code == 201
    assert response.json()["status"] == "FAILED"
    assert response.json()["voiceId"] is None
    assert not any((tmp_path / "voices").glob("*/*"))


@pytest.mark.parametrize("payload", [wav_bytes(5), wav_bytes(31), b"pas un fichier audio" * 100])
def test_invalid_samples_are_rejected(tmp_path, payload):
    response = client(tmp_path).post("/voices", files={"file": ("s.wav", payload, "audio/wav")}, headers=HEADERS)
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_SAMPLE"


# ---------- Synthèse et repli ----------

def test_standard_tts_without_voice(tmp_path):
    response = client(tmp_path).post("/synthesize", json={"voiceId": None, "text": "Bonjour", "language": "fr"},
                                     headers=HEADERS)
    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.content == b"TTS:fr:Bonjour"


def test_darija_is_unsupported_so_backend_uses_prerecorded_audio(tmp_path):
    response = client(tmp_path).post("/synthesize", json={"text": "x", "language": "ar-MA"}, headers=HEADERS)
    assert response.status_code == 422
    assert response.json()["code"] == "UNSUPPORTED_LANGUAGE"


def test_clone_request_without_cloning_engine_is_503(tmp_path):
    voice_dir = tmp_path / "voices" / ("a" * 32)
    voice_dir.mkdir(parents=True)
    response = client(tmp_path, cloning=NoCloning()).post(
        "/synthesize", json={"voiceId": "a" * 32, "text": "x", "language": "fr"}, headers=HEADERS)
    assert response.status_code == 503
    assert response.json()["code"] == "CLONING_UNAVAILABLE"


def test_engine_failure_is_503(tmp_path):
    response = client(tmp_path, tts=FakeTts(fail=True)).post(
        "/synthesize", json={"text": "x", "language": "fr"}, headers=HEADERS)
    assert response.status_code == 503
    assert response.json()["code"] == "ENGINE_UNAVAILABLE"


def test_text_length_is_bounded(tmp_path):
    response = client(tmp_path).post("/synthesize", json={"text": "x" * 301, "language": "fr"}, headers=HEADERS)
    assert response.status_code == 422


def test_path_traversal_voice_id_is_rejected(tmp_path):
    response = client(tmp_path).post("/synthesize", json={"voiceId": "../../etc", "text": "x", "language": "fr"},
                                     headers=HEADERS)
    assert response.status_code == 404


# ---------- Validation audio ----------

def test_wav_and_mp3_durations():
    assert inspect(wav_bytes(12)).duration_seconds == pytest.approx(12, abs=0.01)
    info = inspect(mp3_bytes(20))
    assert info.format == "mp3"
    assert info.duration_seconds == pytest.approx(20, abs=0.1)


def test_m4a_from_phone_recorders():
    assert inspect(m4a_bytes(12_000)).format == "m4a"
    assert inspect(m4a_bytes(12_000)).duration_seconds == pytest.approx(12)
    assert inspect(m4a_bytes(15 * 44_100, 44_100, version=1)).duration_seconds == pytest.approx(15)
    with pytest.raises(InvalidAudio):
        inspect(m4a_bytes(12_000)[:24])


def test_enroll_accepts_m4a(tmp_path):
    response = client(tmp_path).post("/voices", files={"file": ("s.m4a", m4a_bytes(12_000), "audio/mp4")},
                                     headers=HEADERS)
    assert response.status_code == 201
    assert response.json()["status"] == "READY"


def test_id3_tag_is_skipped():
    tag = b"ID3" + bytes([4, 0, 0]) + bytes([0, 0, 0, 10]) + b"\x00" * 10
    assert inspect(tag + mp3_bytes(15)).format == "mp3"


def test_size_limit():
    with pytest.raises(InvalidAudio):
        check_sample(wav_bytes(12), 10, 30, max_bytes=1000)


def test_truncated_wav_is_rejected():
    header = b"RIFF" + struct.pack("<I", 4) + b"WAVE"
    with pytest.raises(InvalidAudio):
        inspect(header)
