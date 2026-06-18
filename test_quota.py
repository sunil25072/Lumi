import os
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent / 'Backend' / '.env'
load_dotenv(dotenv_path=env_path)

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

candidate_models = [
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash'
]

print("Testing model quotas...")
for model_name in candidate_models:
    try:
        print(f"Testing {model_name}...")
        model = genai.GenerativeModel(model_name)
        response = model.generate_content("Say 'OK'")
        print(f"-> SUCCESS! {model_name} is active and working. Response: {response.text.strip()}")
        break
    except Exception as e:
        print(f"-> FAILED for {model_name}: {str(e)}")
