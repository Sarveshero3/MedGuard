"""
Application settings loaded from environment variables.
"""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """ms2-agent-service configuration."""

    ms2_port: int = 8000
    groq_api_key: str = ""
    tavily_api_key: str = Field(
        default="",
        validation_alias=AliasChoices("TAVILY_API_KEY", "TAVILY"),
    )
    ms1_base_url: str = "http://ms1-core-api:4000"
    log_level: str = "info"

    # Model configuration defaults (Groq)
    orchestrator_model: str = "llama-3.3-70b-versatile"
    vision_model: str = "qwen/qwen3.6-27b"
    disambiguation_model: str = "llama-3.1-8b-instant"
    # Brand resolution is safety-sensitive. Keep this decision separate from
    # general disambiguation so it cannot be silently downgraded for rate limits.
    brand_resolution_model: str = "llama-3.3-70b-versatile"

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
