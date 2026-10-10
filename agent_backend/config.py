import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
WORKSPACE_REPO = PROJECT_ROOT / "workspace" / "fb_clone_repo"

load_dotenv(BASE_DIR / ".env")
load_dotenv(PROJECT_ROOT / "server" / ".env")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
# Default model requested by user
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
EXPRESS_API_URL = os.getenv("EXPRESS_API_URL", "http://localhost:4000/api")
AGENT_PORT = int(os.getenv("AGENT_PORT", "8000"))
PROMPT_VERSION = os.getenv("PROMPT_VERSION", "v1")
