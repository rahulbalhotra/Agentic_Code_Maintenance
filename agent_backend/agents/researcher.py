import json
from datetime import datetime
from ..prompts.prompt_loader import load_prompt, render_prompt
from ..llm_client import generate_json_response
from ..tools.workspace_tools import read_workspace_file
from ..tools.jira_tools import fetch_knowledge_base_context
from ..event_stream import emit_pipeline_thought

async def run_researcher_agent(state: dict) -> dict:
    ticket_key = state.get("ticket_key", "FB-NEW")
    ticket_title = state.get("ticket_title", "")
    planner_res = state.get("planner_result", {})

    # 1. Live stream thinking: reading codebase & KB
    await emit_pipeline_thought(
        "Researcher",
        f"Inspecting workspace codebase (/workspace/fb_clone_repo) and querying Neo4j Knowledge Base for architecture & previous progress...",
        "Codebase & Knowledge Base Scan"
    )

    # Read relevant files
    css_sample = read_workspace_file("styles.css")[:1500]
    html_sample = read_workspace_file("index.html")[:1500]
    js_sample = read_workspace_file("app.js")[:1500]
    codebase_snippets = f"--- styles.css snippet ---\n{css_sample}\n\n--- index.html snippet ---\n{html_sample}\n\n--- app.js snippet ---\n{js_sample}"

    # Fetch knowledge base context (includes previous ticket progress!)
    kb_context = await fetch_knowledge_base_context()

    # 2. Live stream thinking: analyzing guardrails
    await emit_pipeline_thought(
        "Researcher",
        f"Synthesizing Facebook design tokens (#0866FF), layout constraints, and previous sprint knowledge docs.",
        "Synthesizing Architectural Guardrails"
    )

    template = load_prompt("researcher")
    prompt = render_prompt(
        template,
        ticket_key=ticket_key,
        ticket_title=ticket_title,
        plan_data=json.dumps(planner_res),
        codebase_snippets=codebase_snippets,
        knowledge_base_context=kb_context
    )

    fallback = {
        "relevant_components": ["Post Creator", "Story Tray", "Facebook Design Tokens"],
        "design_tokens": {
            "primary": "#0866FF",
            "background": "#F0F2F5",
            "surface": "#FFFFFF",
            "font": "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
        },
        "implementation_hints": [
            "Use CSS variables --fb-primary and --fb-surface for consistent dark/light themes",
            "Attach listeners using existing event delegation or attachPostListeners pattern",
            "Preserve layout grid (280px left, center stream, 280px right)"
        ],
        "potential_pitfalls": [
            "Ensure elements scale under 768px mobile viewport",
            "Escape user-generated text when appending innerHTML to prevent XSS"
        ]
    }

    result = await generate_json_response(prompt, "researcher", fallback)

    hints_count = len(result.get("implementation_hints", []))
    pitfalls_count = len(result.get("potential_pitfalls", []))

    # 3. Live stream thought: Research complete
    await emit_pipeline_thought(
        "Researcher",
        f"Identified {hints_count} architectural constraints and {pitfalls_count} pitfall guardrails. Delivering research context to Coder Agent.",
        "Research Delivered to Coder"
    )

    now_str = datetime.now().strftime("%H:%M:%S")
    thoughts = list(state.get("thoughts", []))
    thoughts.append({
        "agent": "Researcher",
        "timestamp": now_str,
        "thought": f"Identified {hints_count} architectural constraints and {pitfalls_count} pitfall guardrails from Neo4j Knowledge Base and codebase files.",
        "action": "Research Delivered to Coder"
    })

    return {
        **state,
        "current_agent": "coder",
        "researcher_result": result,
        "thoughts": thoughts
    }
