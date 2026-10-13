# Jira Graph Agent - Autonomous Multi-Agent Engineering System with Neo4j

A full-stack, enterprise-grade Autonomous Jira Agent system connected directly with a local **Neo4j Graph Database** and powered by an **Adaptive Dynamic LangGraph Multi-Agent Orchestration Pipeline**.

---

## Component Port Architecture

Each component operates on a dedicated, non-conflicting port:

| Component | Default Port | Protocol | Config Variable | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Vite React UI** | `5173` | HTTP | `CLIENT_PORT` / `VITE_CLIENT_PORT` | Frontend Jira Kanban, Flowchart & Diff View |
| **Express API Server** | `4000` | HTTP / REST | `SERVER_PORT` / `PORT` | Kanban CRUD, Git service, Knowledge Base |
| **Python Agent Backend** | `8000` | HTTP / SSE | `AGENT_PORT` | FastAPI + LangGraph Dynamic Multi-Agent Engine |
| **Neo4j Graph Database** | `7687` | Bolt | `NEO4J_URI` | Issue nodes & Cypher relationship graph |
| **Neo4j Browser** | `7474` | HTTP | `NEO4J_HTTP_PORT` | Local Neo4j Desktop database web explorer |

---

## Architecture Overview

```
                      +---------------------------------------+
                      |       Neo4j Desktop Database          |
                      |        bolt://localhost:7687          |
                      |  (:Issue) -[:BLOCKS]-> (:Issue)      |
                      |  (:Doc)   -[:DOCUMENTED_IN]-> (:Issue)|
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
|  - Neo4j Interactive Graph Visualizer  |  |  - LangGraph Dynamic Pipeline:      |
|  - Adaptive Dynamic Agent Flowchart    |  |     1. Vigilant Monitor             |
|  - GitHub-style PR & Code Diff Viewer  |  |     2. Planner Agent (Scope router) |
|  - Knowledge Base Architecture Docs    |  |     3. Researcher Agent (Optional)  |
+----------------------------------------+  |     4. Coder Agent                  |
                                            |     5. Test & Auditor Agent         |
                                            |     6. Release & Graph Sync Agent   |
                                            +-------------------------------------+
                                                               |
                                            Auto-Inject Patches| Git Commits & PRs
                                                               v
                                            +-------------------------------------+
                                            | Target Repo: /workspace/fb_clone_repo|
                                            | HTML, CSS, JS Facebook Clone + Git  |
                                            +-------------------------------------+
```

---

## Smooth Installation & Setup on Any System

### Prerequisites
- **Node.js** (v18+)
- **Python** (3.10+) with `venv`
- **Git**
- Optional: **Neo4j Desktop** (system automatically falls back to in-memory mode if Neo4j is offline)

### One-Command Setup (All Operating Systems)
Run the automated cross-platform setup script from the project root:
```bash
npm run setup
```
This automated setup:
1. Detects system Python (`python3` on Unix/macOS, `python` on Windows).
2. Installs root, Express server, and Vite client npm packages.
3. Automatically sets up the Python virtual environment (`agent_backend/.venv`) and installs `requirements.txt`.
4. Copies `.env.example` templates to `.env` if missing.
5. Verifies and initializes the isolated Git repository in `workspace/fb_clone_repo`.
6. Checks port availability across ports `5173`, `4000`, `8000`, and `7687`.

---

## Running the Application

### Option A: Universal NPM Command (Windows, macOS, Linux)
```bash
npm run dev
```
Starts all 3 services concurrently with color-coded logging.

### Option B: One-Click Launchers
* **Windows**: Double-click `start.bat` or run `.\run.bat`
* **macOS / Linux**:
  ```bash
  chmod +x start.sh
  ./start.sh
  ```

---

## Dynamic Orchestration Flow

The LangGraph multi-agent pipeline uses **adaptive conditional routing**:

1. **Direct Fast-Track Route** (e.g. *"update button color"*, UI styling, font adjustments):
   $$\text{START} \longrightarrow \text{Vigilant} \longrightarrow \text{Planner} \xrightarrow{\text{bypass research}} \text{Coder} \longrightarrow \text{Release \& Graph Sync} \longrightarrow \text{END}$$
   * Skips unnecessary research and security audits.
   * Coder directly applies the patch and commits changes to Git.
   * Release Agent updates the Jira Kanban board to `DONE` and syncs documentation & commits into Neo4j.

2. **Full Pipeline Route** (Complex multi-module architectural features):
   $$\text{START} \longrightarrow \text{Vigilant} \longrightarrow \text{Planner} \longrightarrow \text{Researcher} \longrightarrow \text{Coder} \longrightarrow \text{Tester} \longrightarrow \text{Release} \longrightarrow \text{END}$$

---

## Customizing Ports

All ports can be overridden in `.env`:
```env
CLIENT_PORT=5173
SERVER_PORT=4000
AGENT_PORT=8000
NEO4J_URI=bolt://localhost:7687
```
