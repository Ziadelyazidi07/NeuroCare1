"""NeuroCare — microservice audio interne (FastAPI).

Étape 1 : squelette avec /health et contrôle de la clé interne.
Les routes /voices et /synthesize sont implémentées à l'étape 3 (cahier §10.1).
"""

import os

from fastapi import Depends, FastAPI, Header, HTTPException, status

INTERNAL_KEY = os.environ.get("INTERNAL_KEY", "")

app = FastAPI(title="NeuroCare audio-service", version="0.1.0")


def require_internal_key(x_internal_key: str | None = Header(default=None)) -> None:
    """Authentification service-à-service par clé partagée (MVP)."""
    if not INTERNAL_KEY or x_internal_key != INTERNAL_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clé interne invalide")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "UP", "model": "none"}


@app.get("/internal/ping", dependencies=[Depends(require_internal_key)])
def ping() -> dict[str, str]:
    return {"status": "ok"}
