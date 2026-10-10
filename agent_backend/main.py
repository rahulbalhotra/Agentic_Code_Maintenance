import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List

from .config import AGENT_PORT, GEMINI_MODEL, GEMINI_API_KEY
from .graph.pipeline import app_pipeline
from .graph.state import AgentState
from .watchdog import start_vigilant_watchdog, register_pipeline_runner, processed_tickets
from .event_stream import (
    set_state_ref,
    subscribe_stream,
    unsubscribe_stream,
    broadcast_event,
    emit_pipeline_thought
)

# Pipeline runtime memory for UI flowchart & live inspection
current_pipeline_state: Dict[str, Any] = {
    "ticket_key": "None",
    "ticket_title": "Idle - Awaiting new Jira ticket",
    "current_agent": "idle", # "idle" | "vigilant" | "planner" | "researcher" | "coder" | "tester" | "release" | "completed"
    "pipeline_status": "idle", # "idle" | "running" | "completed" | "failed"
    "last_action": "System Ready",
    "vigilant_result": {},
    "planner_result": {},
    "researcher_result": {},
    "coder_result": {},
    "tester_result": {},
    "release_result": {},
    "thoughts": [],
    "modified_files": [],
    "git_commit": {},
    "pull_request": {},
    "updated_at": datetime.now().isoformat()
}

# Bind state reference so event_stream can mutate and broadcast directly
set_state_ref(current_pipeline_state)

pipeline_history: List[Dict[str, Any]] = []

async def execute_ticket_pipeline(ticket_data: dict):
    """Executes the autonomous 6-Agent LangGraph multi-agent pipeline with live streaming."""
    global current_pipeline_state, pipeline_history

    ticket_id = ticket_data.get("id", f"ticket-{int(datetime.now().timestamp())}")
    ticket_key = ticket_data.get("key", "FB-NEW")
    ticket_title = ticket_data.get("title", "Untitled Ticket")
    ticket_desc = ticket_data.get("description", "")
    ticket_prio = ticket_data.get("priority", "MEDIUM")
    ticket_type = ticket_data.get("type", "Task")

    print(f"\n[Pipeline] [START] Starting Autonomous 6-Agent LangGraph Run for {ticket_key}: '{ticket_title}'")

    initial_thoughts = [
        {
            "agent": "System",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "thought": f"Autonomous LangGraph workflow initialized for Jira ticket {ticket_key}.",
            "action": "Starting Vigilant Monitor"
        }
    ]

    initial_state: AgentState = {
        "ticket_id": ticket_id,
        "ticket_key": ticket_key,
        "ticket_title": ticket_title,
        "ticket_description": ticket_desc,
        "ticket_priority": ticket_prio,
        "ticket_type": ticket_type,
        "current_agent": "vigilant",
        "pipeline_status": "running",
        "vigilant_result": {},
        "planner_result": {},
        "researcher_result": {},
        "coder_result": {},
        "tester_result": {},
        "release_result": {},
        "thoughts": initial_thoughts,
        "modified_files": [],
        "git_commit": {},
        "pull_request": {},
        "error": None
    }

    current_pipeline_state.clear()
    current_pipeline_state.update(dict(initial_state))
    current_pipeline_state["last_action"] = "Starting Vigilant Monitor"
    current_pipeline_state["updated_at"] = datetime.now().isoformat()

    await broadcast_event("state", current_pipeline_state)

    try:
        # Stream step-by-step through LangGraph
        async for output_step in app_pipeline.astream(initial_state):
            for node_name, node_state in output_step.items():
                current_pipeline_state.update(node_state)
                current_pipeline_state["updated_at"] = datetime.now().isoformat()
                print(f"[Pipeline] -> Node '{node_name}' finished. Next agent: {node_state.get('current_agent')}")
                await broadcast_event("node_transition", {
                    "completed_node": node_name,
                    "current_agent": node_state.get("current_agent"),
                    "state": current_pipeline_state
                })
                await asyncio.sleep(0.4) # Allow UI flowchart to animate transitions nicely

        current_pipeline_state["pipeline_status"] = "completed"
        current_pipeline_state["current_agent"] = "completed"
        current_pipeline_state["last_action"] = "Release Complete"
        current_pipeline_state["updated_at"] = datetime.now().isoformat()

        pipeline_history.insert(0, dict(current_pipeline_state))
        if len(pipeline_history) > 20:
            pipeline_history.pop()

        await broadcast_event("completed", current_pipeline_state)
        print(f"[Pipeline] [SUCCESS] Completed full 6-agent pipeline run for {ticket_key}!\n")

    except Exception as e:
        print(f"[Pipeline] [ERROR] Error in LangGraph execution: {e}")
        current_pipeline_state["pipeline_status"] = "failed"
        current_pipeline_state["error"] = str(e)
        current_pipeline_state["thoughts"].append({
            "agent": "System",
            "timestamp": datetime.now().strftime("%H:%M:%S"),
            "thought": f"Pipeline failed: {str(e)}",
            "action": "Error Halted"
        })
        current_pipeline_state["updated_at"] = datetime.now().isoformat()
        await broadcast_event("failed", {
            "error": str(e),
            "state": current_pipeline_state
        })

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register pipeline callback with Watchdog
    register_pipeline_runner(execute_ticket_pipeline)
    watchdog_task = asyncio.create_task(start_vigilant_watchdog())
    yield
    watchdog_task.cancel()

