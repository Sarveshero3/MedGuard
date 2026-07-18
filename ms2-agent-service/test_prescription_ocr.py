import base64
import os
from app.services.client import get_client
from langchain_core.messages import HumanMessage, SystemMessage
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

def run_ocr():
    photo_path = "test_image.jpeg"
    with open(photo_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode("utf-8")

    ocr_client = get_client(settings.vision_model)
    ocr_response = ocr_client.invoke([
        SystemMessage(
            content="Perform raw character-level OCR on the uploaded document. Extract all text exactly as written, preserving layout if possible. Do not interpret or summarize."),
        HumanMessage(content=[
            {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_b64}"}}
        ])
    ])
    print("--- RAW OCR TEXT ---")
    print(ocr_response.content)

if __name__ == "__main__":
    run_ocr()
