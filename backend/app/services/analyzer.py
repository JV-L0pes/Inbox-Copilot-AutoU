from __future__ import annotations

from ..schemas import EmailAnalysisResult
from . import nlp
from .openai_client import classify_and_respond


def analyze(text: str) -> EmailAnalysisResult:
    if not text or not text.strip():
        raise ValueError("Texto vazio para análise.")
    insights = nlp.preprocess(text)
    return classify_and_respond(text, insights)


