import os
import json
from app.graphs.prescription_graph import prescription_graph
from app.config import settings

def load_env():
    if not os.getenv("GROQ_API_KEY"):
        try:
            with open("../.env", "r") as f:
                for line in f:
                    if line.strip() and not line.startswith("#"):
                        key, val = line.strip().split("=", 1)
                        os.environ[key] = val
        except Exception:
            pass

load_env()
if os.getenv("GROQ_API_KEY"):
    settings.groq_api_key = os.getenv("GROQ_API_KEY")

def run_test():
    # Invoke the prescription graph
    state = {
        "photo_path": "test_image.jpeg",
        "filename": "WhatsApp Image 2026-07-17 at 13.06.57.jpeg",
        "existing_visits": [],
        "raw_extraction": {},
        "confidence_scores": {},
        "resolution": {},
        "needs_follow_up": False,
        "follow_up_question": "",
        "proposed_visit_id": None,
        "visit_link_confidence": 0.0,
        "needs_visit_link_resolution": True,
        "candidate_visits": []
    }
    
    print("Invoking prescription graph...")
    res = prescription_graph.invoke(state)
    
    print("\n--- PRESCRIPTION GRAPH OUTPUT ---")
    print(json.dumps(res, indent=2))

if __name__ == "__main__":
    run_test()
