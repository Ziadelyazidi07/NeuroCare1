# NeuroCare audio-service — Python 3.11 + FastAPI
# TTS hors ligne : espeak-ng (fr, ar) + lame (MP3 64 kbit/s mono, ENF-13).
FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update \
    && apt-get install -y --no-install-recommends espeak-ng lame \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app

# Tests : docker build --target test ../audio-service
FROM base AS test
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests ./tests
RUN python -m pytest -q

FROM base AS runtime
RUN useradd --system --uid 1001 audiosvc \
    && mkdir -p /data && chown audiosvc /data
USER audiosvc
ENV DATA_DIR=/data
VOLUME ["/data"]
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health')"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