app = FastAPI(title="Auto-Jira Autonomous LangGraph Agents", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TicketWebhookPayload(BaseModel):
    id: Optional[str] = None
    key: Optional[str] = None
    title: str
    description: Optional[str] = ""
    status: Optional[str] = "TODO"
    priority: Optional[str] = "MEDIUM"
    type: Optional[str] = "Task"

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Auto-Jira Python Agent Backend",
        "model": GEMINI_MODEL,
        "has_api_key": bool(GEMINI_API_KEY),
        "active_pipeline": current_pipeline_state.get("current_agent")
    }

@app.get("/api/pipeline/status")
async def get_pipeline_status():
    """Returns the live state of the multi-agent pipeline for the UI flowchart."""
    return current_pipeline_state

@app.get("/api/pipeline/history")
async def get_pipeline_history():
    """Returns recent pipeline execution runs."""
    return pipeline_history

@app.get("/api/pipeline/stream")
async def stream_pipeline_events():
    """Server-Sent Events (SSE) stream for real-time live thinking & actions."""
    queue = await subscribe_stream()
    async def event_generator():
        try:
            # Send initial state snapshot immediately
            yield f"data: {json.dumps({'type': 'init', 'data': current_pipeline_state})}\n\n"
            while True:
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            unsubscribe_stream(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@app.post("/api/webhook/jira-ticket")
async def webhook_new_ticket(payload: TicketWebhookPayload, background_tasks: BackgroundTasks):
    """Webhook triggered instantly when a new Jira ticket is created."""
    ticket_dict = payload.model_dump()
    t_id = ticket_dict.get("id") or ticket_dict.get("key")
    if t_id:
        processed_tickets.add(t_id)
    background_tasks.add_task(execute_ticket_pipeline, ticket_dict)
    return {"status": "accepted", "message": f"Autonomous pipeline started for {payload.key or payload.title}"}

from .prompts.prompt_loader import list_all_prompts

@app.get("/api/prompts")
async def get_all_prompts():
    """Returns all prompt versions and text templates for inspection."""
    return list_all_prompts()

@app.post("/api/pipeline/run")
async def trigger_pipeline_manual(payload: TicketWebhookPayload, background_tasks: BackgroundTasks):
    """Manual trigger on any ticket from UI."""
    ticket_dict = payload.model_dump()
    background_tasks.add_task(execute_ticket_pipeline, ticket_dict)
    return {"status": "triggered", "ticket": ticket_dict.get("key")}
