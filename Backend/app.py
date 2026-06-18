import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import openai

load_dotenv(override=True)

from flask import Flask, request, jsonify, send_from_directory

# Configure static folder to be the project root so we can serve index.html and Pages
app = Flask(__name__, static_folder='../', static_url_path='')
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/api/templates/<filename>')
def serve_template(filename):
    src_dir = r"C:\Users\SunilKumarKethananei\.gemini\antigravity\brain\d0ebffbe-c928-4c2e-a026-e224c501bae0"
    mapping = {
        "cyberpunk.png": "cyberpunk_template_1779184729359.png",
        "pixar.png": "pixar_template_1779184747687.png",
        "fantasy.png": "fantasy_template_1779184767351.png",
        "astronaut.png": "astronaut_template_1779184786109.png"
    }
    real_name = mapping.get(filename)
    if not real_name or not os.path.exists(src_dir):
        return jsonify({"error": "Template not found"}), 404
    return send_from_directory(src_dir, real_name)

@app.route('/')
def serve_index():
    import sys
    sys.stderr.write(f"\n[DEBUG] Serving index.html from {app.static_folder}\n")
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/resume')
def serve_resume():
    import sys
    sys.stderr.write(f"\n[DEBUG] Serving resume.html from {app.static_folder}\n")
    return send_from_directory(app.static_folder, 'resume.html')

@app.route('/analytics')
def serve_analytics():
    import sys
    sys.stderr.write(f"\n[DEBUG] Serving analytics.html from {app.static_folder}\n")
    return send_from_directory(app.static_folder, 'analytics.html')

@app.route('/avatar')
def serve_avatar():
    import sys
    sys.stderr.write(f"\n[DEBUG] Serving avatar.html from {app.static_folder}\n")
    return send_from_directory(app.static_folder, 'avatar.html')


@app.route('/Pages/<path:path>')
def serve_pages(path):
    import sys
    sys.stderr.write(f"\n[DEBUG] Serving static file: Pages/{path}\n")
    return send_from_directory(os.path.join(app.static_folder, 'Pages'), path)

# Initialize OpenAI client with Groq API key
@app.route('/api/chat', methods=['POST'])
def chat():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "Backend not configured with a valid Gemini API key"}), 500

    try:
        data = request.get_json(silent=True) or {}
        # Debug logging
        import sys
        sys.stderr.write(f"\n[DEBUG] Received chat request: {data}\n")
        user_message = data.get("message")
        history = data.get("history", [])
        
        if not user_message:
            return jsonify({"error": "No message provided"}), 400
        
        # Knowledge base for recent events (2024-2026)
        recent_knowledge = (
            "KNOWLEDGE BASE (2024-2026):\n"
            "- 2024: Over 70 countries held elections (Donald Trump won US, UK Labour govt, Mexico first female president). Paris Olympics held.\n"
            "- 2025: Global trade tariffs escalation. 'Twelve-Day War' in June (Israel-Iran). Pope Leo XIV elected.\n"
            "- 2026: Currently 2026. Winter Olympics in Milan/Cortina. FIFA World Cup across North America. USA celebrating 250th anniversary. NASA Artemis II mission ongoing.\n\n"
        )
        
        system_instruction = (
            "You are Lumi, a helpful, friendly, and concise AI assistant. "
            "You provide clear answers and maintain a professional yet warm tone. "
            f"\n\n{recent_knowledge}"
            "Your goal is to be the best AI companion for the user."
        )

        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest', system_instruction=system_instruction)

        # Build contents list for Gemini
        contents = []
        last_role = None
        
        for h in history:
            role = "model" if h["role"] == "ai" else "user"
            if role != last_role:
                contents.append({"role": role, "parts": [h["text"]]})
                last_role = role
        
        # Add current message
        if last_role == "user":
            # Gemini requires alternating roles; if history ended with user, append to the last message
            contents[-1]["parts"][0] += f"\n\n{user_message}"
        else:
            contents.append({"role": "user", "parts": [user_message]})

        response = model.generate_content(contents)
        
        reply_text = response.text.strip()
        if not reply_text:
            reply_text = "Hello! How can I assist you today?"
        
        return jsonify({
            "reply": reply_text,
            "status": "success"
        })
        
    except Exception as e:
        import traceback, sys
        error_details = traceback.format_exc()
        sys.stderr.write(f"\n!!! BACKEND ERROR !!!\n{error_details}\n")
        err_msg = str(e)
        if "rate_limit_exceeded" in err_msg.lower() or "429" in err_msg or "quota" in err_msg.lower():
            err_msg = "Lumi is currently thinking too fast! You've hit the Gemini Free Tier limit (5 requests per minute). Please wait about 60 seconds before sending another message."
        return jsonify({"error": err_msg, "status": "error"}), 500

