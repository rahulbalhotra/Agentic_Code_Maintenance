import json
from datetime import datetime
from ..prompts.prompt_loader import load_prompt, render_prompt
from ..llm_client import generate_json_response
from ..tools.workspace_tools import (
    read_workspace_file,
    write_workspace_file,
    git_commit_changes,
    create_or_update_pull_request
)
from ..event_stream import emit_pipeline_thought

async def run_coder_agent(state: dict) -> dict:
    ticket_key = state.get("ticket_key", "FB-NEW")
    ticket_title = state.get("ticket_title", "")
    ticket_desc = state.get("ticket_description", "")
    planner_res = state.get("planner_result", {})
    researcher_res = state.get("researcher_result", {})
    requires_testing = state.get("requires_testing", True)

    # 1. Live stream thinking: Synthesizing patches
    research_context_summary = "with architectural research guardrails" if researcher_res else "via direct fast-track route"
    await emit_pipeline_thought(
        "Coder",
        f"Synthesizing implementation for {ticket_key} {research_context_summary}. Reading target files in workspace and preparing scoped patches...",
        "Code Generation & Patch Preparation"
    )

    target_files = planner_res.get("target_files", ["styles.css"])
    target_contents = ""
    for f in target_files:
        c = read_workspace_file(f)
        target_contents += f"\n--- {f} ---\n{c[:1200]}\n"

    research_data_str = json.dumps(researcher_res) if researcher_res else "None (Direct Fast-Track: simple ticket requiring no prior architectural research)"

    template = load_prompt("coder")
    prompt = render_prompt(
        template,
        ticket_key=ticket_key,
        ticket_title=ticket_title,
        ticket_description=ticket_desc,
        plan_data=json.dumps(planner_res),
        research_data=research_data_str,
        target_files_content=target_contents
    )

    fallback = {
        "commit_message": f"{ticket_key}: Implement {ticket_title.lower()}",
        "files_to_modify": [
            {
                "path": "styles.css",
                "action": "modify",
                "append_code": f"\n/* Feature: {ticket_key} - {ticket_title} */\n.jira-ticket-{ticket_key.lower()} {{\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  border-radius: var(--fb-radius);\n  transition: all 0.2s ease;\n}}\n"
            }
        ],
        "implementation_notes": f"Applied responsive styling and scoped feature class for {ticket_key}."
    }

    result = await generate_json_response(prompt, "coder", fallback)

    # 2. Apply changes to workspace files and emit action
    modified_files = []
    files_to_modify = result.get("files_to_modify", [])
    for item in files_to_modify:
        file_path = item.get("path")
        if file_path:
            await emit_pipeline_thought(
                "Coder",
                f"Writing patch to workspace repo file: /workspace/fb_clone_repo/{file_path}",
                f"Patching {file_path}"
            )
            existing = read_workspace_file(file_path)
            if item.get("append_code"):
                new_content = existing + item["append_code"]
                write_workspace_file(file_path, new_content)
                modified_files.append(file_path)
            elif item.get("content"):
                write_workspace_file(file_path, item["content"])
                modified_files.append(file_path)

    now_str = datetime.now().strftime("%H:%M:%S")
    thoughts = list(state.get("thoughts", []))
    git_commit = state.get("git_commit", {})
    pull_request = state.get("pull_request")

    # 3. Dynamic Routing: Determine next handoff (Tester vs Release directly)
    if not requires_testing:
        # Fast-track: auto-commit changes and directly hand off to Release to update Knowledge Graph
        commit_msg = result.get("commit_message", f"{ticket_key}: {ticket_title}")
        git_commit = git_commit_changes(commit_msg)
        pr_desc = result.get("implementation_notes", f"Fast-track implementation for {ticket_key}.")
        pull_request = create_or_update_pull_request(ticket_key, ticket_title, pr_desc, modified_files)

        handoff_thought = (
            f"Code modifications applied to {len(modified_files)} files ({', '.join(modified_files)}) and auto-committed (Hash: {git_commit.get('hash', 'HEAD')}). "
            f"Dynamic Routing: Bypassing Test Agent and advancing directly to Release & Graph Sync Agent to update Knowledge Graph."
        )
        handoff_action = "Dynamic Route -> Release (Knowledge Graph Sync)"
        next_agent = "release"
    else:
        # Standard: handoff to Test & Auditor Agent
        handoff_thought = (
            f"Code modifications prepared for {len(modified_files)} files ({', '.join(modified_files)}). "
            f"Dispatching to Test & Auditor Agent for verification."
        )
        handoff_action = "Code Dispatched to Test Agent"
        next_agent = "tester"

    await emit_pipeline_thought("Coder", handoff_thought, handoff_action)
    thoughts.append({
        "agent": "Coder",
        "timestamp": now_str,
        "thought": handoff_thought,
        "action": handoff_action
    })

    return {
        **state,
        "current_agent": next_agent,
        "coder_result": result,
        "modified_files": modified_files,
        "git_commit": git_commit,
        "pull_request": pull_request,
        "thoughts": thoughts
    }
