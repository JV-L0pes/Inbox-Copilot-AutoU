from io import BytesIO

import os

os.environ.setdefault("OPENAI_API_KEY", "test-key")

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.schemas import EmailAnalysisResult, EmailCategory

client = TestClient(app)


def test_analyze_with_text(monkeypatch):
    def fake_analyze(text: str) -> EmailAnalysisResult:
        assert "support ticket" in text
        return EmailAnalysisResult(
            category=EmailCategory.productive,
            suggested_response="Olá! Já estamos cuidando do seu chamado.",
            confidence=0.91,
            highlights=["support ticket"],
                normalized_text=text,
        )

    monkeypatch.setattr("backend.app.services.analyzer.analyze", fake_analyze)

    response = client.post("/analyze", data={"text": "Need help with support ticket 123"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == EmailCategory.productive.value
    assert "cuidando" in payload["suggested_response"]


def test_analyze_with_file(monkeypatch):
    def fake_analyze(text: str) -> EmailAnalysisResult:
        assert "manual" in text.lower()
        return EmailAnalysisResult(
            category=EmailCategory.unproductive,
            suggested_response="Obrigado! Guardaremos o manual.",
            confidence=0.65,
                normalized_text=text,
        )

    monkeypatch.setattr("backend.app.services.analyzer.analyze", fake_analyze)

    file_content = b"Manual anexado para sua leitura."
    files = {"file": ("manual.txt", BytesIO(file_content), "text/plain")}

    response = client.post("/analyze", files=files)

    assert response.status_code == 200
    payload = response.json()
    assert payload["category"] == EmailCategory.unproductive.value


def test_analyze_missing_payload():
    response = client.post("/analyze", data={})
    assert response.status_code == 400
    assert "Envie um texto ou arquivo" in response.json()["detail"]