@app.route('/api/tts', methods=['POST'])
def tts():
    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        return jsonify({"error": "ElevenLabs API key not found"}), 500
    
    data = request.json
    text = data.get("text")
    if not text:
        return jsonify({"error": "No text provided"}), 400

    # Bella voice ID (Usually allowed on free tier)
    url = "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL"
    headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": api_key
    }
    payload = {
        "text": text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {"stability": 0.5, "similarity_boost": 0.5}
    }

    import requests
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        return response.content, 200, {'Content-Type': 'audio/mpeg'}
    else:
        return jsonify({"error": "TTS failed"}), response.status_code

@app.route('/api/stt', methods=['POST'])
def stt():
    api_key = os.getenv("DEEPGRAM_API_KEY")
    if not api_key:
        return jsonify({"error": "Deepgram API key not found"}), 500
    
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file"}), 400
    
    audio_file = request.files['audio']
    url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true"
    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": audio_file.content_type
    }

    import requests
    response = requests.post(url, data=audio_file.read(), headers=headers)
    if response.status_code == 200:
        data = response.json()
        transcript = data['results']['channels'][0]['alternatives'][0]['transcript']
        return jsonify({"transcript": transcript})
    else:
        return jsonify({"error": "STT failed"}), response.status_code

@app.route('/api/analyze-image', methods=['POST'])
def analyze_image():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key.startswith("gsk_"):
        return jsonify({"error": "A valid Gemini API key is required for image analysis. Please add a real GEMINI_API_KEY (starts with AIza) to your .env file."}), 500
    
    if 'image' not in request.files:
        return jsonify({"error": "No image file"}), 400
    
    image_file = request.files['image']
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        # Read image data
        image_data = image_file.read()
        contents = [
            "Describe this image in detail for a chat assistant.",
            {"mime_type": image_file.content_type, "data": image_data}
        ]
        
        response = model.generate_content(contents)
        return jsonify({"description": response.text})
        
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Gemini Vision failed: {str(e)}\n")
        return jsonify({"error": "Image analysis failed", "details": str(e)}), 500

