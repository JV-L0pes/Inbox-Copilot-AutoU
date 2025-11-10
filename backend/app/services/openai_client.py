from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Dict, List

from fastapi import HTTPException, status
from openai import OpenAI

from ..config import Settings, get_settings
from ..schemas import EmailAnalysisResult, EmailCategory, OpenAIUsage


def classify_and_respond(email_text: str, insights: Dict[str, List[str]]) -> EmailAnalysisResult:
    client, settings = _get_client()
    prompt = _build_prompt(email_text, insights)
    try:
        response = client.responses.create(
            model=settings.openai_model,
            input=prompt,
            max_output_tokens=settings.max_output_tokens,
            temperature=0.2,
            reasoning={"effort": "medium"},
            timeout=settings.request_timeout,
        )
    except Exception as exc:  # pragma: no cover - falhas de rede/svc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao consultar OpenAI: {exc}",
        ) from exc

    data = _parse_response(response)  # type: ignore[arg-type]
    return EmailAnalysisResult(**data)


def _build_prompt(email_text: str, insights: Dict[str, List[str]]) -> List[Dict[str, Any]]:
    tokens = ", ".join(insights.get("tokens", [])[:25]) or "nenhum"
    key_phrases = "; ".join(insights.get("key_phrases", [])) or "nenhuma"
    instructions = (
        "Você é um assistente que classifica emails recebidos em português ou inglês. "
        "Categorias possíveis: Produtivo (requer ação/resposta) ou Improdutivo (sem ação imediata). "
        "Retorne SEMPRE um JSON válido com os campos: "
        "category (Produtivo ou Improdutivo), confidence (0-1), "
        "suggested_response (texto curto e cordial em português), "
        "justification (frase explicando), highlights (lista com até 3 trechos relevantes), "
        "raw_labels (lista de rótulos auxiliares). "
        "A resposta sugerida deve alinhar com a categoria e oferecer próximo passo adequado."
    )
    user_input = (
        f"Email:\n\"\"\"\n{email_text.strip()}\n\"\"\"\n\n"
        f"Tokens limpos: {tokens}\n"
        f"Frases-chave: {key_phrases}\n"
        "Retorne somente o JSON. Nada além do JSON."
    )
    return [
        {"role": "system", "content": [{"type": "text", "text": instructions}]},
        {"role": "user", "content": [{"type": "text", "text": user_input}]},
    ]


def _parse_response(response: Any) -> Dict[str, Any]:
    content = response.output_text.strip()
    try:
        payload: Dict[str, Any] = json.loads(content)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resposta inesperada da OpenAI: {content}",
        ) from exc

    category = payload.get("category", "Produtivo")
    if category not in (EmailCategory.productive.value, EmailCategory.unproductive.value):
        category = EmailCategory.productive.value

    usage = None
    if response.usage:
        usage = OpenAIUsage.parse_obj(
            {
                "promptTokens": response.usage.input_tokens,
                "completionTokens": response.usage.output_tokens,
                "totalTokens": response.usage.total_tokens,
            }
        )

    return {
        "category": category,
        "suggested_response": payload.get(
            "suggested_response",
            "Olá! Obrigado pela mensagem. Em breve retornarei com mais detalhes.",
        ),
        "confidence": min(max(payload.get("confidence", 0.6), 0.0), 1.0),
        "highlights": payload.get("highlights") or None,
        "raw_labels": payload.get("raw_labels") or None,
        "usage": usage,
    }


@lru_cache
def _get_client() -> tuple[OpenAI, Settings]:
    settings = get_settings()
    client_kwargs: Dict[str, Any] = {"api_key": settings.openai_api_key}
    if settings.openai_base_url:
        client_kwargs["base_url"] = settings.openai_base_url
    return OpenAI(**client_kwargs), settings


