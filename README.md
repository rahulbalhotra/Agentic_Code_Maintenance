# Jira Graph Agent - Autonomous Multi-Agent Engineering System with Neo4j Desktop

A full-stack, enterprise-grade Autonomous Jira Agent system connected directly with a local **Neo4j Desktop Graph Database** and powered by a **5-Agent LangGraph Orchestration Pipeline**.

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Neo4j Desktop Database          |
                      |        bolt://localhost:7687          |
                      |  (:Issue) -[:BLOCKS]-> (:Issue)      |
                      |  (:Doc)   -[:DOCUMENTS]-> (:Issue)    |
                      +-------------------+-------------------+
                                          |
                        Cypher Queries    |  Bolt Protocol
                                          v
+---------------------------------------------------------------------------------+
|                       Express.js API Backend (Port 4000)                        |
|  - Graph CRUD: /api/graph, /api/issues, /api/connections                         |
|  - Git Workspace: /api/workspace/repos, /api/workspace/commits, /api/workspace/diff |
|  - Knowledge Base: /api/knowledge-base                                          |
|  - Webhook Dispatcher: forwards new tickets to Python Agent Backend             |
+---------------------+-------------------------------------+---------------------+
                      |                                     ^
       Vite Proxy     | REST API                            | Status Webhook
                      v                                     |
+---------------------+------------------+  +---------------+---------------------+
|        Vite React UI (Port 5173)       |  |  FastAPI Multi-Agent Backend (8000) |
|  - Jira Kanban Board (White & Blue)    |  |  - Watchdog Stream Poller           |
|  - Neo4j Interactive Graph Visualizer  |  |  - LangGraph 5-Agent Pipeline:      |
|  - Autonomous Agents Live Flowchart    |  |     1. Vigilant Agent               |
|  - GitHub-style PR & Code Diff Viewer  |  |     2. Planner Agent                |
|  - Knowledge Base Architecture Docs    |  |     3. Researcher Agent             |
+----------------------------------------+  |     4. Coder Agent                  |
                                            |     5. Test & Auditor Agent         |
                                            |  - Workspace Git Auto-Commit & PR   |
                                            +-------------------------------------+
                                                               |
                                            Auto-Inject Patches| Git Commits
                                                               v
                                            +-------------------------------------+
                                            | Target Repo: /workspace/fb_clone_repo|
                                            | HTML, CSS, JS Facebook Clone + Git  |
                                            +-------------------------------------+
```

---

## Key Features

### 1. Jira Kanban Board & Neo4j Integration
- **Kanban Workflow**: 5 statuses (**Backlog**, **To Do**, **In Progress**, **Code Review**, **Done**) with HTML5 drag-and-drop.
- **Neo4j Graph Database**: Stores issues as `:Issue` nodes and links as directed Cypher relationships (`BLOCKS`, `DEPENDS_ON`, `RELATES_TO`, `SUBTASK_OF`, `DUPLICATES`).
- **White and Blue Design Theme**: Clean Jira UI with dark blue action buttons (`#0b2545` / `#133a6f`).

### 2. Autonomous Multi-Agent LangGraph Pipeline (`agent_backend`)
- **Vigilant Agent**: Monitors new tickets via background watchdog polling, triages requirements, computes risk, and transitions tickets to `IN_PROGRESS`.
- **Planner Agent**: Deconstructs requirements into modular technical milestones and identifies file targets in the codebase.
- **Researcher Agent**: Analyzes codebase files, CSS design tokens, and Neo4j knowledge docs to formulate guardrails.
- **Coder Agent**: Synthesizes and writes implementation patches directly into the `/workspace/fb_clone_repo` codebase.
- **Test & Auditor Agent**: Runs security audit, validates code standards, commits verified code to Git, creates an open Pull Request in `pull_requests.json`, and updates the Jira ticket to `REVIEW`.

### 3. Interactive UI Tabs
1. **Kanban**: Full Jira Kanban board with search, filters, story points, and quick ticket creation.
2. **Neo4j Graph**: Interactive SVG graph visualizer with live node positions, directed relationship arrows, and Cypher query inspector.
3. **Autonomous Agents**: Real-time LangGraph execution flowchart, active agent pulse indicator, live terminal thought stream, and manual run triggers.
4. **Repo & Diff**: GitHub-style diff viewer supporting single-commit diffs, range diffs, unified/split views, and PR review tray.
5. **Knowledge Base**: Architecture rules, CSS tokens, and component guidelines stored in Neo4j.

---

## Getting Started

### 1. Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+)
- **Neo4j Desktop** (running on `bolt://localhost:7687`, default username `neo4j`)

### 2. Run All Services Concurrently
Double-click `start.bat` or run from the project root:
```bash
start.bat
# or
npm run dev
```

This starts:
- **Express Backend**: [http://localhost:4000](http://localhost:4000)
- **Vite Frontend**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Agent Backend**: [http://localhost:8000](http://localhost:8000)

---

## Connecting to Neo4j Desktop

1. Open **Neo4j Desktop** and start your local database.
2. Open the application at [http://localhost:5173](http://localhost:5173).
3. The top navbar shows a **Neo4j Live** status indicator when connected.
4. To modify connection parameters (e.g., custom password or database name), click the **Neo4j Status** button or **Database icon** in the top navbar, test the connection, and save.