@app.route('/api/score-resume', methods=['POST'])
def score_resume():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "A valid Gemini API key is required. Please check your .env file."}), 500
    
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided"}), 400
    
    resume_file = request.files['resume']
    filename = resume_file.filename
    if not filename:
        return jsonify({"error": "Invalid resume filename"}), 400
        
    ext = filename.split('.')[-1].lower()
    if ext not in ['pdf', 'txt']:
        return jsonify({"error": "Unsupported file format. Please upload PDF or TXT."}), 400
        
    # Extract text from file
    resume_text = ""
    try:
        if ext == 'pdf':
            import pypdf
            reader = pypdf.PdfReader(resume_file)
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    resume_text += page_text + "\n"
        else:
            resume_text = resume_file.read().decode('utf-8', errors='ignore')
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] File extraction failed: {str(e)}\n")
        return jsonify({"error": "Failed to extract text from resume", "details": str(e)}), 500
        
    if not resume_text.strip():
        return jsonify({"error": "The uploaded resume file seems to be empty or unreadable."}), 400
        
    # Optional job description
    job_description = request.form.get('job_description', '').strip()
    
    # Prompt engineering for strict scoring and JSON generation
    prompt = f"""
You are an expert resume reviewer and ATS (Applicant Tracking System) optimizer. Analyze the following resume content and optionally the job description provided.
Your job is to perform a highly rigorous and professional assessment of the resume, scoring it across multiple dimensions (out of 100), identifying critical gaps, finding missing keywords, and providing specific suggestions for rewriting task descriptions into quantitative accomplishments.

Resume Text:
---
{resume_text}
---

{"Job Description (Optimize for this role):" if job_description else ""}
{f"---" if job_description else ""}
{job_description if job_description else ""}
{f"---" if job_description else ""}

You MUST return a raw JSON object matching the following structure exactly. Do not include markdown code block syntax (like ```json ... ```), return ONLY the raw JSON string.

JSON Schema:
{{
  "overall_score": <integer from 0 to 100 representing overall quality>,
  "formatting_score": <integer from 0 to 100 based on standard section presence, clarity>,
  "keyword_score": <integer from 0 to 100 based on core industry skills present>,
  "skills_score": <integer from 0 to 100 representing technical/soft skill presence>,
  "impact_score": <integer from 0 to 100 based on presence of metric-driven accomplishments>,
  "rating": "<one of: 'Excellent' (85+), 'Good' (70-84), 'Fair' (50-69), 'Poor' (under 50)>",
  "executive_summary": "<A professional 3-4 sentence evaluation highlighting what works well and the single biggest opportunity area.>",
  "strengths": [
    "<specific strength point 1>",
    "<specific strength point 2>",
    ... (maximum 4 strengths)
  ],
  "improvements": [
    "<specific improvement suggestion 1>",
    "<specific improvement suggestion 2>",
    ... (maximum 4 improvements)
  ],
  "found_keywords": [
    "<keyword detected in resume 1>",
    "<keyword detected in resume 2>",
    ... (up to 15 core technical or role-specific skills found)
  ],
  "missing_keywords": [
    "<relevant industry or job-matching keyword missing 1>",
    "<relevant industry or job-matching keyword missing 2>",
    ... (up to 10 key skills they should add)
  ],
  "bullet_suggestions": [
    {{
      "original": "<A generic, non-metric experience line found in their resume (or a generic task-based line)>",
      "enhanced": "<A highly optimized, metric-driven, action-oriented rewritten version of that bullet>",
      "impact": "<A short 3-5 word label summarizing the business impact or metric highlighted>"
    }},
    ... (provide exactly 3 bullet enhancements)
  ],
  "formatting_insights": [
    {{
      "category": "Font Readability",
      "status": "<'success', 'warning', or 'danger'>",
      "message": "<a feedback message about their text/style parsability>"
    }},
    {{
      "category": "Document Length",
      "status": "<'success', 'warning', or 'danger'>",
      "message": "<assess length based on word count/density>"
    }},
    {{
      "category": "Contact Details",
      "status": "<'success', 'warning', or 'danger'>",
      "message": "<check for presence of email, phone, location, and social profiles>"
    }},
    {{
      "category": "Section Headings",
      "status": "<'success', 'warning', or 'danger'>",
      "message": "<check if standard section headers are standard and easily parsable>"
    }}
  ]
  {f', "jd_alignment": {{ "score": <integer from 0 to 100 representing how well the skills match the job description>, "description": "<A clear summary of their fit and specific technology alignment for the target job description.>" }}' if job_description else ""}
}}

Ensure all scores are mathematically logical (overall_score should roughly average the sub-scores). Provide realistic, high-value, role-specific content. Do not use generic placeholders. Keep it highly tailored to the text in their resume.
"""

    try:
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        # Call Gemini and request JSON format
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        result_json = json.loads(result_text)
        return jsonify(result_json)
        
    except json.JSONDecodeError as je:
        import sys
        sys.stderr.write(f"\n[ERROR] JSON Decode Error from Gemini: {str(je)}\nResponse text:\n{response.text}\n")
        return jsonify({"error": "Failed to parse AI output. Please try again."}), 500
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Gemini analysis failed: {str(e)}\n")
        return jsonify({"error": "AI Resume scoring service encountered an error.", "details": str(e)}), 500


