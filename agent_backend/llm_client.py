import os
import json
import re
from .config import GEMINI_API_KEY, GEMINI_MODEL

try:
    from google import genai
    from google.genai import types
    has_genai = True
except ImportError:
    has_genai = False

def get_genai_client():
    if has_genai and GEMINI_API_KEY:
        try:
            return genai.Client(api_key=GEMINI_API_KEY)
        except Exception as e:
            print(f"[LLM] Error initializing genai Client: {e}")
    return None

async def generate_json_response(prompt: str, agent_type: str, fallback_data: dict) -> dict:
    """Generate structured response using Gemini, with intelligent fallback."""
    client = get_genai_client()
    if client:
        try:
            # Model mapping or user-configured model
            model_to_use = GEMINI_MODEL
            # Allow fallback if 3.6-flash is not yet in GA endpoint
            system_instruction = "You are an autonomous AI engineering agent. Always respond with clean, valid JSON only. Do not enclose in markdown blocks if possible, or use standard ```json ```."
            
            response = client.models.generate_content(
                model=model_to_use,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.2,
                    response_mime_type="application/json"
                )
            )
            
            text = response.text.strip()
            # Clean markdown fences if any
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\n?", "", text)
                text = re.sub(r"\n?```$", "", text)
            
            return json.loads(text)
        except Exception as e:
            print(f"[LLM] Gemini API call exception ({agent_type}): {e}. Using structured fallback.")

    # Return intelligent agent-tailored fallback
    return fallback_data
