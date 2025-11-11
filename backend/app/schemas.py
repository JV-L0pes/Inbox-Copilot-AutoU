from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class EmailCategory(str, Enum):
    productive = "Produtivo"
    unproductive = "Improdutivo"


class AnalysisPayload(BaseModel):
    text: str = Field(..., description="Conteúdo bruto do email a ser analisado.")


class OpenAIUsage(BaseModel):
    prompt_tokens: int = Field(0, alias="promptTokens")
    completion_tokens: int = Field(0, alias="completionTokens")
    total_tokens: int = Field(0, alias="totalTokens")

    model_config = ConfigDict(populate_by_name=True)


class EmailAnalysisResult(BaseModel):
    category: EmailCategory
    suggested_response: str
    confidence: float = Field(0.0, ge=0.0, le=1.0)
    highlights: Optional[List[str]] = None
    justification: Optional[str] = None
    usage: Optional[OpenAIUsage] = None
    raw_labels: Optional[List[str]] = None
    normalized_text: Optional[str] = None


class ErrorResponse(BaseModel):
    detail: str


