import urllib.request
import urllib.parse
import json
import os

def run_tests():
    url = "http://localhost:8000/api/extract/resolve-brand"
    secret = os.getenv("MS2_INTERNAL_SECRET", "dev-secret")
    
    test_brands = ["Taxim-OF", "Zugut XT"]
    for brand in test_brands:
        print(f"Resolving brand: '{brand}'...")
        data = json.dumps({"brand_name": brand}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "x-internal-auth": secret
            }
        )
        try:
            res = urllib.request.urlopen(req, timeout=15.0)
            res_data = json.loads(res.read().decode("utf-8"))
            print(f"Result for '{brand}':")
            print(json.dumps(res_data, indent=2))
            print("-" * 40)
        except Exception as e:
            print(f"Error resolving '{brand}':", e)

if __name__ == "__main__":
    run_tests()
