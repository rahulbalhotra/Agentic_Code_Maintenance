import asyncio
import json
from datetime import datetime
from typing import Set, Dict, Any, List

# Active client subscriber queues for SSE
_subscribers: Set[asyncio.Queue] = set()

# Reference to the global pipeline state (set by main.py)
_current_state_ref: Dict[str, Any] = {}

def set_state_ref(state_dict: Dict[str, Any]):
    global _current_state_ref
    _current_state_ref = state_dict

def get_current_pipeline_state() -> Dict[str, Any]:
    return _current_state_ref

async def subscribe_stream() -> asyncio.Queue:
    """Register a new SSE stream subscriber."""
    queue = asyncio.Queue()
    _subscribers.add(queue)
    return queue

def unsubscribe_stream(queue: asyncio.Queue):
    """Unregister an SSE stream subscriber."""
    _subscribers.discard(queue)

async def broadcast_event(event_type: str, data: Dict[str, Any]):
    """Broadcast an event payload to all connected SSE clients."""
    payload = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.now().isoformat()
    }
    dead_queues = []
    for q in list(_subscribers):
        try:
            q.put_nowait(payload)
        except Exception:
            dead_queues.append(q)
    for q in dead_queues:
        _subscribers.discard(q)

async def emit_pipeline_thought(agent: str, thought: str, action: str):
    """
    Emits a real-time agent thought & action.
    Updates the shared pipeline state and immediately broadcasts via SSE.
    """
    now_str = datetime.now().strftime("%H:%M:%S")
    thought_entry = {
        "agent": agent,
        "timestamp": now_str,
        "thought": thought,
        "action": action
    }

    if "thoughts" in _current_state_ref:
        _current_state_ref["thoughts"].append(thought_entry)
        _current_state_ref["current_agent"] = agent.lower()
        _current_state_ref["last_action"] = action
        _current_state_ref["updated_at"] = datetime.now().isoformat()

    print(f"[{agent.upper()}] [{action}] {thought}")
    await broadcast_event("thought", {
        "thought_entry": thought_entry,
        "current_agent": agent.lower(),
        "action": action,
        "pipeline_status": _current_state_ref.get("pipeline_status", "running")
    })
