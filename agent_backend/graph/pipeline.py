from langgraph.graph import StateGraph, START, END
from .state import AgentState
from ..agents.vigilant import run_vigilant_agent
from ..agents.planner import run_planner_agent
from ..agents.researcher import run_researcher_agent
from ..agents.coder import run_coder_agent
from ..agents.tester import run_tester_agent
from ..agents.release import run_release_agent

def route_after_planner(state: AgentState) -> str:
    """
    Dynamic routing after Planner:
    - If requires_research is True: Route to 'researcher' for deep codebase & Neo4j KB scan.
    - If requires_research is False (e.g. 'update button color', CSS tweaks): Directly invoke 'coder'.
    """
    if state.get("requires_research", True):
        return "researcher"
    return "coder"

def route_after_coder(state: AgentState) -> str:
    """
    Dynamic routing after Coder:
    - If requires_testing is True: Route to 'tester' for security/quality audit.
    - If requires_testing is False: Directly invoke 'release' to sync Neo4j Knowledge Graph.
    """
    if state.get("requires_testing", True):
        return "tester"
    return "release"

def route_after_tester(state: AgentState) -> str:
    """
    Dynamic routing after Tester:
    - If audit PASSED: Route to 'release' for Knowledge Graph sync & Kanban update.
    - If audit REJECTED: Halt pipeline (END).
    """
    tester_res = state.get("tester_result", {})
    if tester_res.get("verdict") in ["PASSED", "PASSED_WITH_WARNINGS"]:
        return "release"
    return END

def create_agent_pipeline():
    """Constructs the dynamic multi-agent LangGraph pipeline with adaptive conditional routing."""
    workflow = StateGraph(AgentState)

    # Register 6 Autonomous Nodes
    workflow.add_node("vigilant", run_vigilant_agent)
    workflow.add_node("planner", run_planner_agent)
    workflow.add_node("researcher", run_researcher_agent)
    workflow.add_node("coder", run_coder_agent)
    workflow.add_node("tester", run_tester_agent)
    workflow.add_node("release", run_release_agent)

    # Entry edge: START -> vigilant -> planner
    workflow.add_edge(START, "vigilant")
    workflow.add_edge("vigilant", "planner")

    # Dynamic Conditional Edge 1: Planner -> Researcher OR Coder directly
    workflow.add_conditional_edges(
        "planner",
        route_after_planner,
        {
            "researcher": "researcher",
            "coder": "coder"
        }
    )

    # Researcher -> Coder
    workflow.add_edge("researcher", "coder")

    # Dynamic Conditional Edge 2: Coder -> Tester OR Release directly (Knowledge Graph sync)
    workflow.add_conditional_edges(
        "coder",
        route_after_coder,
        {
            "tester": "tester",
            "release": "release"
        }
    )

    # Dynamic Conditional Edge 3: Tester -> Release (if pass) OR END (if reject)
    workflow.add_conditional_edges(
        "tester",
        route_after_tester,
        {
            "release": "release",
            END: END
        }
    )

    # Release -> END
    workflow.add_edge("release", END)

    return workflow.compile()

# Global compiled dynamic pipeline instance
app_pipeline = create_agent_pipeline()