@app.route('/api/analyze-data', methods=['POST'])
def analyze_data():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "A valid Gemini API key is required. Please check your .env file."}), 500
    
    try:
        data = request.get_json(silent=True) or {}
        filename = data.get("filename", "Dataset")
        row_count = data.get("rowCount", 0)
        col_count = data.get("columnCount", 0)
        schema = data.get("schema", {})
        stats = data.get("stats", [])
        sample = data.get("sample", [])
        
        # Build prompt
        prompt = f"""
You are an advanced AI Data Analyst and Business Intelligence Expert. Your role is to examine the provided dataset statistics and representative records, automatically perform cognitive analysis, compute meaningful KPI metrics, structure relevant visual charts, outline high-impact observations (insights), forecast trends, and write a thorough strategic markdown report.

Dataset Telemetry:
- File Name: {filename}
- Row Count: {row_count}
- Column Count: {col_count}
- Schema Definition: {schema}
- Descriptive Statistics (Aggregates): {stats}
- Sample Records (First 100 rows): {sample}

Your analysis MUST address the exact telemetry and specific columns of this dataset.
Choose the most logical columns for calculations and visualizations (e.g., plot values over dates for Line charts, compare categories for Bar charts, show distributions/shares for Pie/Doughnut charts, assess multiple dimensions for Radar charts). Ensure any numerical labels/coordinates correspond to realistic findings.

You MUST return a raw JSON object matching the following structure exactly. Do not include markdown code block formatting (like ```json ... ```), return ONLY the raw JSON string.

JSON Schema:
{{
  "kpi_metrics": [
    {{
      "label": "<a short 2-3 word name of a major calculated KPI, e.g. 'Gross Margin' or 'Conversion Rate'>",
      "value": "<the calculated value formatted nicely, e.g. '$12,450' or '84.2%'>",
      "change": "<percentage change relative to context, e.g., '+12.4%' or '-2.1%'>",
      "positive": <true if the change is a favorable trend (like rising sales or falling cost), false otherwise>,
      "context": "<a short 2-4 word temporal/logical context, e.g. 'vs last month' or 'Avg per user'>"
    }}
    // Provide exactly 4 distinct, highly relevant KPIs based on the numeric or text fields.
  ],
  "charts": [
    {{
      "type": "<one of: 'line', 'bar', 'doughnut', 'radar'>",
      "title": "<Visual graph title describing correlation or trend>",
      "labels": [
        "<label 1>",
        "<label 2>",
        ... (maximum 10 key categories or date buckets to avoid visual clutter)
      ],
      "datasets": [
        {{
          "label": "<name of target metric, e.g. 'Sales (USD)' or 'active_users'>",
          "data": [
            <numeric coordinate 1 corresponding to label 1>,
            <numeric coordinate 2 corresponding to label 2>,
            ...
          ]
        }}
        // You may include up to 2 datasets for 'line' or 'bar' charts (e.g. comparative metrics). Include 1 dataset for 'doughnut' or 'radar'.
      ]
    }}
    // Provide exactly 3 or 4 custom configured charts that best fit the data fields.
  ],
  "insights": [
    {{
      "category": "<one of: 'success', 'warning', 'danger', 'info'>",
      "level": "<one of: 'success', 'warning', 'danger', 'info'>",
      "title": "<High impact observation title>",
      "description": "<A detailed explanation outlining the metric, why it happened, and its business implications. Keep it specific to their data columns.>"
    }}
    // Provide exactly 4 distinct observations mapping to the categories.
  ],
  "trends": [
    {{
      "title": "<Trend name>",
      "impact": "<one of: 'positive', 'negative', 'neutral'>",
      "description": "<A thorough forecasting projection or anomaly statement detailing Q2 expectations, season effects, or pipeline expansions.>"
    }}
    // Provide exactly 3 key trend forecasts.
  ],
  "executive_summary": "<A full, professional C-suite strategic report in markdown format. Use hierarchical headers (#, ##, ###), bold text, standard bullet points, and blockquotes strategically. Organize into sections: (1) Strategic Overview, (2) Deep-Dive Findings & Aggregates, (3) Tactical Risks & Bottlenecks, and (4) Strategic Recommendations. Ensure it is highly detailed, rich, and tailored precisely to the data.>"
}}
"""
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        result_json = json.loads(result_text)
        return jsonify(result_json)
        
    except json.JSONDecodeError as je:
        import sys
        sys.stderr.write(f"\n[ERROR] JSON Decode Error from Gemini: {str(je)}\nResponse text:\n{response.text}\n")
        return jsonify({"error": "Failed to parse AI output. Please try again."}), 500
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Gemini Data analysis failed: {str(e)}\n")
        return jsonify({"error": "AI data analysis service encountered an error.", "details": str(e)}), 500


@app.route('/api/enhance-prompt', methods=['POST'])
def enhance_prompt():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "A valid Gemini API key is required."}), 500
    
    try:
        data = request.get_json(silent=True) or {}
        description = data.get("description", "")
        
        # Build prompt for general picture prompt enhancement
        prompt = f"""
You are an expert AI Prompt Engineer and Digital Art Director. Your goal is to take a user's basic image description and expand it into 3 highly creative, rich, and detailed visual art prompts suitable for text-to-image generator models (like Stable Diffusion / Midjourney).

User Description: {description}

For each of the 3 concept prompts, you should:
- Maintain the core subject and ideas that the user described.
- Expand it with spectacular atmospheric details, artistic environments, visual elements, and textures.
- Suggest premium photography/artistic components like lighting specs (e.g. 'volumetric atmospheric lighting', 'dramatic golden hour glow', 'cinematic soft focus'), camera settings (e.g. 'shot on 85mm lens, f/1.4, sharp focus'), visual styles (e.g. 'cinematic 3D render', 'high-fidelity oil painting', 'isometric vector graphic'), rendering coordinates (e.g., 'rendered in Octane, 8k resolution, hyper-detailed digital art').
- Keep each expanded prompt around 50-80 words, rich, evocative, and purely descriptive.

You MUST return a raw JSON object matching the following structure exactly. Do not include markdown code block formatting (like ```json ... ```), return ONLY the raw JSON string.

JSON Schema:
{{
  "concepts": [
    {{
      "title": "<A short creative concept title, e.g. 'Hyper-Realistic Cyberpunk' or 'Atmospheric Dreamscape'>",
      "expanded_prompt": "<The fully constructed, ultra-detailed image generation prompt.>"
    }},
    {{
      "title": "<A second distinct visual concept title>",
      "expanded_prompt": "<A second fully expanded prompt offering a different background, artistic medium, or visual composition.>"
    }},
    {{
      "title": "<A third distinct visual concept title>",
      "expanded_prompt": "<A third fully expanded prompt offering another creative variation.>"
    }}
  ]
}}
"""
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        result_json = json.loads(result_text)
        return jsonify(result_json)
        
    except json.JSONDecodeError as je:
        import sys
        sys.stderr.write(f"\n[ERROR] JSON Decode Error from Gemini in enhance-prompt: {str(je)}\nResponse text:\n{response.text}\n")
        return jsonify({"error": "Failed to parse AI output. Please try again."}), 500
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Gemini prompt enhancement failed: {str(e)}\n")
        return jsonify({"error": "AI prompt service encountered an error.", "details": str(e)}), 500


