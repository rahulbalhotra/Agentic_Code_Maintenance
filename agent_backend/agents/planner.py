import json
from datetime import datetime
from ..prompts.prompt_loader import load_prompt, render_prompt
from ..llm_client import generate_json_response
from ..event_stream import emit_pipeline_thought

async def run_planner_agent(state: dict) -> dict:
    ticket_key = state.get("ticket_key", "FB-NEW")
    ticket_title = state.get("ticket_title", "")
    ticket_desc = state.get("ticket_description", "")
    vigilant_res = state.get("vigilant_result", {})

    # 1. Live stream thinking: planning begins
    await emit_pipeline_thought(
        "Planner",
        f"Deconstructing ticket {ticket_key} ('{ticket_title}') into modular technical milestones and file targets.",
        "Decomposition & Step Formulation"
    )

    template = load_prompt("planner")
    prompt = render_prompt(
        template,
        ticket_key=ticket_key,
        ticket_title=ticket_title,
        ticket_description=ticket_desc,
        vigilant_analysis=json.dumps(vigilant_res)
    )

    fallback = {
        "plan_overview": f"Implementation plan for {ticket_key}: {ticket_title}",
        "target_files": ["styles.css", "index.html", "app.js"],
        "steps": [
            {
                "step_number": 1,
                "title": "Investigate existing layout and DOM targets in index.html",
                "action": "Locate relevant sections and insert necessary UI elements or attributes.",
                "target_file": "index.html"
            },
            {
                "step_number": 2,
                "title": "Apply design system styles and responsive tokens in styles.css",
                "action": "Ensure official Meta blue (#0866FF) and clean spacing variables.",
                "target_file": "styles.css"
            },
            {
                "step_number": 3,
                "title": "Bind interactive event listeners in app.js",
                "action": "Wire up reactive state, click handlers, or counter updates.",
                "target_file": "app.js"
            }
        ],
        "acceptance_criteria": [
            "All functional requirements defined in ticket are met",
            "Responsive layout preserved across mobile and desktop viewports",
            "Zero console errors or broken styles"
        ]
    }

    result = await generate_json_response(prompt, "planner", fallback)

    steps_count = len(result.get("steps", []))
    target_files = result.get("target_files", [])

    # 2. Live stream thought: Plan formulated
    await emit_pipeline_thought(
        "Planner",
        f"Formulated {steps_count} milestone steps across target files: {', '.join(target_files)}. Dispatching to Researcher Agent.",
        "Plan Dispatched to Researcher"
    )

    now_str = datetime.now().strftime("%H:%M:%S")
    thoughts = list(state.get("thoughts", []))
    thoughts.append({
        "agent": "Planner",
        "timestamp": now_str,
        "thought": f"Generated {steps_count} milestone steps. Target files: {', '.join(target_files)}. Passing to Researcher Agent.",
        "action": "Plan Dispatched to Researcher"
    })

    return {
        **state,
        "current_agent": "researcher",
        "planner_result": result,
        "thoughts": thoughts
    }
