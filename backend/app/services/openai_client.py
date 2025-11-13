from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any, Dict, List, Optional

from fastapi import HTTPException, status
from openai import OpenAI

from ..config import Settings, get_settings
logger = logging.getLogger(__name__)

from ..schemas import EmailAnalysisResult, EmailCategory, OpenAIUsage


def classify_and_respond(email_text: str, insights: Dict[str, List[str]]) -> EmailAnalysisResult:
    settings = get_settings()

    if not settings.openai_api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OPENAI_API_KEY não configurada.",
        )

    client = _get_client(settings.openai_api_key, settings.openai_base_url)
    messages = _build_messages(email_text, insights)
    response_schema: Dict[str, Any] = {
        "name": "email_classification_payload",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": [
                        EmailCategory.productive.value,
                        EmailCategory.unproductive.value,
                    ],
                },
                "confidence": {"type": "number"},
                "suggested_response": {"type": "string"},
                "justification": {"type": ["string", "null"]},
                "highlights": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
                "raw_labels": {
                    "type": ["array", "null"],
                    "items": {"type": "string"},
                },
            },
            "required": ["category", "confidence", "suggested_response", "justification", "highlights", "raw_labels"],
            "additionalProperties": False,
        },
    }
    try:
        data = _call_chat_completion_with_retry(
            client,
            messages,
            response_schema=response_schema,
            settings=settings,
        )
    except HTTPException:
        raise
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
        "Respostas devem soar humanas, empáticas e proativas: cumprimente, agradeça o contato, descreva o que já foi feito ou será feito, cite próximos passos com prazos quando disponíveis e encerre cordialmente. "
        "Prefira parágrafos coesos em vez de listas ou rótulos fixos (evite 'Status:', 'Próximos passos:' etc.). "
        "Use linguagem acessível e positiva. Quando classificar como Improdutivo (apenas cordialidades), agradeça e deseje bons votos, sem falar de 'status' nem pendências."
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


def _call_chat_completion_with_retry(
    client: OpenAI,
    messages: List[Dict[str, str]],
    *,
    response_schema: Dict[str, Any],
    settings: Settings,
) -> Dict[str, Any]:
    # Tenta com valores crescentes para evitar finish_reason=length
    base_tokens = settings.max_output_tokens or 2000
    attempts = [
        max(base_tokens, 2000),  # Mínimo de 2000 tokens
        max(base_tokens * 2, 3000),  # Se ainda falhar, tenta com mais
        max(base_tokens * 3, 4000),  # Última tentativa com ainda mais tokens
    ]
    last_error: Optional[Exception] = None

    response_format: Dict[str, Any] = {
        "type": "json_schema",
        "json_schema": response_schema,
    }

    for max_tokens in attempts:
        try:
            completion = client.chat.completions.create(
                model=settings.openai_model,
                messages=messages,
                max_completion_tokens=max_tokens,
                timeout=settings.request_timeout,
                response_format=response_format,
            )
            completion_dump = completion.model_dump()
            if settings.debug_openai_payload:
                _log_openai_payload(
                    f"chat_completions_retry_{max_tokens}",
                    completion_dump,
                )
            
            # Verifica se completou corretamente
            choices = completion_dump.get("choices") or []
            if choices:
                finish_reason = choices[0].get("finish_reason", "")
                if finish_reason == "length":
                    # Se atingiu o limite, tenta com mais tokens na próxima iteração
                    if max_tokens == attempts[-1]:
                        # Já tentou com o máximo, não adianta continuar
                        raise HTTPException(
                            status_code=status.HTTP_502_BAD_GATEWAY,
                            detail=f"Resposta da OpenAI atingiu limite de tokens mesmo com {max_tokens} tokens.",
                        )
                    continue  # Tenta próxima iteração com mais tokens
            
            return _parse_chat_completion(completion_dump, settings)
        except HTTPException as exc:
            last_error = exc
            if exc.status_code != status.HTTP_502_BAD_GATEWAY:
                raise
            # Se for 502 por conteúdo vazio e ainda tiver tentativas, continua
            if "conteúdo vazio" in str(exc.detail) or "finish_reason=length" in str(exc.detail):
                if max_tokens != attempts[-1]:
                    continue
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="Falha desconhecida ao processar chat completion.",
    )