@app.route('/api/blend-avatar', methods=['POST'])
def blend_avatar():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "A valid Gemini API key is required."}), 500
    
    if 'identity' not in request.files:
        return jsonify({"error": "Identity photo is required."}), 400
        
    identity_file = request.files['identity']
    preset = request.form.get('preset', 'anime')
    
    # Map preset to style template file
    mapping = {
        "anime": "cyberpunk_template_1779184729359.png",
        "pixar": "pixar_template_1779184747687.png",
        "scifi": "astronaut_template_1779184786109.png",
        "fantasy": "fantasy_template_1779184767351.png"
    }
    
    template_filename = mapping.get(preset, "cyberpunk_template_1779184729359.png")
    src_dir = r"C:\Users\SunilKumarKethananei\.gemini\antigravity\brain\d0ebffbe-c928-4c2e-a026-e224c501bae0"
    template_path = os.path.join(src_dir, template_filename)
    
    try:
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        # Using gemini-flash-latest which has amazing multimodal properties
        model = genai.GenerativeModel('gemini-flash-latest')
        
        identity_data = identity_file.read()
        
        # Load the selected template style image
        with open(template_path, 'rb') as f:
            style_data = f.read()
        
        system_instruction = """
You are an advanced AI avatar generation director. Your task is to analyze two input images:
1. Identity Reference: The user's uploaded portrait photo.
2. Style Reference: The template artistic style image.

Your goal is to write a single, highly-detailed, professional-level image generation prompt that blends these two perfectly.

STRICT REQUIREMENTS:
- Preserve the user's facial identity, face structure, eyes, hairstyle, and overall likeness from the Identity Reference.
- The final image description must describe the same person from the uploaded photo.
- Apply the artistic style, colors, lighting, outfit inspiration, mood, and visual aesthetics from the Style Reference.
- Blend the template style naturally with the user's appearance.
- Maintain realistic facial consistency and symmetry.
- Keep high-quality skin details and sharp facial features.
- Match the pose and composition style when possible.
- Avoid changing gender, age, or core facial identity.
- Produce cinematic, highly detailed, professional-quality output.
- Ultra realistic, 4K quality, clean background, studio-quality lighting.

Return a raw JSON object with the following schema:
{
  "concepts": [
    {
      "title": "Stylized Identity Blend",
      "expanded_prompt": "<The constructed image generation prompt containing style keywords, lighting specs, background details, accent colors, and character features.>"
    }
  ]
}
"""
        
        contents = [
            system_instruction,
            {"mime_type": identity_file.content_type, "data": identity_data},
            {"mime_type": "image/png", "data": style_data}
        ]
        
        response = model.generate_content(
            contents,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        result_json = json.loads(result_text)
        return jsonify(result_json)
        
    except json.JSONDecodeError as je:
        import sys
        sys.stderr.write(f"\n[ERROR] JSON Decode Error from Gemini in blend-avatar: {str(je)}\nResponse text:\n{response.text}\n")
        return jsonify({"error": "Failed to parse AI output. Please try again."}), 500
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Gemini blend-avatar failed: {str(e)}\n")
        return jsonify({"error": "AI avatar blending service encountered an error.", "details": str(e)}), 500


def generate_fallback_svg(preset, gender, color_theme, emotion):
    # Map colors
    c_primary = "#6366F1"
    c_secondary = "#A855F7"
    
    if "Purple" in color_theme or "Magenta" in color_theme:
        c_primary = "#A855F7"
        c_secondary = "#EC4899"
    elif "Green" in color_theme or "Teal" in color_theme:
        c_primary = "#10B981"
        c_secondary = "#06B6D4"
    elif "Orange" in color_theme or "Crimson" in color_theme:
        c_primary = "#F59E0B"
        c_secondary = "#EF4444"
    elif "Blue" in color_theme or "Cosmic" in color_theme:
        c_primary = "#3B82F6"
        c_secondary = "#6366F1"

    svg = f"""<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
            <stop offset="0%" stop-color="#111326" />
            <stop offset="100%" stop-color="#05060b" />
        </radialGradient>
        <radialGradient id="glow-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="{c_primary}" stop-opacity="0.45" />
            <stop offset="100%" stop-color="{c_primary}" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="primary-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="{c_primary}" />
            <stop offset="100%" stop-color="{c_secondary}" />
        </linearGradient>
        <linearGradient id="sun-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#FFD700" />
            <stop offset="100%" stop-color="#FF4500" />
        </linearGradient>
    </defs>
    
    <!-- Background backdrop -->
    <rect width="512" height="512" fill="url(#bg-grad)" />
    <circle cx="256" cy="230" r="180" fill="url(#glow-grad)" />
    
    <!-- Radar concentric interface -->
    <circle cx="256" cy="230" r="190" fill="none" stroke="url(#primary-grad)" stroke-width="2" stroke-dasharray="80,40" opacity="0.6"/>
    <circle cx="256" cy="230" r="200" fill="none" stroke="{c_secondary}" stroke-width="1" stroke-dasharray="10,20" opacity="0.4"/>
    
    <!-- Glowing Sun / Portal Centerpiece -->
    <circle cx="256" cy="210" r="70" fill="url(#sun-grad)" opacity="0.85" filter="drop-shadow(0 0 15px rgba(255,69,0,0.5))" />
    
    <!-- Abstract Cyberpunk Mountains / Polygonal Peaks inside portal -->
    <polygon points="120,330 200,220 280,330" fill="#1E1B4B" opacity="0.9" stroke="{c_primary}" stroke-width="2" />
    <polygon points="230,330 310,180 390,330" fill="#111827" opacity="0.95" stroke="{c_secondary}" stroke-width="2" />
    <polygon points="170,330 256,240 340,330" fill="#312E81" opacity="0.8" />
    
    <!-- Grid overlay lines at the base -->
    <line x1="100" y1="330" x2="412" y2="330" stroke="url(#primary-grad)" stroke-width="3" opacity="0.8" />
    <line x1="120" y1="345" x2="392" y2="345" stroke="{c_secondary}" stroke-width="2" opacity="0.6" />
    <line x1="150" y1="360" x2="362" y2="360" stroke="{c_primary}" stroke-width="1" opacity="0.4" />
    
    <!-- Stars and sparkle particles -->
    <circle cx="180" cy="120" r="2" fill="#FFF" opacity="0.8" />
    <circle cx="340" cy="100" r="3" fill="#FFF" opacity="0.9" />
    <circle cx="150" cy="190" r="1.5" fill="#FFF" opacity="0.5" />
    <circle cx="370" cy="180" r="2" fill="#FFF" opacity="0.7" />
    <circle cx="280" cy="90" r="1" fill="#FFF" opacity="0.4" />
    
    <!-- Meta details labels -->
    <text x="256" y="425" text-anchor="middle" fill="#FFFFFF" font-family="'Outfit', sans-serif" font-weight="800" font-size="20" letter-spacing="6" opacity="0.95">LUMI IMAGE FORGE</text>
    <text x="256" y="455" text-anchor="middle" fill="{c_primary}" font-family="'Inter', sans-serif" font-weight="600" font-size="11" letter-spacing="3" opacity="0.8">CREATIVE MASTERPIECE VIRTUAL VECTOR</text>
    </svg>
    """
    return svg
    # Legacy code cleaned up. Vector fallback is fully updated.


@app.route('/api/proxy-avatar-image')
def proxy_avatar_image():
    prompt = request.args.get('prompt')
    download = request.args.get('download', 'false').lower() == 'true'
    if not prompt:
        return jsonify({"error": "No prompt provided"}), 400
        
    try:
        import requests
        import urllib.parse
        import io
        import time
        import random
        from flask import send_file
        
        encoded_prompt = urllib.parse.quote(prompt)
        seed = request.args.get('seed')
        if not seed:
            seed = str(random.randint(1, 100000))
            
        # Target the SANA model explicitly which is free, healthy and generates breathtaking 3D humanoid graphics
        url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=512&height=512&nologo=true&private=true&enhance=false&seed={seed}&model=sana"
        
        import sys
        sys.stderr.write(f"\n[DEBUG] Proxying Pollinations AI image request for prompt: {prompt[:50]}...\n")
        
        # We increase the timeout to 35 seconds to let the model generate the photorealistic 3D human bust completely
        response = requests.get(url, timeout=35)
        if response.status_code == 200:
            if download:
                return send_file(
                    io.BytesIO(response.content),
                    mimetype='image/png',
                    as_attachment=True,
                    download_name=f"Lumi_AI_Avatar_{int(time.time())}.png"
                )
            else:
                return send_file(
                    io.BytesIO(response.content),
                    mimetype='image/jpeg'
                )
        else:
            raise Exception(f"Pollinations returned status: {response.status_code}")
            
    except Exception as e:
        import sys
        import io
        import time
        from flask import send_file
        sys.stderr.write(f"\n[WARNING] Generator service slow/offline. Triggering dynamic vector fallback: {str(e)}\n")
        
        # Retrieve context parameters
        preset = request.args.get('preset', 'vector')
        gender = request.args.get('gender', 'profile')
        color = request.args.get('color', 'Teal')
        emotion = request.args.get('emotion', 'Determined')
        
        svg_content = generate_fallback_svg(preset, gender, color, emotion)
        
        if download:
            return send_file(
                io.BytesIO(svg_content.encode('utf-8')),
                mimetype='image/svg+xml',
                as_attachment=True,
                download_name=f"Lumi_AI_Avatar_{int(time.time())}.svg"
            )
        else:
            return send_file(
                io.BytesIO(svg_content.encode('utf-8')),
                mimetype='image/svg+xml'
            )


@app.route('/games')
def serve_games():
    import sys
    sys.stderr.write(f"\n[DEBUG] Serving games.html from {app.static_folder}\n")
    return send_from_directory(app.static_folder, 'games.html')


@app.route('/api/games/grammar/start', methods=['POST'])
def start_grammar_quiz():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "A valid Gemini API key is required."}), 500
        
    try:
        data = request.get_json(silent=True) or {}
        difficulty = data.get("difficulty", "Intermediate")
        
        prompt = f"""
You are an elite English Language Professor and Gamified Learning Director.
Your task is to generate a highly educational 5-question English Grammar and Vocabulary Quiz suitable for {difficulty} level.
Each question must be a multiple-choice question focusing on topics like verb tenses, pronouns, subject-verb agreement, common syntax mistakes, punctuation, spelling, word usage, idioms, or sentence structure.

For each question:
- Make sure options are realistic and represent common student mistakes.
- Provide a detailed explanation explaining WHY the correct choice is correct and WHY the other choices are incorrect, including any key grammar rules.

You MUST return a raw JSON object matching the following structure exactly. Do not include markdown code block formatting (like ```json ... ```), return ONLY the raw JSON string.

JSON Schema:
{{
  "difficulty": "{difficulty}",
  "questions": [
    {{
      "id": 1,
      "topic": "<category e.g., Pronouns, Tense, Punctuation>",
      "question": "<the educational question content>",
      "options": [
        "<choice A>",
        "<choice B>",
        "<choice C>",
        "<choice D>"
      ],
      "answer": "<exact string matching the correct option>",
      "explanation": "<detailed, beautifully structured explanation explaining the correct rule and correcting misconceptions>"
    }},
    ... (generate exactly 5 unique questions)
  ]
}}
"""
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        result_json = json.loads(result_text)
        return jsonify(result_json)
        
    except json.JSONDecodeError as je:
        import sys
        sys.stderr.write(f"\n[ERROR] JSON Decode Error in grammar quiz: {str(je)}\nResponse text:\n{response.text}\n")
        return jsonify({"error": "Failed to parse grammar questions from AI. Please try again."}), 500
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Grammar quiz generation failed: {str(e)}\n")
        return jsonify({"error": "AI grammar service encountered an error.", "details": str(e)}), 500


