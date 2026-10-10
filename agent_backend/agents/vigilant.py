from datetime import datetime
from ..prompts.prompt_loader import load_prompt, render_prompt
from ..llm_client import generate_json_response
from ..tools.jira_tools import update_jira_ticket_status
from ..event_stream import emit_pipeline_thought

async def run_vigilant_agent(state: dict) -> dict:
    ticket_id = state.get("ticket_id")
    ticket_key = state.get("ticket_key", "FB-NEW")
    ticket_title = state.get("ticket_title", "Untitled")
    ticket_desc = state.get("ticket_description", "")
    ticket_priority = state.get("ticket_priority", "MEDIUM")
    ticket_type = state.get("ticket_type", "Task")

    # 1. Live stream thinking: Initial ticket detection
    await emit_pipeline_thought(
        "Vigilant",
        f"Detected ticket {ticket_key} ('{ticket_title}'). Analyzing requirements, priority ({ticket_priority}), and architectural scope.",
        "Triage & Risk Evaluation"
    )

    # 2. Automatically transition status to IN_PROGRESS on Kanban board
    await emit_pipeline_thought(
        "Vigilant",
        f"Marking ticket {ticket_key} as 'IN_PROGRESS' on Jira Kanban board.",
        "Kanban Status -> IN_PROGRESS"
    )
    if ticket_id or ticket_key:
        await update_jira_ticket_status(ticket_id or ticket_key, "IN_PROGRESS")

    # 3. Prepare prompt and call LLM
    template = load_prompt("vigilant")
    prompt = render_prompt(
        template,
        ticket_key=ticket_key,
        ticket_title=ticket_title,
        ticket_type=ticket_type,
        ticket_priority=ticket_priority,
        ticket_description=ticket_desc
    )

    fallback = {
        "triage_verdict": "APPROVED_FOR_PIPELINE",
        "target_component": "Feed / UI Component",
        "risk_level": "LOW" if ticket_priority in ["LOW", "MEDIUM"] else "HIGH",
        "urgency": "EXPEDITE" if ticket_priority in ["HIGH", "HIGHEST"] else "NORMAL",
        "summary": f"Autonomous triage approved for {ticket_key}: {ticket_title}",
        "vigilant_notes": "Maintain responsive UI layout, ensure all changes conform to Facebook clone guidelines."
    }

    result = await generate_json_response(prompt, "vigilant", fallback)

    # 4. Live stream thought: Triage complete
    await emit_pipeline_thought(
        "Vigilant",
        f"Triage complete. Verdict: {result.get('triage_verdict')}. Risk: {result.get('risk_level')}. Forwarding to Planner Agent.",
        "Handoff to Planner"
    )

    now_str = datetime.now().strftime("%H:%M:%S")
    thoughts = list(state.get("thoughts", []))
    thoughts.append({
        "agent": "Vigilant",
        "timestamp": now_str,
        "thought": f"Triage complete. Risk: {result.get('risk_level')}. Target: {result.get('target_component')}. Status transitioned to IN_PROGRESS.",
        "action": "Triage Finalized"
    })

    return {
        **state,
        "current_agent": "planner",
        "vigilant_result": result,
        "thoughts": thoughts
    }
