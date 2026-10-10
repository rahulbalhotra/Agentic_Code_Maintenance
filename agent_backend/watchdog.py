import asyncio
import httpx
from .config import EXPRESS_API_URL

processed_tickets = set()
pipeline_runner_callback = None

def register_pipeline_runner(callback):
    global pipeline_runner_callback
    pipeline_runner_callback = callback

async def start_vigilant_watchdog():
    """Background watchdog task that keeps an eye on Jira tickets continuously."""
    print("[Vigilant Watchdog] Active & monitoring Jira Kanban stream...")
    
    # Pre-populate already existing tickets on boot so it only triggers on new tickets
    async with httpx.AsyncClient(timeout=5.0) as client:
        try:
            res = await client.get(f"{EXPRESS_API_URL}/graph")
            if res.status_code == 200:
                nodes = res.json().get("nodes", [])
                for n in nodes:
                    processed_tickets.add(n.get("id"))
                print(f"[Vigilant Watchdog] Initialized with {len(processed_tickets)} known tickets.")
        except Exception as e:
            print(f"[Vigilant Watchdog] Initial poll warning: {e}")

    while True:
        try:
            await asyncio.sleep(6) # Poll interval
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{EXPRESS_API_URL}/graph")
                if res.status_code == 200:
                    nodes = res.json().get("nodes", [])
                    for node in nodes:
                        t_id = node.get("id")
                        t_status = node.get("status", "TODO")
                        if t_id and t_id not in processed_tickets and t_status in ["TODO", "BACKLOG"]:
                            print(f"[Vigilant Watchdog] [NEW TICKET] Detected: {node.get('key')} - {node.get('title')}")
                            processed_tickets.add(t_id)
                            if pipeline_runner_callback:
                                asyncio.create_task(pipeline_runner_callback(node))
        except Exception as err:
            pass
