import os
from langchain_openai import ChatOpenAI

# Load key from .env
if os.path.exists(".env"):
    with open(".env", "r") as f:
        for line in f:
            if line.startswith("GROQ_API_KEY="):
                os.environ["GROQ_API_KEY"] = line.split("=")[1].strip()

try:
    client = ChatOpenAI(
        api_key=os.environ.get("GROQ_API_KEY"),
        base_url="https://api.groq.com/openai/v1"
    )
    print("Groq Client configured successfully!")
except Exception as e:
    print("Error:", e)
