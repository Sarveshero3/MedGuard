"""
Application settings loaded from environment variables.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """ms2-agent-service configuration."""

    ms2_port: int = 8000
    openai_api_key: str = ""
    ms1_base_url: str = "http://ms1-core-api:4000"
    log_level: str = "info"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
