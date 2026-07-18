import urllib.request
import urllib.parse
import re

def test_google_search():
    query = "Zugut XT medicine active ingredient composition"
    url = "https://www.google.com/search?q=" + urllib.parse.quote(query)
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"}
    )
    try:
        with urllib.request.urlopen(req, timeout=5.0) as response:
            html = response.read().decode('utf-8')
        
        # Remove script and style tags
        html = re.sub(r'<script[^>]*>.*?</script>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<style[^>]*>.*?</style>', ' ', html, flags=re.DOTALL | re.IGNORECASE)
        # Strip HTML tags
        text = re.sub(r'<[^>]+>', ' ', html)
        # Clean up whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        print("Cleaned Text length:", len(text))
        print("First 1500 chars of cleaned text:")
        print(text[:1500])
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_google_search()
