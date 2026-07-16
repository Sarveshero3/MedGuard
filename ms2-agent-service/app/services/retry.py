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
                print(f"NVIDIA API invocation failed after {max_retries} attempts due to timeout: {e}", flush=True)
                raise
            print(f"NVIDIA API timeout on attempt {attempt+1}. Retrying in {delay} seconds...", flush=True)
            time.sleep(delay)
            delay *= 2
        except Exception as e:
            # Check for generic requests timeouts or HTTP timeout errors in string
            err_str = str(e).lower()
            if "timeout" in err_str or "timed out" in err_str or "408" in err_str:
                if attempt == max_retries - 1:
                    print(f"NVIDIA API invocation failed after {max_retries} attempts due to timeout: {e}", flush=True)
                    raise
                print(f"NVIDIA API timeout exception on attempt {attempt+1}. Retrying in {delay} seconds...", flush=True)
                time.sleep(delay)
                delay *= 2
            else:
                raise
