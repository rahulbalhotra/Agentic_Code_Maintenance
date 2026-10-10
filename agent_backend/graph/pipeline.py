from langgraph.graph import StateGraph, START, END
from .state import AgentState
from ..agents.vigilant import run_vigilant_agent
from ..agents.planner import run_planner_agent
from ..agents.researcher import run_researcher_agent
from ..agents.coder import run_coder_agent
from ..agents.tester import run_tester_agent
from ..agents.release import run_release_agent

def create_agent_pipeline():
    """Constructs the autonomous 6-agent LangGraph pipeline."""
    workflow = StateGraph(AgentState)

    # Register 6 Autonomous Nodes
    workflow.add_node("vigilant", run_vigilant_agent)
    workflow.add_node("planner", run_planner_agent)
    workflow.add_node("researcher", run_researcher_agent)
    workflow.add_node("coder", run_coder_agent)
    workflow.add_node("tester", run_tester_agent)
    workflow.add_node("release", run_release_agent)

    # Define Autonomous Linear Edges
    workflow.add_edge(START, "vigilant")
    workflow.add_edge("vigilant", "planner")
    workflow.add_edge("planner", "researcher")
    workflow.add_edge("researcher", "coder")
    workflow.add_edge("coder", "tester")
    workflow.add_edge("tester", "release")
    workflow.add_edge("release", END)

    return workflow.compile()

# Global compiled pipeline instance
app_pipeline = create_agent_pipeline()
