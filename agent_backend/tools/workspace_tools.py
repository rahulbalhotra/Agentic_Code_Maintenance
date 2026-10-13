import os
import subprocess
from pathlib import Path
from ..config import WORKSPACE_REPO

def get_workspace_files():
    """List files in workspace/fb_clone_repo."""
    if not WORKSPACE_REPO.exists():
        return []
    files = []
    for root, _, filenames in os.walk(WORKSPACE_REPO):
        if ".git" in root:
            continue
        for f in filenames:
            rel = Path(root).relative_to(WORKSPACE_REPO) / f
            files.append(str(rel).replace("\\", "/"))
    return files

def read_workspace_file(file_path: str) -> str:
    """Read contents of a workspace file."""
    full_path = WORKSPACE_REPO / file_path
    if full_path.exists():
        return full_path.read_text(encoding="utf-8")
    return ""

def write_workspace_file(file_path: str, content: str) -> bool:
    """Write/update content of a workspace file."""
    full_path = WORKSPACE_REPO / file_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding="utf-8")
    return True

def git_commit_changes(commit_message: str) -> dict:
    """Stage all changes and commit in the workspace git repo."""
    try:
        git_dir = WORKSPACE_REPO / ".git"
        if not git_dir.exists():
            subprocess.run(["git", "init"], cwd=WORKSPACE_REPO, check=True)
            subprocess.run(["git", "add", "."], cwd=WORKSPACE_REPO, check=True)
            subprocess.run(["git", "commit", "-m", "Initial skeleton for fb_clone_repo"], cwd=WORKSPACE_REPO, check=True)

        # Check if changes exist
        status_out = subprocess.check_output(["git", "status", "--porcelain"], cwd=WORKSPACE_REPO, text=True)
        if not status_out.strip():
            return {"status": "clean", "message": "No changes to commit"}
        
        subprocess.check_call(["git", "add", "."], cwd=WORKSPACE_REPO)
        subprocess.check_call(["git", "commit", "-m", commit_message], cwd=WORKSPACE_REPO)
        
        hash_out = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=WORKSPACE_REPO, text=True).strip()
        return {"status": "committed", "hash": hash_out, "message": commit_message}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def create_or_update_pull_request(ticket_key: str, ticket_title: str, description: str = "", changed_files: list = None) -> dict:
    """Create or update a pull request in workspace/fb_clone_repo/pull_requests.json."""
    import json
    from datetime import datetime
    
    pr_file = WORKSPACE_REPO / "pull_requests.json"
    prs = []
    if pr_file.exists():
        try:
            prs = json.loads(pr_file.read_text(encoding="utf-8"))
        except Exception:
            prs = []
            
    existing_pr = next((p for p in prs if p.get("linkedIssue") == ticket_key), None)
    if existing_pr:
        existing_pr["title"] = f"feat({ticket_key.lower()}): {ticket_key} {ticket_title}"
        if description:
            existing_pr["description"] = description
        if changed_files:
            existing_pr["changedFiles"] = list(dict.fromkeys(existing_pr.get("changedFiles", []) + changed_files))
        existing_pr["commits"] = existing_pr.get("commits", 1) + 1
        pr_file.write_text(json.dumps(prs, indent=2), encoding="utf-8")
        return existing_pr

    new_number = len(prs) + 1
    new_pr = {
        "id": f"PR-{new_number}",
        "number": new_number,
        "title": f"feat({ticket_key.lower()}): {ticket_key} {ticket_title}",
        "description": description or f"Autonomous multi-agent implementation for Jira ticket {ticket_key}.",
        "status": "OPEN",
        "branch": f"feature/{ticket_key.lower()}-agent-patch",
        "base": "main",
        "author": "langgraph-agent",
        "authorAvatar": "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=80&h=80&fit=crop",
        "linkedIssue": ticket_key,
        "commits": 1,
        "changedFiles": changed_files if changed_files else ["styles.css", "app.js"],
        "createdAt": datetime.now().isoformat(),
        "mergedAt": None
    }
    prs.insert(0, new_pr) # Prepend newest PR to front
    pr_file.write_text(json.dumps(prs, indent=2), encoding="utf-8")
    return new_pr

