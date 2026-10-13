import os
import json
import re
import httpx
from .config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    LLM_PROVIDER,
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT,
    AZURE_OPENAI_API_VERSION
)

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

async def call_azure_openai(prompt: str) -> dict:
    clean_endpoint = AZURE_OPENAI_ENDPOINT.rstrip('/')
    if '/openai/deployments/' not in clean_endpoint:
        url = f"{clean_endpoint}/openai/deployments/{AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version={AZURE_OPENAI_API_VERSION}"
    else:
        url = clean_endpoint

    headers = {
        "api-key": AZURE_OPENAI_API_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "messages": [
            {
                "role": "system",
                "content": "You are an autonomous AI engineering agent. Always respond with clean, valid JSON only. Do not wrap in markdown blocks."
            },
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, headers=headers, json=payload)
        res.raise_for_status()
        data = res.json()
        content = data["choices"][0]["message"]["content"].strip()
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\n?", "", content)
            content = re.sub(r"\n?```$", "", content)
        return json.loads(content)

async def generate_json_response(prompt: str, agent_type: str, fallback_data: dict) -> dict:
    """Generate structured response using Azure OpenAI or Gemini, with intelligent fallback."""
    provider = LLM_PROVIDER.lower() if LLM_PROVIDER else "azure"

    # 1. Try Azure OpenAI if active or configured
    if provider == "azure" and AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT:
        try:
            return await call_azure_openai(prompt)
        except Exception as e:
            print(f"[LLM] Azure OpenAI call exception ({agent_type}): {e}. Trying Gemini or fallback.")

    # 2. Try Google Gemini
    client = get_genai_client()
    if client:
        try:
            model_to_use = GEMINI_MODEL
            system_instruction = "You are an autonomous AI engineering agent. Always respond with clean, valid JSON only."
            
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
            if text.startswith("```"):
                text = re.sub(r"^```(?:json)?\n?", "", text)
                text = re.sub(r"\n?```$", "", text)
            
            return json.loads(text)
        except Exception as e:
            print(f"[LLM] Gemini API call exception ({agent_type}): {e}. Using structured fallback.")

    # Return intelligent agent-tailored fallback
    return fallback_data
