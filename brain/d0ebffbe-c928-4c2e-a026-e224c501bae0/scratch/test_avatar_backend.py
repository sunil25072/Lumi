import requests
import urllib.parse
import time

prompt = "Cinematic 3D render portrait of a determined male developer, Pixar 3D style, cute clay animation, rich volumetric lighting, cyberpunk background, Solar Orange glowing coffee mug."
encoded_prompt = urllib.parse.quote(prompt)

url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&seed=42"
print("\n--- Testing free parameters ---")
print("URL:", url)
start_time = time.time()
try:
    response = requests.get(url, timeout=35)
    duration = time.time() - start_time
    print("Status Code:", response.status_code)
    print("Content Type:", response.headers.get("Content-Type"))
    print(f"Time Taken: {duration:.2f} seconds")
    print("Length:", len(response.content) if response.content else 0)
except Exception as e:
    print("Error:", e)
