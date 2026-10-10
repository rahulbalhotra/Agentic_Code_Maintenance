import os
from pathlib import Path

PROMPTS_DIR = Path(__file__).parent

def load_prompt(agent_name: str, version: str = "v1") -> str:
    """Loads a prompt template for an agent from the specified version folder."""
    file_path = PROMPTS_DIR / version / f"{agent_name}.txt"
    if not file_path.exists():
        file_path = PROMPTS_DIR / "v1" / f"{agent_name}.txt"
    
    if not file_path.exists():
        raise FileNotFoundError(f"Prompt template for '{agent_name}' ({version}) not found at {file_path}")
        
    return file_path.read_text(encoding="utf-8")

def render_prompt(template_str: str, **kwargs) -> str:
    """Safely substitutes {key} placeholders without throwing KeyError on JSON braces."""
    rendered = template_str
    for k, v in kwargs.items():
        rendered = rendered.replace(f"{{{k}}}", str(v))
    return rendered

def list_all_prompts() -> dict:
    """Scans all versions and agent prompt files."""
    result = {"versions": [], "prompts": {}}
    for version_dir in sorted(PROMPTS_DIR.iterdir()):
        if version_dir.is_dir() and not version_dir.name.startswith("__"):
            v_name = version_dir.name
            result["versions"].append(v_name)
            result["prompts"][v_name] = {}
            for p_file in sorted(version_dir.glob("*.txt")):
                agent_name = p_file.stem
                result["prompts"][v_name][agent_name] = p_file.read_text(encoding="utf-8")
    return result
