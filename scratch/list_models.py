import os
from langchain_nvidia_ai_endpoints import ChatNVIDIA

# Load key from .env
env_lines = []
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("NVIDIA_API_KEY="):
                os.environ["NVIDIA_API_KEY"] = line.split("=")[1].strip()

try:
    client = ChatNVIDIA()
    models = client.available_models
    print("Found models:")
    for m in sorted(list(models)):
        print("-", m.id)
except Exception as e:
    print("Error listing models:", e)
