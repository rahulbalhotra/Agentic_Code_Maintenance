import asyncio
import httpx
from typing import Optional, Dict, Any, List
from .config import EXPRESS_API_URL

processed_tickets = set()
pipeline_runner_callback = None
is_executing = False
latest_queue_cache: Dict[str, Any] = {
    "readyQueue": [],
    "blockedQueue": [],
    "inProgressQueue": [],
    "doneQueue": [],
    "nextRecommended": None
}

def register_pipeline_runner(callback):
    global pipeline_runner_callback
    pipeline_runner_callback = callback

def set_pipeline_active(active: bool):
    global is_executing
    is_executing = active

def is_pipeline_active() -> bool:
    return is_executing

def get_latest_queue() -> Dict[str, Any]:
    return latest_queue_cache

async def start_vigilant_watchdog():
    """
    Intelligent Prioritization Watchdog:
    - Continuously inspects the Neo4j Jira Graph dependency network.
    - Evaluates task sizing (Story Points) and blocker relationships (:BLOCKS, :DEPENDS_ON).
    - Topologically orders tickets and dispatches the highest-value, smallest unblocked ticket first.
    - Automatically unlocks and triggers dependent tickets as blockers reach 'DONE'.
    """
    global is_executing, latest_queue_cache
    print("[Prioritization Watchdog] Active & monitoring Jira Dependency Graph...")

    last_logged_ticket = None

    while True:
        try:
            await asyncio.sleep(5) # Poll interval
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{EXPRESS_API_URL}/issues/prioritized")
                if res.status_code == 200:
                    data = res.json()
                    latest_queue_cache = data
                    ready_queue = data.get("readyQueue", [])
                    blocked_queue = data.get("blockedQueue", [])

                    # If the dynamic multi-agent pipeline is currently working on a ticket, let it finish
                    if is_executing:
                        continue

                    # If there are ready (unblocked) tickets
                    if ready_queue:
                        # Pick the #1 ranked candidate (Shortest Job First + Highest Priority + Unblocks Most Tasks)
                        candidate = ready_queue[0]
                        candidate_id = candidate.get("id")
                        candidate_key = candidate.get("key", "UNKNOWN")

                        # Avoid repeating tickets that were already processed in this session unless explicitly re-queued
                        if candidate_id and candidate_id not in processed_tickets:
                            score = candidate.get("priorityScore", 0)
                            sp = candidate.get("storyPoints", 1)
                            prio = candidate.get("priority", "MEDIUM")
                            unblocks = candidate.get("unblocksCount", 0)

                            print("\n" + "=" * 65)
                            print(f"[Prioritization Watchdog] 🎯 DISPATCHING TOP UNBLOCKED TICKET: {candidate_key}")
                            print(f" -> Title: {candidate.get('title')}")
                            print(f" -> Score: {score} | Effort: {sp} Story Points | Priority: {prio} | Unblocks: {unblocks} task(s)")
                            print(f" -> Reason: {candidate.get('recommendedOrderReason')}")
                            if blocked_queue:
                                blocked_summary = ", ".join([f"{b.get('key')} (needs {b.get('activeBlockers', [{}])[0].get('key', 'predecessor')})" for b in blocked_queue[:3]])
                                print(f" -> Downstream Waiting: {blocked_summary}")
                            print("=" * 65 + "\n")

                            processed_tickets.add(candidate_id)
                            last_logged_ticket = candidate_key
                            if pipeline_runner_callback:
                                asyncio.create_task(pipeline_runner_callback(candidate))

        except Exception as err:
            # Silent catch to prevent crash on backend reboot
            pass
