from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    openai_api_key: Optional[str] = Field(None, alias="OPENAI_API_KEY")
    openai_model: str = Field("gpt-5-mini", alias="OPENAI_MODEL")
    openai_base_url: Optional[str] = Field(None, alias="OPENAI_BASE_URL")
    max_output_tokens: int = Field(1000, alias="OPENAI_MAX_OUTPUT_TOKENS")
    request_timeout: int = Field(60, alias="OPENAI_TIMEOUT_SECONDS")
    rate_limit_requests: int = Field(60, alias="RATE_LIMIT_REQUESTS")
    rate_limit_window_seconds: int = Field(60, alias="RATE_LIMIT_WINDOW_SECONDS")
    debug_openai_payload: bool = Field(False, alias="OPENAI_DEBUG_PAYLOAD")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    return Settings()


