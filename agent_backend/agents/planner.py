import json
from datetime import datetime
from ..prompts.prompt_loader import load_prompt, render_prompt
from ..llm_client import generate_json_response
from ..event_stream import emit_pipeline_thought

def evaluate_dynamic_routing(ticket_title: str, ticket_desc: str, llm_result: dict) -> tuple[bool, bool, str, str]:
    """
    Evaluates whether the ticket requires architectural research and security/test auditing.
    Returns: (requires_research, requires_testing, execution_route, routing_reason)
    """
    combined_text = f"{ticket_title} {ticket_desc}".lower()
    
    # Common direct styling / simple UI keywords
    simple_patterns = [
        "button color", "change color", "update color", "button style",
        "bg color", "background color", "css", "styling", "font size",
        "text color", "header color", "tweak color", "border color",
        "update button", "change button", "align button", "navbar color"
    ]
    is_simple_style = any(pattern in combined_text for pattern in simple_patterns)

    # 1. Check LLM explicit decision if provided
    llm_requires_research = llm_result.get("requires_research")
    llm_requires_testing = llm_result.get("requires_testing")
    llm_reason = llm_result.get("routing_reason", "")

    if llm_requires_research is not None:
        requires_research = bool(llm_requires_research)
    else:
        # Heuristic fallback: if it's a simple styling/color ticket, skip research
        requires_research = not is_simple_style

    if llm_requires_testing is not None:
        requires_testing = bool(llm_requires_testing)
    else:
        # Simple cosmetic changes can fast-track directly to git commit & release
        requires_testing = not is_simple_style

    if not requires_research:
        execution_route = "fast_track"
        reason = llm_reason or f"Ticket '{ticket_title}' is a direct cosmetic/UI modification that does not require architectural or knowledge base research."
    else:
        execution_route = "full_pipeline"
        reason = llm_reason or f"Ticket '{ticket_title}' involves multi-component architecture, requiring knowledge base context and codebase inspection."

    return requires_research, requires_testing, execution_route, reason

async def run_planner_agent(state: dict) -> dict:
    ticket_key = state.get("ticket_key", "FB-NEW")
    ticket_title = state.get("ticket_title", "")
    ticket_desc = state.get("ticket_description", "")
    vigilant_res = state.get("vigilant_result", {})

    # 1. Live stream thinking: planning begins
    await emit_pipeline_thought(
        "Planner",
        f"Deconstructing ticket {ticket_key} ('{ticket_title}') into modular technical milestones and analyzing dynamic routing requirements.",
        "Decomposition & Dynamic Routing Evaluation"
    )

    template = load_prompt("planner")
    prompt = render_prompt(
        template,
        ticket_key=ticket_key,
        ticket_title=ticket_title,
        ticket_description=ticket_desc,
        vigilant_analysis=json.dumps(vigilant_res)
    )

    # Intelligent fallback matching ticket complexity
    combined_lower = f"{ticket_title} {ticket_desc}".lower()
    is_styling_ticket = any(k in combined_lower for k in ["color", "button", "css", "styling", "theme"])

    fallback = {
        "plan_overview": f"Implementation plan for {ticket_key}: {ticket_title}",
        "requires_research": not is_styling_ticket,
        "requires_testing": not is_styling_ticket,
        "execution_route": "fast_track" if is_styling_ticket else "full_pipeline",
        "routing_reason": "Direct styling change; skipping preliminary research." if is_styling_ticket else "Complex feature requiring full architectural research.",
        "target_files": ["styles.css"] if is_styling_ticket else ["styles.css", "index.html", "app.js"],
        "steps": [
            {
                "step_number": 1,
                "title": f"Update styling in styles.css for {ticket_title}",
                "action": "Modify or add target CSS classes with required styles and color values.",
                "target_file": "styles.css"
            }
        ] if is_styling_ticket else [
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

    # 2. Dynamic Routing Evaluation
    requires_research, requires_testing, execution_route, routing_reason = evaluate_dynamic_routing(
        ticket_title,
        ticket_desc,
        result
    )

    result["requires_research"] = requires_research
    result["requires_testing"] = requires_testing
    result["execution_route"] = execution_route
    result["routing_reason"] = routing_reason

    steps_count = len(result.get("steps", []))
    target_files = result.get("target_files", [])

    skipped_agents = []
    if not requires_research:
        skipped_agents.append("researcher")
    if not requires_testing:
        skipped_agents.append("tester")

    next_agent = "coder" if not requires_research else "researcher"

    # 3. Live stream thought: Dynamic routing announced
    if not requires_research:
        thought_msg = (
            f"Dynamic Routing Decision: Ticket '{ticket_title}' does not require research ({routing_reason}). "
            f"Directly invoking Coder Agent to make changes and update Knowledge Graph, bypassing Researcher Agent."
        )
        action_name = "Dynamic Route -> Coder (Fast-Track)"
    else:
        thought_msg = (
            f"Dynamic Routing Decision: Formulated {steps_count} milestone steps across {', '.join(target_files)}. "
            f"Dispatching to Researcher Agent for deep codebase scan and Knowledge Base context."
        )
        action_name = "Dynamic Route -> Researcher"

    await emit_pipeline_thought("Planner", thought_msg, action_name)

    now_str = datetime.now().strftime("%H:%M:%S")
    thoughts = list(state.get("thoughts", []))
    thoughts.append({
        "agent": "Planner",
        "timestamp": now_str,
        "thought": thought_msg,
        "action": action_name
    })

    return {
        **state,
        "current_agent": next_agent,
        "requires_research": requires_research,
        "requires_testing": requires_testing,
        "execution_route": execution_route,
        "skipped_agents": skipped_agents,
        "planner_result": result,
        "thoughts": thoughts
    }
