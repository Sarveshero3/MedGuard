import time
from requests.exceptions import ReadTimeout, ConnectTimeout

def invoke_with_retry(client, messages, max_retries=3, initial_delay=2):
    """
    Invokes client.invoke() with exponential backoff retries for transient timeouts.
    """
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            return client.invoke(messages)
        except (ReadTimeout, ConnectTimeout) as e:
            if attempt == max_retries - 1:
                print(f"Groq API invocation failed after {max_retries} attempts due to timeout: {e}", flush=True)
                raise
            print(f"Groq API timeout on attempt {attempt+1}. Retrying in {delay} seconds...", flush=True)
            time.sleep(delay)
            delay *= 2
        except Exception as e:
            err_str = str(e).lower()
            # Handle Rate Limiting (HTTP 429)
            if "rate_limit" in err_str or "rate limit" in err_str or "429" in err_str or "too many requests" in err_str:
                if attempt == max_retries - 1:
                    print(f"Groq API invocation failed after {max_retries} attempts due to rate limit: {e}", flush=True)
                    raise
                rate_limit_delay = delay + 5
                print(f"Groq API rate limit detected on attempt {attempt+1}. Retrying in {rate_limit_delay} seconds...", flush=True)
                time.sleep(rate_limit_delay)
                delay *= 2
            # Handle Timeout (HTTP 408 / Timeout)
            elif "timeout" in err_str or "timed out" in err_str or "408" in err_str:
                if attempt == max_retries - 1:
                    print(f"Groq API invocation failed after {max_retries} attempts due to timeout: {e}", flush=True)
                    raise
                print(f"Groq API timeout exception on attempt {attempt+1}. Retrying in {delay} seconds...", flush=True)
                time.sleep(delay)
                delay *= 2
            else:
                raise
