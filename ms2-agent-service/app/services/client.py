import os
import time
import logging
import threading
from typing import Any, List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.outputs import ChatResult
from app.config import settings

logger = logging.getLogger("ms2.client")

class KeyRotator:
    def __init__(self):
        self.lock = threading.Lock()
        self._keys: List[str] = []
        self._index = 0
        self._rate_limits = {} # key -> timestamp when it was rate limited
        self._initialized = False

    def initialize(self):
        with self.lock:
            if self._initialized:
                return
            
            keys = []
            # 1. Check settings.groq_api_key (which contains the comma-separated list)
            if settings.groq_api_key:
                keys = [k.strip() for k in settings.groq_api_key.split(",") if k.strip()]

            # 2. Fallback to parsing raw .env file directly if keys were pasted as multi-line
            if not keys:
                try:
                    env_paths = [".env", "../.env", "/app/.env"]
                    for path in env_paths:
                        if os.path.exists(path):
                            with open(path, "r") as f:
                                lines = f.readlines()
                            raw_keys = []
                            in_groq = False
                            for line in lines:
                                line = line.strip()
                                if line.startswith("GROQ_API_KEY="):
                                    val = line.split("=", 1)[1].strip()
                                    if val:
                                        raw_keys.extend([k.strip() for k in val.split(",") if k.strip()])
                                    in_groq = True
                                elif in_groq and line.startswith("gsk_"):
                                    raw_keys.append(line)
                                elif line and not line.startswith("#"):
                                    in_groq = False
                            if raw_keys:
                                keys = raw_keys
                                break
                except Exception as e:
                    logger.warning(f"Failed to parse raw .env file for keys: {e}")

            # Dedup keys while preserving order
            seen = set()
            self._keys = [k for k in keys if not (k in seen or seen.add(k))]
            self._initialized = True
            logger.info(f"KeyRotator initialized with {len(self._keys)} Groq API keys: {[k[-6:] for k in self._keys]}")

    def get_next_key(self) -> str:
        if not self._initialized:
            self.initialize()
            
        with self.lock:
            if not self._keys:
                return ""
            
            now = time.time()
            # Filter out keys that are currently cooling down from a 429 (cool down for 60 seconds)
            available_keys = [
                k for k in self._keys 
                if k not in self._rate_limits or now - self._rate_limits[k] > 60
            ]
            
            if not available_keys:
                # If all keys are rate limited, fallback to all keys to keep trying
                available_keys = self._keys

            # Rotate index
            key = available_keys[self._index % len(available_keys)]
            self._index += 1
            return key

    def mark_rate_limited(self, key: str):
        with self.lock:
            self._rate_limits[key] = time.time()
            logger.warning(f"Groq API key ...{key[-6:] if len(key) > 6 else key} marked as rate-limited.")

rotator = KeyRotator()

class RateResilientChatOpenAI(ChatOpenAI):
    """
    Custom ChatOpenAI model wrapper that dynamically rotates Groq API keys
    and retries on RateLimitError (429).
    """

    def _generate(self, messages: Any, stop: Optional[List[str]] = None, run_manager: Optional[Any] = None, **kwargs: Any) -> ChatResult:
        attempts = max(3, len(rotator._keys))
        last_exception = None
        for attempt in range(attempts):
            key = rotator.get_next_key()
            logger.info(f"Attempting sync request with Groq key ending in ...{key[-6:] if key else ''}")
            
            # Rebuild a temporary client instance to completely bypass OpenAI/HTTPX SDK client caching
            temp_client = ChatOpenAI(
                model=self.model,
                api_key=key,
                base_url=self.openai_api_base or "https://api.groq.com/openai/v1",
                temperature=self.temperature,
                model_kwargs=self.model_kwargs,
            )
            try:
                return temp_client._generate(messages, stop=stop, run_manager=run_manager, **kwargs)
            except Exception as e:
                last_exception = e
                err_msg = str(e).lower()
                if "rate_limit_exceeded" in err_msg or "429" in err_msg or "rate limit" in err_msg:
                    rotator.mark_rate_limited(key)
                    continue
                raise e
        if last_exception:
            raise last_exception
        raise RuntimeError("All API key rotation attempts failed.")

    async def _agenerate(self, messages: Any, stop: Optional[List[str]] = None, run_manager: Optional[Any] = None, **kwargs: Any) -> ChatResult:
        attempts = max(3, len(rotator._keys))
        last_exception = None
        for attempt in range(attempts):
            key = rotator.get_next_key()
            logger.info(f"Attempting async request with Groq key ending in ...{key[-6:] if key else ''}")
            
            # Rebuild a temporary client instance to completely bypass OpenAI/HTTPX SDK client caching
            temp_client = ChatOpenAI(
                model=self.model,
                api_key=key,
                base_url=self.openai_api_base or "https://api.groq.com/openai/v1",
                temperature=self.temperature,
                model_kwargs=self.model_kwargs,
            )
            try:
                return await temp_client._agenerate(messages, stop=stop, run_manager=run_manager, **kwargs)
            except Exception as e:
                last_exception = e
                err_msg = str(e).lower()
                if "rate_limit_exceeded" in err_msg or "429" in err_msg or "rate limit" in err_msg:
                    rotator.mark_rate_limited(key)
                    continue
                raise e
        if last_exception:
            raise last_exception
        raise RuntimeError("All API key rotation attempts failed.")

def get_client(model: str, temperature: float = 0.0) -> ChatOpenAI:
    """
    Returns a rate-resilient, langchain-compatible ChatOpenAI client pointing to Groq's endpoint.
    """
    # Initialize rotator at first client fetch
    rotator.initialize()
    
    initial_key = rotator.get_next_key()
    return RateResilientChatOpenAI(
        model=model,
        api_key=initial_key,
        base_url="https://api.groq.com/openai/v1",
        temperature=temperature
    )
