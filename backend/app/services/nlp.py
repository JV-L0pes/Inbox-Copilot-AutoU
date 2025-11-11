from __future__ import annotations

import re
from functools import lru_cache
from typing import Dict, List

try:
    import spacy
    from spacy.language import Language
except ModuleNotFoundError:  # pragma: no cover - fallback para ambientes sem spaCy
    spacy = None
    Language = None


@lru_cache
def get_pipeline() -> Language:
    if spacy is None:
        return None  # type: ignore[return-value]
    try:
        return spacy.load("en_core_web_sm")  # type: ignore[return-value]
    except OSError:
        nlp = spacy.blank("en")
        if "lemmatizer" not in nlp.pipe_names:
            try:
                nlp.add_pipe("lemmatizer", config={"mode": "rule"}, name="lemmatizer")
                nlp.initialize()  # carrega lookups se disponíveis
            except Exception:
                if "lemmatizer" in nlp.pipe_names:
                    nlp.remove_pipe("lemmatizer")
                pass
        return nlp  # type: ignore[return-value]


def preprocess(text: str) -> Dict[str, List[str]]:
    pipeline = get_pipeline()
    if pipeline is None:
        return _preprocess_fallback(text)

    try:
        doc = pipeline(text)
    except Exception:
        return _preprocess_fallback(text)
    tokens: List[str] = []
    for token in doc:
        if token.is_stop or token.is_space or not token.text.strip():
            continue
        if not token.is_alpha and token.lemma_ == "":
            continue
        lemma = token.lemma_.lower() if token.lemma_ else token.text.lower()
        tokens.append(lemma)

    key_phrases: List[str] = []
    if doc.has_annotation("DEP"):
        key_phrases = list({chunk.text.strip() for chunk in doc.noun_chunks if chunk.text.strip()})

    return {
        "tokens": tokens,
        "key_phrases": key_phrases[:10],
    }


def _preprocess_fallback(text: str) -> Dict[str, List[str]]:
    clean_text = re.sub(r"[^A-Za-zÀ-ÿ0-9\s]", " ", text.lower())
    raw_tokens = clean_text.split()
    tokens = [token for token in raw_tokens if len(token) > 2]
    key_phrases = list({token for token in tokens if len(token) > 6})[:10]
    return {
        "tokens": tokens[:50],
        "key_phrases": key_phrases,
    }


