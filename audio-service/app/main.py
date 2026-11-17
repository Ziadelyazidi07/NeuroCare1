"""NeuroCare — microservice audio interne (FastAPI), non exposé à Internet (cahier §10.1).

Routes : POST /voices, POST /synthesize, DELETE /voices/{voiceId}, GET /health.
Toutes, sauf /health, exigent l'en-tête X-Internal-Key (clé partagée avec le backend).
"""

from __future__ import annotations

import hmac
import logging
import re
import shutil
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Response, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .audio_validation import InvalidAudio, check_sample
from .config import Settings
from .engines import (
    CloningEngine,
    CloningUnavailable,
    EngineUnavailable,
    TtsEngine,
    UnsupportedLanguage,
    build_cloning,
    build_tts,
)

log = logging.getLogger("audio-service")
_VOICE_ID = re.compile(r"^[0-9a-f]{32}$")


class SynthesizeRequest(BaseModel):
    voiceId: str | None = None
    text: str = Field(min_length=1, max_length=300)
    language: str = Field(min_length=2, max_length=10)


def _error(status_code: int, code: str, detail: str) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"code": code, "detail": detail})


def create_app(settings: Settings | None = None, tts: TtsEngine | None = None,
               cloning: CloningEngine | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    tts = tts or build_tts(settings.tts_engine)
    cloning = cloning or build_cloning(settings.cloning_engine)
    voices_dir = settings.data_dir / "voices"

    app = FastAPI(title="NeuroCare audio-service", version="1.0.0")

    def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
        expected = settings.internal_key
        if not expected or x_internal_key is None or not hmac.compare_digest(x_internal_key, expected):
            raise _error(status.HTTP_401_UNAUTHORIZED, "INVALID_INTERNAL_KEY", "Clé interne invalide")

    def voice_dir(voice_id: str) -> Path:
        if not _VOICE_ID.match(voice_id):
            raise _error(status.HTTP_404_NOT_FOUND, "VOICE_NOT_FOUND", "Voix inconnue")
        return voices_dir / voice_id

    @app.exception_handler(HTTPException)
    async def http_error(_, exc: HTTPException) -> JSONResponse:
        body = exc.detail if isinstance(exc.detail, dict) else {"code": "ERROR", "detail": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content=body)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "UP", "model": tts.name, "cloning": cloning.name}

    @app.post("/voices", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_internal_key)])
    async def create_voice(file: UploadFile = File(...), language: str = Form("fr")) -> dict:
        data = await file.read(settings.max_sample_bytes + 1)
        try:
            check_sample(data, settings.min_sample_seconds, settings.max_sample_seconds, settings.max_sample_bytes)
        except InvalidAudio as exc:
            raise _error(status.HTTP_400_BAD_REQUEST, "INVALID_SAMPLE", str(exc)) from exc

        voice_id = uuid.uuid4().hex
        target = voices_dir / voice_id
        target.mkdir(parents=True, exist_ok=True)
        try:
            cloning.enroll(target, data, language)
        except CloningUnavailable as exc:
            # Minimisation : l'échantillon n'est pas conservé si aucun profil n'est créé.
            shutil.rmtree(target, ignore_errors=True)
            return {"voiceId": None, "status": "FAILED", "reason": "CLONING_UNAVAILABLE", "detail": str(exc)}
        return {"voiceId": voice_id, "status": "READY"}

    @app.post("/synthesize", dependencies=[Depends(require_internal_key)])
    def synthesize(request: SynthesizeRequest) -> Response:
        try:
            if request.voiceId:
                directory = voice_dir(request.voiceId)
                if not directory.is_dir():
                    raise _error(status.HTTP_404_NOT_FOUND, "VOICE_NOT_FOUND", "Voix inconnue")
                audio = cloning.synthesize(directory, request.text, request.language)
            else:
                audio = tts.synthesize(request.text, request.language)
        except UnsupportedLanguage as exc:
            raise _error(status.HTTP_422_UNPROCESSABLE_ENTITY, "UNSUPPORTED_LANGUAGE",
                         f"Langue non prise en charge : {exc}") from exc
        except CloningUnavailable as exc:
            raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "CLONING_UNAVAILABLE", str(exc)) from exc
        except EngineUnavailable as exc:
            log.warning("Moteur TTS indisponible : %s", exc)
            raise _error(status.HTTP_503_SERVICE_UNAVAILABLE, "ENGINE_UNAVAILABLE", "Moteur indisponible") from exc
        return Response(content=audio.content, media_type=audio.media_type)

    @app.delete("/voices/{voice_id}", status_code=status.HTTP_204_NO_CONTENT,
                dependencies=[Depends(require_internal_key)])
    def delete_voice(voice_id: str) -> Response:
        if _VOICE_ID.match(voice_id):
            shutil.rmtree(voices_dir / voice_id, ignore_errors=True)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
