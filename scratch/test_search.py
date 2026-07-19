import urllib.request
import urllib.parse
import re

def test_ddg_lite():
    query = "taxim o medicine generic name"
    url = "https://lite.duckduckgo.com/lite/"
    data = urllib.parse.urlencode({"q": query}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    )
    try:
        html = urllib.request.urlopen(req).read().decode('utf-8')
        print("DDG Lite HTML length:", len(html))
        
        # In DDG Lite, results are typically inside a table.
        # Let's find all text blocks between <tr> and </tr>
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.DOTALL)
        print("Row count:", len(rows))
        
        results = []
        for r in rows:
            # Check if this row contains a search result
            if "class=\"result-snippet\"" in r or "class='result-snippet'" in r or "class=result-snippet" in r:
                clean_r = re.sub(r'<[^>]+>', ' ', r)
                clean_r = re.sub(r'\s+', ' ', clean_r).strip()
                results.append(clean_r)
        
        print("Extracted results:")
        for idx, res in enumerate(results[:5]):
            print(f"Result {idx+1}: {res}")
            
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_ddg_lite()
