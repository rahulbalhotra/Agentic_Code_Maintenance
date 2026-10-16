import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  ListTree, 
  Search, 
  Code2, 
  CheckCircle2, 
  Clock, 
  Play, 
  RotateCcw, 
  GitCommit, 
  GitPullRequest, 
  GitMerge,
  BookOpen,
  AlertCircle, 
  ChevronRight, 
  FileCode, 
  Terminal, 
  Sparkles, 
  ExternalLink,
  Flame,
  Activity,
  Layers,
  Zap,
  Lock,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { fetchPipelineStatus, fetchPipelineHistory, triggerPipeline, fetchAgentHealth, fetchPrioritizedIssues } from '../services/api.js';

const AGENT_STAGES = [
  { id: 'vigilant', label: 'Vigilant Agent', icon: ShieldCheck, color: '#0284c7', desc: 'Triage & Status -> IN_PROGRESS' },
  { id: 'planner', label: 'Planner Agent', icon: ListTree, color: '#2563eb', desc: 'Technical Milestones & Steps' },
  { id: 'researcher', label: 'Researcher Agent', icon: Search, color: '#7c3aed', desc: 'Codebase & KB Context' },
  { id: 'coder', label: 'Coder Agent', icon: Code2, color: '#0b2545', desc: 'Synthesis & Code Patches' },
  { id: 'tester', label: 'Test & Auditor', icon: CheckCircle2, color: '#059669', desc: 'Security Audit & Git Commit' },
  { id: 'release', label: 'Release & Graph Sync', icon: GitMerge, color: '#9333ea', desc: 'Kanban -> DONE & Graph KB Sync' }
];