@app.route('/api/games/custom-scholar/generate', methods=['POST'])
def generate_custom_quiz():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "A valid Gemini API key is required."}), 500
        
    try:
        data = request.get_json(silent=True) or {}
        topic = data.get("topic", "General Knowledge").strip()
        
        if not topic:
            topic = "General Knowledge"
            
        prompt = f"""
You are an expert Educational Curriculum Designer and AI Tutor.
Your goal is to design a highly engaging, custom 5-question multiple-choice learning quiz on the topic: "{topic}".
The questions should cover interesting, core historical, scientific, technical, or mathematical concepts related to the topic.
Ensure the difficulty is well-balanced for an eager learner.

For each question:
- Make options challenging and logical.
- Provide a thorough, direct explanation explaining the concept, key facts, and why the correct choice is right.

You MUST return a raw JSON object matching the following structure exactly. Do not include markdown code block formatting (like ```json ... ```), return ONLY the raw JSON string.

JSON Schema:
{{
  "topic": "{topic}",
  "questions": [
    {{
      "id": 1,
      "topic": "<subtopic or concept e.g., Chemistry, History, Syntax>",
      "question": "<the educational question content>",
      "options": [
        "<choice A>",
        "<choice B>",
        "<choice C>",
        "<choice D>"
      ],
      "answer": "<exact string matching the correct option>",
      "explanation": "<detailed educational explanation of the fact or concept, teaching the user the correct reasoning>"
    }},
    ... (generate exactly 5 unique questions)
  ]
}}
"""
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        result_json = json.loads(result_text)
        return jsonify(result_json)
        
    except json.JSONDecodeError as je:
        import sys
        sys.stderr.write(f"\n[ERROR] JSON Decode Error in custom quiz: {str(je)}\nResponse text:\n{response.text}\n")
        return jsonify({"error": "Failed to parse custom questions from AI. Please try again."}), 500
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Custom quiz generation failed: {str(e)}\n")
        return jsonify({"error": "AI custom scholar service encountered an error.", "details": str(e)}), 500


