from __future__ import annotations

import json
from functools import lru_cache
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from openai import OpenAI

from ..config import Settings, get_settings
from ..schemas import EmailAnalysisResult, EmailCategory, OpenAIUsage


def classify_and_respond(email_text: str, insights: Dict[str, List[str]]) -> EmailAnalysisResult:
    settings = get_settings()

    if settings.use_openai_stub or not settings.openai_api_key:
        return _stub_classification(email_text, insights)

    client = _get_client(settings.openai_api_key, settings.openai_base_url)
    messages = _build_messages(email_text, insights)
    try:
        if hasattr(client, "responses"):
            response = client.responses.create(
                model=settings.openai_model,
                messages=[
                    {
                        "role": message["role"],
                        "content": [{"type": "text", "text": message["content"]}],
                    }
                    for message in messages
                ],
                max_output_tokens=settings.max_output_tokens,
                temperature=0.2,
                timeout=settings.request_timeout,
            )
            data = _parse_responses_response(response)
        else:  # Fallback para clientes antigos que só possuem chat.completions
            completion = client.chat.completions.create(
                model=settings.openai_model,
                messages=messages,
                max_tokens=settings.max_output_tokens,
                temperature=0.2,
                timeout=settings.request_timeout,
            )
            data = _parse_chat_completion(completion)
    except Exception as exc:  # pragma: no cover - falhas de rede/svc
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao consultar OpenAI: {exc}",
        ) from exc

    return EmailAnalysisResult(**data)


def _build_messages(email_text: str, insights: Dict[str, List[str]]) -> List[Dict[str, str]]:
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
        "Mencione explicitamente o status atual e indique se existem pendências relevantes;"
        "Caso não haja, registre essa informação de forma objetiva."
    )
    user_input = (
        f"Email:\n\"\"\"\n{email_text.strip()}\n\"\"\"\n\n"
        f"Tokens limpos: {tokens}\n"
        f"Frases-chave: {key_phrases}\n"
        "Retorne somente o JSON. Nada além do JSON."
    )
    return [
        {"role": "system", "content": instructions},
        {"role": "user", "content": user_input},
    ]


def _parse_responses_response(response: Any) -> Dict[str, Any]:
    content = response.output_text or ""
    payload = _load_payload(content)

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
        "justification": payload.get("justification"),
        "highlights": payload.get("highlights") or None,
        "raw_labels": payload.get("raw_labels") or None,
        "usage": usage,
    }


def _parse_chat_completion(completion: Any) -> Dict[str, Any]:
    message = completion.choices[0].message
    content = message.content or ""
    payload = _load_payload(content)

    category = payload.get("category", EmailCategory.productive.value)
    if category not in (EmailCategory.productive.value, EmailCategory.unproductive.value):
        category = EmailCategory.productive.value

    usage = None
    if completion.usage:
        usage = OpenAIUsage.parse_obj(
            {
                "promptTokens": completion.usage.prompt_tokens,
                "completionTokens": completion.usage.completion_tokens,
                "totalTokens": completion.usage.total_tokens,
            }
        )

    return {
        "category": category,
        "suggested_response": payload.get(
            "suggested_response",
            "Olá! Obrigado pela mensagem. Em breve retornarei com mais detalhes.",
        ),
        "confidence": min(max(payload.get("confidence", 0.6), 0.0), 1.0),
        "justification": payload.get("justification"),
        "highlights": payload.get("highlights") or None,
        "raw_labels": payload.get("raw_labels") or None,
        "usage": usage,
    }


@lru_cache
def _get_client(api_key: str, base_url: Optional[str]) -> OpenAI:
    client_kwargs: Dict[str, Any] = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = base_url
    return OpenAI(**client_kwargs)


def _stub_classification(email_text: str, insights: Dict[str, List[str]]) -> EmailAnalysisResult:
    tokens = insights.get("tokens", [])
    key_phrases = insights.get("key_phrases", [])[:3] or None

    text_lower = email_text.lower()
    tokens_set = set(tokens)
    snippet = (
        email_text.strip().splitlines()[0][:120]
        if email_text.strip()
        else "sua solicitação"
    )

    productive_terms = {
        "ticket",
        "suporte",
        "acesso",
        "erro",
        "status",
        "pendência",
        "cliente",
        "prazo",
        "login",
        "senha",
        "chamado",
        "bloqueado",
    }
    improductive_terms = {
        "obrigado",
        "obrigada",
        "parabéns",
        "feliz",
        "agradeço",
        "grato",
        "agradecimentos",
        "elogio",
        "abraço",
    }

    category = EmailCategory.productive
    pending_statement = "Nenhuma pendência adicional foi identificada no momento; avisaremos se algo mudar."
    suggested = (
        f"Status: estamos tratando a solicitação sobre “{snippet}” neste momento."
        f" {pending_statement}"
    )

    if any(term in text_lower for term in improductive_terms) and not tokens_set.intersection(productive_terms):
        category = EmailCategory.unproductive
        suggested = (
            "Status: mensagem recebida e registrada sem necessidade de ação imediata."
            " Não há pendências decorrentes desta interação; seguimos à disposição."
        )
    else:
        if tokens_set.intersection({"manual", "anexo", "relatório", "documento"}):
            pending_statement = (
                "Estamos revisando o material anexado e confirmaremos se há pendências complementares."
            )
            suggested = (
                "Status: arquivo recebido e encaminhado para revisão."
                f" {pending_statement}"
            )

        if tokens_set.intersection({"status", "andamento", "atualização"}):
            pending_statement = (
                "Nenhuma pendência bloqueante foi identificada; comunicaremos imediatamente caso surja."
            )
            suggested = (
                "Status: atualização em andamento e retorno previsto até o fim do dia."
                f" {pending_statement}"
            )

    return EmailAnalysisResult(
        category=category,
        suggested_response=suggested,
        confidence=0.5,
        highlights=key_phrases,
        raw_labels=["stub"],
        normalized_text=email_text.strip() or None,
        justification="Classificação gerada localmente sem consulta à OpenAI.",
    )


def _strip_code_fence(content: str) -> str:
    text = content.strip()
    if not text.startswith("```"):
        return text

    lines = text.splitlines()
    if lines:
        fence = lines[0]
        if fence.startswith("```"):
            lines = lines[1:]
    while lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _load_payload(raw_content: str) -> Dict[str, Any]:
    content = _strip_code_fence(raw_content)
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = content[start : end + 1]
    else:
        candidate = content

    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resposta inesperada da OpenAI: {raw_content.strip()}",
        ) from exc
    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resposta inesperada da OpenAI: payload não é um objeto JSON.",
        )
    return payload