export default function AgentPipelineView({ issues = [], onNavigateToRepo, onSelectIssue, onNavigateToGraph, onNavigateToKB }) {
  const [pipelineState, setPipelineState] = useState(null);
  const [history, setHistory] = useState([]);
  const [health, setHealth] = useState(null);
  const [queueData, setQueueData] = useState({ readyQueue: [], blockedQueue: [], allIssues: [], nextRecommended: null });
  const [selectedTicketId, setSelectedTicketId] = useState('');
  const [isTriggering, setIsTriggering] = useState(false);
  const [activeTab, setActiveTab] = useState('thoughts'); // 'thoughts' | 'artifacts' | 'history' | 'queue'
  const terminalEndRef = useRef(null);

  // Real-time Server-Sent Events (SSE) Stream + Fallback Polling
  useEffect(() => {
    let isMounted = true;
    let eventSource = null;

    const setupSSE = () => {
      try {
        const streamUrl = (import.meta.env.VITE_AGENT_URL || 'http://localhost:8000/api').replace(/\/api\/?$/, '') + '/api/pipeline/stream';
        eventSource = new EventSource(streamUrl);

        eventSource.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed.type === 'init' || parsed.type === 'state' || parsed.type === 'completed' || parsed.type === 'node_transition') {
              const incoming = parsed.data?.state || parsed.data;
              if (incoming && incoming.ticket_key) {
                setPipelineState(incoming);
              }
            } else if (parsed.type === 'thought') {
              const { thought_entry, current_agent, action, pipeline_status } = parsed.data;
              setPipelineState(prev => {
                if (!prev) return prev;
                const existingThoughts = prev.thoughts || [];
                const alreadyExists = existingThoughts.some(
                  t => t.timestamp === thought_entry.timestamp && t.thought === thought_entry.thought
                );
                return {
                  ...prev,
                  current_agent: current_agent || prev.current_agent,
                  last_action: action || prev.last_action,
                  pipeline_status: pipeline_status || prev.pipeline_status,
                  thoughts: alreadyExists ? existingThoughts : [...existingThoughts, thought_entry]
                };
              });
            }
          } catch (e) {
            console.error('SSE parse error:', e);
          }
        };

        eventSource.onerror = () => {
          if (eventSource) eventSource.close();
        };
      } catch (err) {
        console.warn('SSE connection unavailable, using polling.');
      }
    };

    setupSSE();

    // Polling fallback and periodic history/health check
    const poll = async () => {
      try {
        const [st, hist, hl, queue] = await Promise.all([
          fetchPipelineStatus().catch(() => null),
          fetchPipelineHistory().catch(() => []),
          fetchAgentHealth().catch(() => null),
          fetchPrioritizedIssues().catch(() => null)
        ]);
        if (isMounted) {
          if (st) {
            setPipelineState(prev => {
              if (prev && prev.pipeline_status === 'running' && prev.thoughts?.length > (st.thoughts?.length || 0)) {
                return { ...st, thoughts: prev.thoughts };
              }
              return st;
            });
          }
          if (hist) setHistory(hist);
          if (hl) setHealth(hl);
          if (queue) setQueueData(queue);
        }
      } catch (err) {}
    };

    poll();
    const interval = setInterval(poll, 1800);

    return () => {
      isMounted = false;
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  // Auto-scroll terminal log when new thoughts arrive
  useEffect(() => {
    if (activeTab === 'thoughts' && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pipelineState?.thoughts?.length, activeTab]);

  const handleTriggerRun = async () => {
    const ticket = issues.find(i => i.id === selectedTicketId) || issues[0];
    if (!ticket) return;

    setIsTriggering(true);
    try {
      await triggerPipeline({
        id: ticket.id,
        key: ticket.key,
        title: ticket.title,
        description: ticket.description || '',
        priority: ticket.priority || 'MEDIUM',
        type: ticket.type || 'Task',
        status: ticket.status || 'TODO'
      });
      const st = await fetchPipelineStatus();
      setPipelineState(st);
    } catch (e) {
      console.error('Trigger pipeline error:', e);
    } finally {
      setIsTriggering(false);
    }
  };

  const currentAgent = pipelineState?.current_agent || 'idle';
  const pipelineStatus = pipelineState?.pipeline_status || 'idle';
  const lastAction = pipelineState?.last_action || 'System Idle';
  const thoughts = pipelineState?.thoughts || [];

  const getStageStatus = (stageId, index) => {
    const skipped = pipelineState?.skipped_agents || [];
    if (skipped.includes(stageId)) return 'skipped';

    if (pipelineStatus === 'completed') return 'completed';
    if (currentAgent === stageId) return 'running';

    const order = ['vigilant', 'planner', 'researcher', 'coder', 'tester', 'release', 'completed'];
    const currentIndex = order.indexOf(currentAgent);
    const stageIndex = order.indexOf(stageId);

    if (currentIndex > stageIndex) return 'completed';
    return 'idle';
  };

  const executionRoute = pipelineState?.execution_route;

  return (
    <div style={{ maxWidth: '1350px', margin: '0 auto', padding: '24px 20px', fontFamily: 'var(--font-family, sans-serif)' }}>
      {/* Top Banner & Control Deck */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #bfdbfe',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 4px 20px rgba(11, 37, 69, 0.06)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: '#ebf3ff',
              color: '#0052cc',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Sparkles size={14} /> Dynamic LangGraph Multi-Agent
            </span>
            {executionRoute === 'fast_track' && (
              <span style={{
                background: '#fef3c7',
                color: '#b45309',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Zap size={14} /> Fast-Track Route (Planner ➔ Coder ➔ Release & Graph Sync)
              </span>
            )}
            {executionRoute === 'full_pipeline' && (
              <span style={{
                background: '#f3e8ff',
                color: '#7e22ce',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Layers size={14} /> Full Pipeline (Planner ➔ Researcher ➔ Coder ➔ Tester ➔ Release)
              </span>
            )}
            <span style={{
              background: health?.status === 'healthy' ? '#ecfdf5' : '#fff1f2',
              color: health?.status === 'healthy' ? '#059669' : '#e11d48',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              {health?.status === 'healthy' ? `● Engine Online (Port ${health?.port || 8000})` : '○ Backend Connecting...'}
            </span>
            <span style={{
              background: '#f1f5f9',
              color: '#475569',
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: '600'
            }}>
              Model: {health?.model || 'gemini-3.6-flash'}
            </span>
          </div>

          <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0b2545', margin: '0 0 6px 0' }}>
            Adaptive Multi-Agent Engineering Pipeline
          </h2>
          <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
            Dynamic LangGraph Orchestration: Planner analyzes ticket scope & bypasses research for direct tasks (e.g. button color), directly invoking Coder and updating the Knowledge Graph.
          </p>
        </div>

        {/* Manual Trigger Widget */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <select
            value={selectedTicketId}
            onChange={(e) => setSelectedTicketId(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.85rem',
              background: '#ffffff',
              color: '#0f172a',
              fontWeight: '500',
              maxWidth: '240px'
            }}
          >
            <option value="">Select Jira Ticket to Run...</option>
            {issues.map(iss => (
              <option key={iss.id} value={iss.id}>
                {iss.key}: {iss.title.substring(0, 26)}...
              </option>
            ))}
          </select>

          <button
            onClick={handleTriggerRun}
            disabled={isTriggering || pipelineStatus === 'running'}
            className="btn-dark-blue"
            style={{
              padding: '8px 16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: (isTriggering || pipelineStatus === 'running') ? 0.6 : 1,
              cursor: (isTriggering || pipelineStatus === 'running') ? 'not-allowed' : 'pointer'
            }}
          >
            <Play size={15} />
            {pipelineStatus === 'running' ? 'Pipeline Active...' : 'Trigger Agent Run'}
          </button>
        </div>
      </div>

      {/* Interactive Agent Flowchart Track */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={18} color="#0052cc" />
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: '#0f172a' }}>
              Execution Flowchart (6-Agent Autonomous Chain)
            </h3>
            {pipelineState?.ticket_key && pipelineState.ticket_key !== 'None' && (
              <span style={{
                background: '#ebf3ff',
                color: '#0052cc',
                padding: '3px 10px',
                borderRadius: '6px',
                fontSize: '0.8rem',
                fontWeight: '700'
              }}>
                Target: {pipelineState.ticket_key} - {pipelineState.ticket_title}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {pipelineStatus === 'running' && (
              <span style={{
                fontSize: '0.78rem',
                fontWeight: '700',
                padding: '4px 12px',
                borderRadius: '16px',
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb', animation: 'pulse 1.2s infinite' }} />
                Active Action: {lastAction}
              </span>
            )}

            <span style={{
              fontSize: '0.8rem',
              fontWeight: '700',
              padding: '4px 12px',
              borderRadius: '16px',
              background: pipelineStatus === 'running' ? '#dbeafe' : pipelineStatus === 'completed' ? '#dcfce7' : '#f1f5f9',
              color: pipelineStatus === 'running' ? '#1d4ed8' : pipelineStatus === 'completed' ? '#15803d' : '#64748b'
            }}>
              Status: {pipelineStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* The 6-Agent Visual Track */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))',
          gap: '14px',
          position: 'relative'
        }}>
          {AGENT_STAGES.map((stage, idx) => {
            const status = getStageStatus(stage.id, idx);
            const isCurrent = currentAgent === stage.id;
            const Icon = stage.icon;

            return (
              <div
                key={stage.id}
                style={{
                  background: isCurrent ? '#f0f7ff' : status === 'completed' ? '#f8fafc' : status === 'skipped' ? '#fafafa' : '#ffffff',
                  border: isCurrent 
                    ? '2px solid #0052cc' 
                    : status === 'completed' 
                    ? '1.5px solid #86efac' 
                    : status === 'skipped'
                    ? '1.5px dashed #cbd5e1'
                    : '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '16px',
                  position: 'relative',
                  transition: 'all 0.3s ease',
                  opacity: status === 'skipped' ? 0.75 : 1,
                  boxShadow: isCurrent ? '0 6px 18px rgba(0, 82, 204, 0.15)' : 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: isCurrent ? '#0052cc' : status === 'completed' ? '#22c55e' : status === 'skipped' ? '#94a3b8' : '#f1f5f9',
                    color: isCurrent || status === 'completed' || status === 'skipped' ? '#ffffff' : '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={18} />
                  </div>

                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: '700',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: isCurrent ? '#bfdbfe' : status === 'completed' ? '#dcfce7' : status === 'skipped' ? '#f1f5f9' : '#f1f5f9',
                    color: isCurrent ? '#1e40af' : status === 'completed' ? '#166534' : status === 'skipped' ? '#64748b' : '#94a3b8'
                  }}>
                    {isCurrent ? 'ACTIVE' : status === 'completed' ? 'DONE' : status === 'skipped' ? 'SKIPPED' : 'PENDING'}
                  </span>
                </div>

                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#0b2545', marginBottom: '4px' }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  {stage.desc}
                </div>

                {/* Sub-metrics */}
                {status === 'skipped' && (
                  <div style={{ marginTop: '8px', fontSize: '0.72rem', fontStyle: 'italic', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={12} color="#f59e0b" /> Bypassed (Direct Route)
                  </div>
                )}
                {status === 'completed' && stage.id === 'tester' && pipelineState?.tester_result?.score && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: '700', color: '#059669' }}>
                    Score: {pipelineState.tester_result.score}/100 PASSED
                  </div>
                )}
                {status === 'completed' && stage.id === 'coder' && pipelineState?.modified_files?.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#2563eb' }}>
                    {pipelineState.modified_files.length} file(s) patched
                  </div>
                )}
                {status === 'completed' && stage.id === 'release' && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', fontWeight: '700', color: '#7c3aed' }}>
                    ✓ Moved to DONE & KB Synced
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab Switcher for Details & Logs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setActiveTab('thoughts')}
          className={activeTab === 'thoughts' ? 'btn-dark-blue' : 'btn-secondary'}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Terminal size={15} style={{ marginRight: '6px' }} />
          Live Agent Thoughts & Actions ({thoughts.length})
        </button>

        <button
          onClick={() => setActiveTab('artifacts')}
          className={activeTab === 'artifacts' ? 'btn-dark-blue' : 'btn-secondary'}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <FileCode size={15} style={{ marginRight: '6px' }} />
          Artifacts, Commit, PR & Graph Sync
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={activeTab === 'history' ? 'btn-dark-blue' : 'btn-secondary'}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Clock size={15} style={{ marginRight: '6px' }} />
          Pipeline History ({history.length})
        </button>

        <button
          onClick={() => setActiveTab('queue')}
          className={activeTab === 'queue' ? 'btn-dark-blue' : 'btn-secondary'}
          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
        >
          <Layers size={15} style={{ marginRight: '6px' }} />
          Prioritized Queue ({queueData?.readyQueue?.length || 0} Ready)
        </button>
      </div>

      {/* Tab 1: Live Agent Thoughts & Actions Stream Terminal */}
      {activeTab === 'thoughts' && (
        <div style={{
          background: '#0b132b',
          borderRadius: '16px',
          border: '1px solid #1c2541',
          padding: '20px',
          color: '#e0e1dd',
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: '0.88rem',
          maxHeight: '540px',
          overflowY: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #1c2541', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: pipelineStatus === 'running' ? '#10b981' : '#64748b'
              }} />
              <span style={{ fontWeight: '700', color: '#60a5fa' }}>LangGraph Live Event Stream</span>
              {pipelineStatus === 'running' && (
                <span style={{
                  background: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: '700'
                }}>
                  ACTIVE: {currentAgent.toUpperCase()} &bull; {lastAction}
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Auto-scroll active &bull; SSE Live Connected
            </span>
          </div>

          {thoughts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              No active pipeline run in memory. Trigger a ticket or create a new issue on the Kanban board to watch agents execute.
            </div>
          ) : (
            thoughts.map((t, idx) => (
              <div key={idx} style={{
                marginBottom: '14px',
                paddingBottom: '12px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                lineHeight: '1.5'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>[{t.timestamp}]</span>
                  <span style={{
                    color: t.agent === 'Vigilant' ? '#38bdf8' 
                         : t.agent === 'Planner' ? '#818cf8'
                         : t.agent === 'Researcher' ? '#c084fc'
                         : t.agent === 'Coder' ? '#fbbf24'
                         : t.agent === 'Test & Auditor' ? '#4ade80'
                         : t.agent === 'Release' || t.agent?.includes('Release') ? '#e879f9'
                         : '#93c5fd',
                    fontWeight: '700'
                  }}>
                    [{t.agent}]
                  </span>
                  <span style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.72rem'
                  }}>
                    {t.action}
                  </span>
                </div>
                <div style={{ color: '#f1f5f9', marginLeft: '60px' }}>
                  {t.thought}
                </div>
              </div>
            ))
          )}

          {pipelineStatus === 'running' && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#38bdf8',
              fontSize: '0.82rem',
              padding: '10px 0',
              fontStyle: 'italic'
            }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
              Agent actively reasoning & executing action: <strong>{lastAction}</strong>...
            </div>
          )}

          <div ref={terminalEndRef} />
        </div>
      )}

      {/* Tab 2: Artifacts, Commit, PR & Graph Sync */}
      {activeTab === 'artifacts' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
        }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#0b2545', fontWeight: '700' }}>
            Generated Workspace Artifacts & Neo4j Knowledge Graph Sync
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Git Commit Card */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <GitCommit size={18} color="#0052cc" />
                <span style={{ fontWeight: '700', color: '#0f172a' }}>Workspace Git Commit</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '8px' }}>
                Hash: <code style={{ background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#0b2545' }}>
                  {pipelineState?.git_commit?.hash || 'None yet'}
                </code>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Message: <strong>{pipelineState?.git_commit?.message || 'No commits recorded for current session'}</strong>
              </div>
            </div>

            {/* Pull Request Card */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <GitPullRequest size={18} color="#059669" />
                  <span style={{ fontWeight: '700', color: '#0f172a' }}>Linked Pull Request</span>
                </div>
                {onNavigateToRepo && (
                  <button
                    onClick={onNavigateToRepo}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Open in Repo View <ExternalLink size={12} />
                  </button>
                )}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '6px' }}>
                Status: <span style={{ color: '#059669', fontWeight: '700' }}>OPEN</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                Branch: <code>feature/{pipelineState?.ticket_key?.toLowerCase() || 'agent'}-agent-patch</code>
              </div>
            </div>

            {/* Neo4j Knowledge Base & Graph Sync Card */}
            <div style={{ border: '1px solid #e9d5ff', borderRadius: '12px', padding: '16px', background: '#faf5ff', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BookOpen size={18} color="#9333ea" />
                  <span style={{ fontWeight: '700', color: '#581c87' }}>Knowledge Base & Neo4j Property Graph Sync</span>
                </div>
                {onNavigateToGraph && (
                  <button
                    onClick={onNavigateToGraph}
                    className="btn-secondary"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    Inspect in Graph Visualizer <ExternalLink size={12} />
                  </button>
                )}
              </div>

              <div style={{ fontSize: '0.86rem', color: '#6b21a8', marginBottom: '8px' }}>
                <strong>Knowledge Base Doc:</strong> {pipelineState?.release_result?.knowledge_base_doc?.key || `KB-${pipelineState?.ticket_key || 'NEW'}`} &mdash; <em>{pipelineState?.release_result?.knowledge_base_doc?.title || 'Architecture Documentation'}</em>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#7e22ce', marginBottom: '10px' }}>
                {pipelineState?.release_result?.knowledge_base_doc?.summary || 'Architecture specifications and tokens recorded in Neo4j for subsequent agents.'}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                  {"(:Issue)-[:DOCUMENTED_IN]->(:Doc)"}
                </span>
                <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                  {"(:Commit)-[:REFERENCES]->(:Issue)"}
                </span>
                <span style={{ background: '#f3e8ff', color: '#6b21a8', padding: '4px 10px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700' }}>
                  Kanban Status: {pipelineState?.release_result?.kanban_status || 'DONE'}
                </span>
              </div>
            </div>

            {/* Modified Files */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', background: '#f8fafc', gridColumn: '1 / -1' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <FileCode size={18} color="#0052cc" />
                <span style={{ fontWeight: '700', color: '#0f172a' }}>Modified Workspace Files</span>
              </div>
              {pipelineState?.modified_files?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {pipelineState.modified_files.map((file, i) => (
                    <span key={i} style={{
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontFamily: 'monospace',
                      color: '#0f172a'
                    }}>
                      {file}
                    </span>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>No modified files in this run.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: History */}
      {activeTab === 'history' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
        }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1.05rem', color: '#0b2545', fontWeight: '700' }}>
            Multi-Agent Execution Run History
          </h4>

          {history.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
              No previous runs recorded.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((run, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '16px',
                    background: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '700', color: '#0052cc', fontSize: '0.95rem' }}>
                        {run.ticket_key}
                      </span>
                      <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '0.9rem' }}>
                        {run.ticket_title}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      Audit Score: {run.tester_result?.score || 'N/A'}/100 &bull; 
                      Files: {run.modified_files?.join(', ') || 'styles.css'} &bull;
                      Commit: <code>{run.git_commit?.hash || 'HEAD'}</code> &bull;
                      KB: <code>{run.release_result?.knowledge_base_doc?.key || `KB-${run.ticket_key}`}</code>
                    </div>
                  </div>

                  <span style={{
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    background: run.pipeline_status === 'completed' ? '#dcfce7' : '#fee2e2',
                    color: run.pipeline_status === 'completed' ? '#166534' : '#991b1b'
                  }}>
                    {run.pipeline_status?.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Automated Prioritization & Dependency Queue */}
      {activeTab === 'queue' && (
        <div style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '24px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.04)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.15rem', color: '#0b2545', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={20} color="#0052cc" />
                Automated Prioritization & Dependency Queue
              </h4>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                Powered by Neo4j graph dependency analysis (:BLOCKS, :DEPENDS_ON) and Weighted Shortest Job First (WSJF) sizing.
              </p>
            </div>

            {queueData?.nextRecommended && (
              <button
                className="btn-primary"
                style={{ padding: '8px 18px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                disabled={isTriggering || pipelineStatus === 'running'}
                onClick={() => handleTriggerTicket(queueData.nextRecommended.id)}
              >
                <Play size={14} />
                Execute #1 Recommended ({queueData.nextRecommended.key})
              </button>
            )}
          </div>

          {/* Quick Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Ready to Execute (Unblocked)
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#15803d', marginTop: '4px' }}>
                {queueData?.readyQueue?.length || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#166534', marginTop: '2px' }}>
                Zero active blockers &bull; Ranked by WSJF score
              </div>
            </div>

            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Blocked by Prerequisites
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>
                {queueData?.blockedQueue?.length || 0}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#991b1b', marginTop: '2px' }}>
                Waiting on preceding tasks to reach DONE
              </div>
            </div>

            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '14px' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Next Optimal Task
              </div>
              <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#1d4ed8', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {queueData?.nextRecommended?.key ? `${queueData.nextRecommended.key} (${queueData.nextRecommended.storyPoints} SP)` : 'All Up to Date'}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#1e40af', marginTop: '2px' }}>
                {queueData?.nextRecommended ? `Score: ${queueData.nextRecommended.priorityScore}` : 'Queue fully processed'}
              </div>
            </div>
          </div>

          {/* Section 1: Ready Queue */}
          <div style={{ marginBottom: '28px' }}>
            <h5 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              Ready Execution Queue &bull; Ordered by Sizing & Priority (Smallest & Most Impactful First)
            </h5>

            {(!queueData?.readyQueue || queueData.readyQueue.length === 0) ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                No unblocked tickets pending in TODO or BACKLOG.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {queueData.readyQueue.map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      border: idx === 0 ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      borderRadius: '12px',
                      padding: '14px 18px',
                      background: idx === 0 ? '#f0f9ff' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: '280px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: idx === 0 ? '#2563eb' : '#f1f5f9',
                        color: idx === 0 ? '#ffffff' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '0.9rem'
                      }}>
                        #{idx + 1}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: '700', color: '#0052cc', fontSize: '0.95rem' }}>
                            {item.key}
                          </span>
                          <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.9rem' }}>
                            {item.title}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: '#64748b', flexWrap: 'wrap' }}>
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                            {item.storyPoints} SP
                          </span>
                          <span style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontWeight: '600' }}>
                            Priority: {item.priority}
                          </span>
                          {item.storyPoints <= 2 && (
                            <span style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              ⚡ Quick Win (Small)
                            </span>
                          )}
                          {item.unblocksCount > 0 && (
                            <span style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                              🔓 Unblocks {item.unblocksCount} task(s)
                            </span>
                          )}
                          <span style={{ color: '#0284c7', fontWeight: '600' }}>
                            &bull; {item.recommendedOrderReason}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>
                          WSJF Score
                        </div>
                        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#0b2545' }}>
                          {item.priorityScore}
                        </div>
                      </div>

                      <button
                        className="btn-secondary"
                        style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                        disabled={isTriggering || pipelineStatus === 'running'}
                        onClick={() => handleTriggerTicket(item.id)}
                      >
                        <Play size={12} />
                        Run Agent
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Blocked Queue */}
          <div style={{ marginBottom: '24px' }}>
            <h5 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={15} color="#dc2626" />
              Blocked by Prerequisites (Paused Until Dependencies Complete)
            </h5>

            {(!queueData?.blockedQueue || queueData.blockedQueue.length === 0) ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #cbd5e1' }}>
                No tasks are currently blocked by dependencies! All issues are unblocked and executable.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {queueData.blockedQueue.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      border: '1px solid #fee2e2',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      background: '#fffbfb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ fontWeight: '700', color: '#991b1b', fontSize: '0.9rem' }}>
                          {item.key}
                        </span>
                        <span style={{ fontWeight: '600', color: '#334155', fontSize: '0.88rem' }}>
                          {item.title}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                          ({item.storyPoints} SP &bull; {item.priority})
                        </span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Lock size={12} />
                        <strong>Prerequisite Blockers:</strong> {item.activeBlockers?.map(b => `${b.key} (${b.status || 'TODO'})`).join(', ')}
                      </div>
                    </div>

                    <span style={{
                      background: '#fef2f2',
                      color: '#b91c1c',
                      border: '1px solid #fecaca',
                      padding: '3px 10px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: '700'
                    }}>
                      Awaiting Blocker
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Algorithm Card */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px' }}>
            <h6 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', fontWeight: '700', color: '#1e293b' }}>
              ℹ️ How Autonomous Agent Prioritization Works:
            </h6>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px', fontSize: '0.8rem', color: '#475569' }}>
              <div>
                <strong style={{ color: '#0f172a' }}>1. Graph Blocker Resolution (DAG)</strong>
                <p style={{ margin: '2px 0 0 0' }}>
                  Tickets connected via <code>(:Issue)-[:BLOCKS]-&gt;(:Issue)</code> are kept on hold until the blocker ticket is verified and committed to <code>DONE</code>.
                </p>
              </div>
              <div>
                <strong style={{ color: '#0f172a' }}>2. Shortest Job First (SJF / WSJF)</strong>
                <p style={{ margin: '2px 0 0 0' }}>
                  Smaller tasks (1-2 Story Points, quick fixes, CSS tweaks) get higher relative scores, clearing bottlenecks rapidly before heavy multi-file features.
                </p>
              </div>
              <div>
                <strong style={{ color: '#0f172a' }}>3. Critical Path Unblock Bonus</strong>
                <p style={{ margin: '2px 0 0 0' }}>
                  Tasks that unblock multiple downstream tickets receive a <code>+10</code> urgency bonus per blocked dependent, keeping the entire pipeline unblocked.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
