# ── Build stage ────────────────────────────────────────────────
FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────
FROM python:3.12-slim AS runtime
RUN groupadd -g 1001 medguard && useradd -u 1001 -g medguard -m medguard
WORKDIR /app

COPY --from=build /install /usr/local
COPY --chown=medguard:medguard . .

USER medguard
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
