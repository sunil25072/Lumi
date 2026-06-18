import os
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent / 'Backend' / '.env'
load_dotenv(dotenv_path=env_path)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

print("Available models:")
for m in genai.list_models():
    if 'generateContent' in m.supported_generation_methods:
        print(m.name)