def _parse_chat_completion(completion_dump: Dict[str, Any], settings: Settings) -> Dict[str, Any]:
    choices = completion_dump.get("choices") or []
    if not choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resposta da OpenAI veio sem choices.",
        )
    message = choices[0].get("message") or {}
    content = message.get("content") or ""
    
    if not content or not content.strip():
        finish_reason = choices[0].get("finish_reason", "unknown")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resposta inesperada da OpenAI: conteúdo vazio (finish_reason={finish_reason})",
        )
    
    payload = _load_payload(content)

    _ensure_required_fields(payload, completion_dump, settings, source="chat_completions")

    category = payload["category"]
    if category not in (EmailCategory.productive.value, EmailCategory.unproductive.value):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Categoria inválida retornada pela OpenAI: {category}",
        )

    usage = None
    usage_dump = completion_dump.get("usage")
    if usage_dump:
        usage = OpenAIUsage.parse_obj(
            {
                "promptTokens": usage_dump.get("prompt_tokens"),
                "completionTokens": usage_dump.get("completion_tokens"),
                "totalTokens": usage_dump.get("total_tokens"),
            }
        )

    return {
        "category": category,
        "suggested_response": payload["suggested_response"],
        "confidence": _normalize_confidence(payload["confidence"]),
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


def _looks_like_payload(candidate: Dict[str, Any]) -> bool:
    required = {"category", "confidence", "suggested_response"}
    if not required.issubset(candidate.keys()):
        return False
    if not isinstance(candidate.get("category"), str):
        return False
    if not isinstance(candidate.get("confidence"), (int, float)):
        return False
    if not isinstance(candidate.get("suggested_response"), str):
        return False
    return required.issubset(candidate.keys())


def _log_openai_payload(source: str, payload: Any) -> None:
    try:
        logger.info("OpenAI %s payload: %s", source, _safe_dump(payload))
    except Exception:  # pragma: no cover - logging não deve falhar
        logger.exception("Falha ao registrar payload OpenAI (%s)", source)


def _safe_dump(obj: Any) -> str:
    try:
        if hasattr(obj, "model_dump_json"):
            return obj.model_dump_json()
        if hasattr(obj, "model_dump"):
            return json.dumps(obj.model_dump(), ensure_ascii=False)
        if isinstance(obj, dict):
            return json.dumps(obj, ensure_ascii=False)
        return repr(obj)
    except Exception:  # pragma: no cover
        return repr(obj)


def _ensure_required_fields(
    payload: Dict[str, Any],
    raw_response: Any,
    settings: Settings,
    *,
    source: str,
) -> None:
    required = ("category", "confidence", "suggested_response")
    missing = [field for field in required if field not in payload]
    if missing:
        if settings.debug_openai_payload:
            logger.error(
                "Payload sem campos obrigatórios (%s): faltando %s | dump: %s",
                source,
                ", ".join(missing),
                _safe_dump(raw_response),
            )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resposta da OpenAI sem campos obrigatórios: {', '.join(missing)}",
        )
    if not isinstance(payload["suggested_response"], str) or not payload["suggested_response"].strip():
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resposta da OpenAI trouxe suggested_response vazio ou inválido.",
        )


def _normalize_confidence(value: Any) -> float:
    if not isinstance(value, (int, float)):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Resposta da OpenAI trouxe confidence inválido.",
        )
    return max(0.0, min(float(value), 1.0))


def _load_payload(raw_content: str) -> Dict[str, Any]:
    content = _strip_code_fence(raw_content)
    start = content.find("{")
    end = content.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = content[start : end + 1]
    else:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Resposta inesperada da OpenAI: {raw_content.strip()}",
        )

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


