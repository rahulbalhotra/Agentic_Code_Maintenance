import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
WORKSPACE_REPO = PROJECT_ROOT / "workspace" / "fb_clone_repo"

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_ROOT / "server" / ".env")

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "azure")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY", "")
AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT", "")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Default model requested by user
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")
SERVER_PORT = os.getenv("SERVER_PORT", "4000")
EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", f"http://localhost:{SERVER_PORT}/api")
AGENT_PORT = int(os.getenv("AGENT_PORT", "8000"))
PROMPT_VERSION = os.getenv("PROMPT_VERSION", "v1")