@app.route('/api/games/scholar/analyze', methods=['POST'])
def analyze_performance():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return jsonify({"error": "A valid Gemini API key is required."}), 500
        
    try:
        data = request.get_json(silent=True) or {}
        mistakes = data.get("mistakes", [])
        quiz_type = data.get("quiz_type", "General")
        
        if not mistakes:
            return jsonify({
                "summary": "Perfect score! Outstanding achievement! You demonstrated absolute mastery of the concepts in this test. Keep up the flawless work!",
                "strengths": ["Perfect Conceptual Understanding", "Flawless Execution", "High Attention to Detail"],
                "weaknesses": ["None identified in this assessment!"],
                "recommendations": ["Explore advanced-level quizzes to further stretch your capabilities.", "Keep a perfect streak going in custom subjects!"]
            })
            
        mistakes_summary = ""
        for i, m in enumerate(mistakes, 1):
            mistakes_summary += f"Mistake #{i}:\n- Question: {m.get('question')}\n- Topic/Context: {m.get('topic')}\n- You answered: {m.get('selected')}\n- Correct answer was: {m.get('correct')}\n\n"
            
        prompt = f"""
You are an advanced AI Educational Diagnostician and Personal Academic Advisor.
Analyze the following mistakes a student made during a "{quiz_type}" quiz and construct a highly encouraging, structured Study Improvement Guide.

Mistakes Made by Student:
---
{mistakes_summary}
---

Your diagnostic review should help the student understand their core conceptual weaknesses and give them specific grammar/learning rules and recommendations to ensure they never repeat these mistakes.

You MUST return a raw JSON object matching the following structure exactly. Do not include markdown code block formatting (like ```json ... ```), return ONLY the raw JSON string.

JSON Schema:
{{
  "summary": "<A warm, highly encouraging 3-4 sentence paragraph reviewing their results. Acknowledge their effort, pinpoint the exact underlying common denominator/core mistake theme, and inspire them to improve.>",
  "strengths": [
    "<Highlight a strength (e.g. they attempted tough questions, they are actively studying this topic)>",
    "<Another strength point>"
  ],
  "weaknesses": [
    "<Identify a clear conceptual gap based on their wrong answers, explaining what they got confused by>",
    "<Another clear conceptual gap detected>"
  ],
  "study_guide": [
    {{
      "concept": "<The name of the core topic/rule they got wrong, e.g. 'Subject-Verb Agreement' or 'Electron Configuration'>",
      "rule": "<The grammatical/scientific rule written clearly and beautifully, using examples to illustrate it>",
      "quick_tip": "<A memorable mnemonic or simple trick to remember this rule in the future>"
    }}
    // Provide a study guide entry for each unique concept they struggled with (up to 3).
  ],
  "recommendations": [
    "<Specific actionable recommendation 1, e.g. 'Practice pronouns specifically by typing a custom pronoun quiz.'>",
    "<Specific actionable recommendation 2>",
    "<Specific actionable recommendation 3>"
  ]
}}
"""
        import google.generativeai as genai
        import json
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-flash-latest')
        
        response = model.generate_content(
            prompt,
            generation_config={"response_mime_type": "application/json"}
        )
        
        result_text = response.text.strip()
        result_json = json.loads(result_text)
        return jsonify(result_json)
        
    except json.JSONDecodeError as je:
        import sys
        sys.stderr.write(f"\n[ERROR] JSON Decode Error in performance analysis: {str(je)}\nResponse text:\n{response.text}\n")
        return jsonify({"error": "Failed to parse analysis from AI. Please try again."}), 500
    except Exception as e:
        import sys
        sys.stderr.write(f"\n[ERROR] Performance analysis failed: {str(e)}\n")
        return jsonify({"error": "AI performance analysis service encountered an error.", "details": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
