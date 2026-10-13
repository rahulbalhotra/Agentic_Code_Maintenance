from typing import TypedDict, List, Dict, Any, Optional

class AgentThought(TypedDict):
    agent: str
    timestamp: str
    thought: str
    action: str

class AgentState(TypedDict):
    ticket_id: str
    ticket_key: str
    ticket_title: str
    ticket_description: str
    ticket_priority: str
    ticket_type: str
    
    current_agent: str
    pipeline_status: str
    
    vigilant_result: Dict[str, Any]
    planner_result: Dict[str, Any]
    researcher_result: Dict[str, Any]
    coder_result: Dict[str, Any]
    tester_result: Dict[str, Any]
    release_result: Dict[str, Any]
    
    requires_research: Optional[bool]
    requires_testing: Optional[bool]
    execution_route: Optional[str]
    skipped_agents: Optional[List[str]]
    
    thoughts: List[Dict[str, Any]]
    modified_files: List[str]
    git_commit: Dict[str, Any]
    pull_request: Optional[Dict[str, Any]]
    error: Optional[str]
