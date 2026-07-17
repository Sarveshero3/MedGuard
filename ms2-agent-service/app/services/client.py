from langchain_openai import ChatOpenAI
from app.config import settings


def get_client(model: str, temperature: float = 0.0) -> ChatOpenAI:
    """
    Returns a langchain-compatible ChatOpenAI client pointing to Groq's endpoint.
    """
    api_key = settings.groq_api_key or ""
    return ChatOpenAI(
        model=model,
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1",
        temperature=temperature
    )
