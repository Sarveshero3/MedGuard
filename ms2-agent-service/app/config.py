"""
Application settings loaded from environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """ms2-agent-service configuration."""

    ms2_port: int = 8000
    groq_api_key: str = ""
    ms1_base_url: str = "http://ms1-core-api:4000"
    log_level: str = "info"

    # Model configuration defaults (Groq)
    orchestrator_model: str = "llama-3.3-70b-versatile"
    vision_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    disambiguation_model: str = "qwen/qwen3-32b"

    class Config:
        env_file = (".env", "../.env")
        env_file_encoding = "utf-8"


settings = Settings()
