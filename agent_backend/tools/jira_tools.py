import httpx
from typing import Dict, Any, List, Optional
from ..config import EXPRESS_API_URL

async def fetch_jira_ticket(ticket_id_or_key: str) -> dict:
    """Fetch ticket details from Express graph API."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.get(f"{EXPRESS_API_URL}/graph")
            if res.status_code == 200:
                nodes = res.json().get("nodes", [])
                for n in nodes:
                    if n.get("id") == ticket_id_or_key or n.get("key") == ticket_id_or_key:
                        return n
        except Exception as e:
            print(f"[JiraTools] Error fetching ticket: {e}")
    return {}

async def update_jira_ticket_status(ticket_id_or_key: str, new_status: str) -> bool:
    """Update status of a ticket in Neo4j/Express (supports both id and key)."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.put(f"{EXPRESS_API_URL}/issues/{ticket_id_or_key}", json={"status": new_status})
            if res.status_code == 200:
                print(f"[JiraTools] Updated ticket {ticket_id_or_key} to status: {new_status}")
                return True
            else:
                print(f"[JiraTools] Update ticket failed ({res.status_code}): {res.text}")
        except Exception as e:
            print(f"[JiraTools] Error updating ticket status: {e}")
    return False

async def fetch_knowledge_base_context() -> str:
    """Fetch all docs from Neo4j/Express Knowledge Base so agents know about architecture & past progress."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.get(f"{EXPRESS_API_URL}/knowledge-base")
            if res.status_code == 200:
                docs = res.json()
                formatted = []
                for d in docs:
                    formatted.append(
                        f"### [{d.get('category', 'Architecture')}] {d.get('key')}: {d.get('title')}\n"
                        f"Summary: {d.get('summary', '')}\n"
                        f"Content excerpt: {d.get('content', '')[:300]}...\n"
                    )
                if formatted:
                    return "\n".join(formatted)
        except Exception as e:
            print(f"[JiraTools] Error fetching KB: {e}")
    return "Facebook design system tokens: Primary Meta Blue #0866FF, Surface #FFFFFF, Dark #18191A."

async def create_knowledge_base_doc(doc_data: dict) -> dict:
    """Creates a new Knowledge Base Doc in Neo4j/Express and links to associated issue."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(f"{EXPRESS_API_URL}/knowledge-base", json=doc_data)
            if res.status_code in [200, 201]:
                return res.json()
            else:
                print(f"[JiraTools] Error creating KB doc ({res.status_code}): {res.text}")
        except Exception as e:
            print(f"[JiraTools] Error creating KB doc: {e}")
    return {}

async def register_graph_commit(commit_data: dict) -> dict:
    """Registers a git commit node in Neo4j and connects it to the associated Jira issue."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(f"{EXPRESS_API_URL}/graph/commits", json=commit_data)
            if res.status_code in [200, 201]:
                return res.json()
            else:
                print(f"[JiraTools] Error registering graph commit ({res.status_code}): {res.text}")
        except Exception as e:
            print(f"[JiraTools] Error registering graph commit: {e}")
    return {}

async def register_graph_pull_request(pr_data: dict) -> dict:
    """Registers a PR node in Neo4j and connects it to the associated Jira issue."""
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            res = await client.post(f"{EXPRESS_API_URL}/graph/pull-requests", json=pr_data)
            if res.status_code in [200, 201]:
                return res.json()
            else:
                print(f"[JiraTools] Error registering graph PR ({res.status_code}): {res.text}")
        except Exception as e:
            print(f"[JiraTools] Error registering graph PR: {e}")
    return {}

async def sync_release_to_graph(
    ticket_id: str,
    ticket_key: str,
    ticket_title: str,
    final_status: str,
    git_commit: dict,
    pull_request: Optional[dict],
    kb_doc_info: dict
) -> Dict[str, Any]:
    """
    Synchronizes ticket status to Kanban board, records progress in Neo4j Knowledge Base,
    registers git commits in graph, and creates all directed Cypher relationships.
    """
    results: Dict[str, Any] = {}

    # 1. Update ticket status on Kanban board
    target_id = ticket_id or ticket_key
    status_updated = await update_jira_ticket_status(target_id, final_status)
    # If target_id was key, also try id or vice versa
    if not status_updated and ticket_key:
        status_updated = await update_jira_ticket_status(ticket_key, final_status)
    results["kanban_updated"] = status_updated
    results["final_status"] = final_status

    # 2. Register Git Commit node in Graph
    commit_hash = git_commit.get("hash") or "HEAD"
    commit_msg = git_commit.get("message") or f"{ticket_key}: Automated patch verified"
    commit_res = await register_graph_commit({
        "id": f"commit-{commit_hash[:7]}",
        "hash": commit_hash[:7],
        "message": commit_msg,
        "author": "Autonomous Agent",
        "linkedIssueKey": ticket_key
    })
    results["commit_registered"] = bool(commit_res)

    # 3. Register Pull Request node in Graph
    if pull_request and pull_request.get("id"):
        pr_res = await register_graph_pull_request({
            "id": f"pr-{pull_request.get('number', 1)}",
            "number": pull_request.get("number", 1),
            "title": pull_request.get("title", f"{ticket_key} Implementation"),
            "status": "OPEN",
            "branch": pull_request.get("branch", "feature/autonomous-patch"),
            "author": "Autonomous Agent",
            "linkedIssueKey": ticket_key
        })
        results["pr_registered"] = bool(pr_res)

    # 4. Create Knowledge Base Documentation in Graph
    kb_res = await create_knowledge_base_doc({
        "id": f"kb-{ticket_key.lower()}",
        "key": f"KB-{ticket_key}",
        "title": kb_doc_info.get("title", f"Architecture & Progress: {ticket_title}"),
        "category": "Feature Progress & Architecture",
        "author": "Release & Knowledge Agent",
        "summary": kb_doc_info.get("summary", f"Implementation blueprint, modified components, and guardrails for {ticket_key}."),
        "content": kb_doc_info.get("content", f"### {ticket_key}: {ticket_title}\n\nCompleted successfully by autonomous multi-agent engineering pipeline."),
        "linkedIssueKey": ticket_key
    })
    results["kb_doc_registered"] = bool(kb_res)

    return results
